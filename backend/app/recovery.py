"""Password recovery by knowledge — no email involved.

The requester proves ownership by answering 10 questions about *their own*
learning activity (paths read, lessons, streaks, drill records, bookmarks).
8 or 10 correct answers earn a recovery grant; the grant is redeemed at
``/recovery/complete`` to set a new password.

Rules of the game, enforced here:

* No learning/account-activity data → ``mode: 'direct'`` — the account
  holds nothing to lose, so the quiz is skipped entirely (new users are
  never locked out). Fewer than 10 well-defined questions constructible
  (sparse but real activity) also falls back to direct mode.
* The quiz is generated per request from the account's stored progress;
  only the question pages reach the client — the correct option index
  never does.
* A grant answers at most MAX_ATTEMPTS bundles (3 wrong bundles burn it),
  works exactly once, and expires in RECOVERY_TTL_MINUTES (default 15).
* Every endpoint is rate-limited by IP and requires a trusted origin.
* Guessing all 10 four-choice questions blind succeeds with probability
  ~0.4% per attempt; starts are capped at 5/hour/IP by default.

NOTE (accepted, documented): /recovery/start answers 'unavailable' for an
unknown email but 'direct' for an empty account — leaking that the address
exists. Registration already reveals email existence publicly, so this
adds no materially new signal; true protection can layer on email
confirmation later if the mail provider ever returns.
"""

from __future__ import annotations

import random
from datetime import timedelta

from flask import Blueprint, request, jsonify
from sqlalchemy import update as sa_update

from . import db
from .models import (
    User, UserProgress, Bookmark, UserNote, RecentlyViewed,
    PasswordRecoveryChallenge, utcnow,
)
from .auth import password_content_errors, _revoke_all_auth
from .security import (
    env_int, rate_limit, require_trusted_origin, sha256_hex,
    generate_opaque_token, _warn_security, client_ip,
)
from .commands import load_command_map

recovery_bp = Blueprint('recovery', __name__)

QUESTION_COUNT = 10
PASS_MARK = 8
MAX_ATTEMPTS = 3

# Mirror of src/pages/LearningPage.tsx PATHS (id → display title, fixed set).
# Keep both sides in sync when a path is renamed.
PATH_TITLES: dict[str, str] = {
    'shell-basics': 'Shell Basics',
    'text-tools': 'Text Processing',
    'system-networking': 'System & Networking',
    'security-ctf': 'Security & CTF Starters',
    'permissions-ownership': 'Permissions & Ownership',
    'shell-automation': 'Shell Automation & Pipelines',
    'services-logs': 'Services & Log Intelligence',
    'secure-ops': 'Secure Remote Operations',
}


# ---------------------------------------------------------------------------
# question generation (pure functions over real account data)
# ---------------------------------------------------------------------------

def _num_wrongs(value: int) -> list[int]:
    """Three plausible, distinct neighbour numbers — never negative."""
    pool = sorted({c for c in range(max(0, value - 6), value + 7)
                   if c != value and c >= 0})
    if len(pool) < 3:                       # value near zero: widen upward
        pool += [n for n in range(value + 7, value + 30) if n not in pool]
    random.shuffle(pool)
    return pool[:3]


def _number_question(prompt: str, value: int) -> dict | None:
    if value <= 0:
        return None
    wrongs = _num_wrongs(value)
    if len(wrongs) < 3:
        return None
    options = [value, *wrongs]
    random.shuffle(options)
    return {'prompt': prompt, 'options': options, 'correct': options.index(value),
            'tag': 'number'}


def _percent_question(prompt: str, value: int) -> dict | None:
    pool = [c for c in (value - 20, value - 10, value + 5, value + 10, value + 20)
            if c != value and 0 <= c <= 100]
    pool = list(dict.fromkeys(pool)) or [c for c in range(0, 101, 25) if c != value and c != value]
    random.shuffle(pool)
    wrongs = pool[:3]
    if len(wrongs) < 3:
        return None
    options = [f'{value}%', *(f'{w}%' for w in wrongs)]
    random.shuffle(options)
    return {'prompt': prompt, 'options': options, 'correct': options.index(f'{value}%'),
            'tag': 'percent'}


def _choice_question(prompt: str, correct: str, pool: list[str]) -> dict | None:
    wrongs = [c for c in pool if c and c != correct]
    random.shuffle(wrongs)
    if len(wrongs) < 3:
        return None
    options = [correct, *wrongs[:3]]
    random.shuffle(options)
    return {'prompt': prompt, 'options': options, 'correct': options.index(correct),
            'tag': 'choice'}


def _command_name(slug: str) -> str | None:
    """Display name of a command slug (None when the dataset moved on)."""
    entry = load_command_map().get((slug or '').lower())
    return entry.get('name') if entry else None


def _all_command_names() -> list[str]:
    names = [cmd['name'] for cmd in load_command_map().values() if cmd.get('name')]
    random.shuffle(names)
    return names


def _facts(user: User, progress: dict) -> list[dict]:
    """Assemble knowledge questions from the account's stored activity.

    Each builder only fires when the fact is unambiguous and the account
    holder plausibly *knows* it. A sparse account can produce fewer
    distinct questions than QUESTION_COUNT — start() then falls back to
    direct mode.
    """
    facts: list[dict] = []

    learning = progress.get('learning') or {}
    lessons_by_path: dict[str, int] = {}
    completed_titles: list[str] = []
    quiz_pcts: list[tuple[str, int]] = []

    for path_id, entry in learning.items():
        if not isinstance(entry, dict):
            continue
        title = PATH_TITLES.get(path_id)
        if not title:
            continue
        lessons = entry.get('lessons') or []
        lessons_by_path[title] = len(lessons)
        if entry.get('completed'):
            completed_titles.append(title)
        if entry.get('bestTotal'):
            quiz_pcts.append((title, round((entry.get('bestScore') or 0) / entry['bestTotal'] * 100)))

    titles = list(PATH_TITLES.values())

    # 1. lessons per path that the user actually read
    sampled_paths = random.sample(list(lessons_by_path), k=min(4, len(lessons_by_path)))
    for title in sampled_paths:
        fact = _number_question(f'In the "{title}" learning path, how many lessons have you read?',
                                lessons_by_path[title])
        if fact:
            facts.append(fact)

    # 2. quiz bests (percent)
    for title, pct in quiz_pcts[:2]:
        fact = _percent_question(f'What was your best quiz score in the "{title}" path?', pct)
        if fact:
            facts.append(fact)

    # 3. completed path (choice)
    if completed_titles:
        uncompleted = [t for t in titles if t not in completed_titles]
        fact = _choice_question('Which of these learning paths is marked COMPLETED on your account?',
                                completed_titles[0], uncompleted)
        if fact:
            facts.append(fact)

    # 4. streak facts
    streak = progress.get('streak') or {}
    if streak.get('current', 0) >= 2:
        fact = _number_question('How many days long is your current learning streak?', streak['current'])
        if fact:
            facts.append(fact)
    if streak.get('best', 0) >= 3 and streak.get('best') != streak.get('current'):
        fact = _number_question('How many days long is your all-time best learning streak?', streak['best'])
        if fact:
            facts.append(fact)
    if streak.get('freezes', 0) > 0:
        fact = _number_question('How many streak-freeze tokens does your account hold?', streak['freezes'])
        if fact:
            facts.append(fact)

    # 5. speed drill records
    drill = progress.get('speeddrill') or {}
    if drill.get('best', 0) >= 3:
        fact = _number_question('What is your speed-drill personal best (points in a 60-second round)?', drill['best'])
        if fact:
            facts.append(fact)
    if drill.get('plays', 0) >= 2:
        fact = _number_question('How many speed-drill rounds have you played in total?', drill['plays'])
        if fact:
            facts.append(fact)

    # 6. terminal missions
    terminal = progress.get('terminal') or {}
    solved = terminal.get('solved') or []
    if solved:
        fact = _number_question('How many practice-terminal missions does your account mark as solved?', len(solved))
        if fact:
            facts.append(fact)

    # 7. flashcards
    flash = progress.get('flashcards') or {}
    completes = flash.get('completes') or {}
    if completes:
        fact = _number_question('On how many flashcard decks have you completed review sessions?', len(completes))
        if fact:
            facts.append(fact)
    srs = flash.get('srs') or {}
    if len(srs) >= 4:
        fact = _number_question('How many flashcards are scheduled in your spaced-repetition queue?', len(srs))
        if fact:
            facts.append(fact)

    # 8. bookmarks (count + names — the strongest personal knowledge)
    bookmark_slugs = [b.command_slug for b in Bookmark.query.filter_by(user_id=user.id).all()]
    if len(bookmark_slugs) >= 2:
        fact = _number_question('How many commands have you bookmarked on your account?', len(bookmark_slugs))
        if fact:
            facts.append(fact)
    name_pool = _all_command_names()
    sampled = random.sample(bookmark_slugs, k=min(2, len(bookmark_slugs)))
    for slug in sampled:
        name = _command_name(slug)
        if name:
            fact = _choice_question('Which of these commands is bookmarked on your account?',
                                    name, name_pool)
            if fact:
                facts.append(fact)

    # 9. personal notes
    notes = UserNote.query.filter_by(user_id=user.id).count()
    if notes >= 2:
        fact = _number_question('How many personal notes have you written on command pages?', notes)
        if fact:
            facts.append(fact)

    # 10. recently viewed command
    recent = (RecentlyViewed.query.filter_by(user_id=user.id)
              .order_by(RecentlyViewed.viewed_at.desc()).first())
    if recent is not None:
        name = _command_name(recent.command_slug)
        if name:
            fact = _choice_question('Which of these commands did you most recently open?',
                                    name, name_pool)
            if fact:
                facts.append(fact)

    return facts


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------

def _load_progress(user_id: int) -> dict[str, dict]:
    rows = UserProgress.query.filter_by(user_id=user_id).all()
    return {row.key: (row.data or {}) for row in rows}


def _invalid_grant() -> tuple:
    return jsonify({'error': 'Recovery grant is invalid, expired, or already used'}), 400


def _find_grant(grant: str) -> PasswordRecoveryChallenge | None:
    if not grant or not isinstance(grant, str) or len(grant) > 128:
        return None
    row = PasswordRecoveryChallenge.query.filter_by(challenge_hash=sha256_hex(grant)).first()
    if row is None or row.used_at is not None or row.is_expired():
        return None
    if row.mode != 'direct' and (row.attempts or 0) >= MAX_ATTEMPTS:
        return None
    return row


def _new_challenge_row(user_id: int, grant: str, mode: str, questions: list) -> None:
    ttl_minutes = max(1, env_int('RECOVERY_TTL_MINUTES', 15))
    db.session.add(PasswordRecoveryChallenge(
        user_id=user_id,
        challenge_hash=sha256_hex(grant),
        mode=mode,
        questions=questions,
        expires_at=utcnow() + timedelta(minutes=ttl_minutes),
    ))


@recovery_bp.route('/recovery/start', methods=['POST'])
@rate_limit('recovery-start:ip:{ip}', lambda: env_int('RECOVERY_START_RATE_LIMIT', 5), 3600)
def recovery_start():
    """Begin recovery: hand out the quiz in-page, or a direct grant when the
    account holds no quiz-able learning data (product decision, see module
    docstring)."""
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Email required'}), 400

    user = User.query.filter_by(email=email).first()
    if user is None:
        return jsonify({
            'mode': 'unavailable',
            'message': 'Knowledge recovery is not available for this email. '
                       'New accounts with no learning activity can reset directly '
                       'from an existing account email.',
        }), 200

    progress = _load_progress(user.id)
    facts = _facts(user, progress)

    # invalidate previous unused grants — only the newest start counts
    PasswordRecoveryChallenge.query.filter_by(
        user_id=user.id, used_at=None, verified_at=None).delete(synchronize_session=False)

    grant = generate_opaque_token(32)

    if len(facts) < QUESTION_COUNT:
        mode, questions = 'direct', []
        message = ('No learning activity to quiz you on — continue straight '
                   'to setting a new password.')
    else:
        mode = 'challenge'
        random.shuffle(facts)
        picked = facts[:QUESTION_COUNT]
        questions = picked                      # stored WITH correct indexes; never sent
        message = (f'Answer {PASS_MARK} or more of these {QUESTION_COUNT} questions '
                   'about your own learning to continue.')

    _new_challenge_row(user.id, grant, mode, questions)
    db.session.commit()
    _warn_security('recovery_start', user_id=user.id, ip=client_ip(), mode=mode)

    public_questions = (None if mode == 'direct' else
                        [{'prompt': q['prompt'], 'options': q['options'], 'tag': q.get('tag', 'fact')}
                         for q in questions])
    return jsonify({'mode': mode, 'grant': grant, 'questions': public_questions,
                    'message': message}), 200


@recovery_bp.route('/recovery/verify', methods=['POST'])
@rate_limit('recovery-verify:ip:{ip}', lambda: env_int('RECOVERY_VERIFY_RATE_LIMIT', 10), 3600)
def recovery_verify():
    """Grade one answer bundle. PASS_MARK/10 marks the grant verified; wrong
    bundles burn one of MAX_ATTEMPTS attempts before the grant dies."""
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    data = request.get_json(silent=True) or {}
    row = _find_grant(data.get('grant', ''))
    if row is None:
        return _invalid_grant()

    if row.mode == 'direct':
        return jsonify({'mode': 'direct'}), 200

    answers = data.get('answers')
    if (not isinstance(answers, list) or len(answers) != QUESTION_COUNT
            or any(not isinstance(a, int) or not 0 <= a <= 3 for a in answers)):
        return jsonify({'error': f'answers must be {QUESTION_COUNT} option indices'}), 400

    stored = row.questions
    correct = sum(1 for i, answer in enumerate(answers)
                  if answer == stored[i]['correct'])

    if correct >= PASS_MARK:
        row.verified_at = utcnow()
        db.session.commit()
        _warn_security('recovery_verified', user_id=row.user_id, ip=client_ip())
        return jsonify({'passed': True}), 200

    row.attempts = (row.attempts or 0) + 1
    remaining = MAX_ATTEMPTS - row.attempts
    passed = False
    db.session.commit()
    if remaining <= 0:
        _warn_security('recovery_burned', user_id=row.user_id, ip=client_ip())
        return jsonify({'passed': passed, 'burned': True}), 200
    return jsonify({'passed': passed, 'correct': correct, 'attemptsLeft': remaining}), 200


@recovery_bp.route('/recovery/complete', methods=['POST'])
@rate_limit('recovery-complete:ip:{ip}', lambda: env_int('RECOVERY_COMPLETE_RATE_LIMIT', 10), 3600)
def recovery_complete():
    """Redeem a verified grant to set a new password. Password-format rules
    are checked BEFORE the grant is spent, so a typo never burns it."""
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    data = request.get_json(silent=True) or {}
    row = _find_grant(data.get('grant', ''))
    if row is None or (row.mode != 'direct' and row.verified_at is None):
        return _invalid_grant()

    password = data.get('password', '')
    confirm = data.get('confirm_password', '')
    errors = {}
    content = password_content_errors(password)
    if content:
        errors['password'] = content[0]
    if password != confirm:
        errors['confirm_password'] = 'Passwords do not match'
    if errors:
        return jsonify({'errors': errors}), 400

    # identity-bound rules (password contains own username/email)
    low = password.lower()
    if row.user.username and row.user.username.lower() in low:
        return jsonify({'errors': {'password': 'Password must not contain your username'}}), 400
    if row.user.email and row.user.email.lower() in low:
        return jsonify({'errors': {'password': 'Password must not contain your email address'}}), 400

    user = row.user
    user.set_password(password)
    _revoke_all_auth(user.id, keep_current=False)   # recovery = kill every session

    # atomic single-use claim: only one caller can move used_at off NULL.
    result = db.session.execute(
        sa_update(PasswordRecoveryChallenge)
        .where(PasswordRecoveryChallenge.id == row.id,
               PasswordRecoveryChallenge.used_at.is_(None))
        .values(used_at=utcnow())
        .execution_options(synchronize_session=False))
    claimed = result.rowcount == 1
    db.session.commit()
    if not claimed:
        return _invalid_grant()
    _warn_security('password_recovered', user_id=user.id, ip=client_ip())
    return jsonify({'message': 'Password reset. Sign in with your new password.'}), 200
