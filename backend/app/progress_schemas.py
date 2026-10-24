"""Strict per-key schema validation for synced learning progress (Part 2).

The same five keys travel client → server (`PUT /api/user/progress/<key>`)
and inside schema-v2 export/import files. The server is the gate: every
payload is validated against the EXACT rules below before it is stored or
merged — unknown fields, wrong types and out-of-range values are rejected
with a 400 carrying a concrete reason. The frontend mirrors these shapes so
device caches stay clean, but only the server's verdict is authoritative.

Size cap: a payload is capped at 64 KB of JSON (checked by the endpoints).
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone

PROGRESS_KEYS = ('learning', 'terminal', 'flashcards', 'speeddrill', 'streak')

KEY_ID = re.compile(r'^[a-z0-9-]{1,64}$')        # path ids / deck ids
DECK_ID = re.compile(r'^[a-z0-9-]{1,64}(:[a-z0-9-]{1,64})?$')  # incl. scoped ids ('linux:text-tools')
SRS_SLUG = re.compile(r'^[a-z0-9-]{1,48}(/[a-z0-9-]{1,48})*$')  # command slugs ('ctf/crypto/john')
MISSION_ID = re.compile(r'^m\d{1,2}$')           # terminal missions m1..m13
LESSON_REF = re.compile(r'^\d{1,3}$')            # lesson index inside a path ('0'..'99')
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')        # ISO calendar day

MAX_DATA_BYTES = 64 * 1024                       # 64 KB JSON cap per key
MAX_PATHS = 32                                   # 8 real paths; generous slack
MAX_LESSONS_PER_PATH = 200                       # 1..3 real lessons per path
MAX_MISSIONS = 64                                # 13 real missions
MAX_DECKS = 64                                   # a handful of real decks
MAX_SRS_CARDS = 200                              # 132 real command slugs
MAX_QUIZ_TOTAL = 1000                            # quiz question totals are ≤ 10
MAX_SCORE = 1000                                 # bestScore ≤ bestTotal ≤ MAX_QUIZ_TOTAL
MAX_DRILL_BEST = 10_000                          # 60-second drill score circumstantial
MAX_PLAYS = 100_000                              # drill rounds / terminal click counter
MAX_STREAK = 3650                                # 10 years of consecutive days
MAX_RUN_SECONDS = 86_400                         # a speedrun day is enough
MAX_FREEZES = 99                                 # streak freeze tokens
MAX_SRS_BUCKET = 8                               # 8 review intervals


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def data_json_bytes(data: object) -> int:
    return len(json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))


def _check_learning(data: dict) -> str | None:
    if len(data) > MAX_PATHS:
        return f'learning: too many paths ({len(data)} > {MAX_PATHS})'
    for path_id, entry in data.items():
        if not isinstance(path_id, str) or not KEY_ID.fullmatch(path_id):
            return f"learning: bad path id {path_id!r}"
        if not isinstance(entry, dict):
            return f"learning/{path_id}: entry must be an object"
        allowed = {'completed', 'bestScore', 'bestTotal', 'lessons'}
        unknown = set(entry) - allowed
        if unknown:
            return f"learning/{path_id}: unknown field(s) {sorted(unknown)}"
        completed = entry.get('completed')
        if not isinstance(completed, bool):
            return f'learning/{path_id}.completed: boolean required'
        for field in ('bestScore', 'bestTotal'):
            value = entry.get(field)
            if not _is_int(value) or not 0 <= value <= MAX_QUIZ_TOTAL:
                return f'learning/{path_id}.{field}: integer 0..{MAX_QUIZ_TOTAL} required'
        if entry['bestScore'] > entry['bestTotal']:
            return f"learning/{path_id}: bestScore cannot exceed bestTotal"
        lessons = entry.get('lessons')
        if not isinstance(lessons, list) or len(lessons) > MAX_LESSONS_PER_PATH:
            return f"learning/{path_id}.lessons: array of ≤{MAX_LESSONS_PER_PATH} ids"
        if len(set(lessons)) != len(lessons):
            return f"learning/{path_id}.lessons: duplicates not allowed"
        for lesson in lessons:
            if not isinstance(lesson, str) or not LESSON_REF.fullmatch(lesson):
                return f"learning/{path_id}.lessons: bad id {lesson!r}"
    return None


def _check_terminal(data: dict) -> str | None:
    unknown = set(data) - {'solved', 'commandsRun', 'bestRunSeconds', 'runs'}
    if unknown:
        return f'terminal: unknown field(s) {sorted(unknown)}'
    solved = data.get('solved')
    if not isinstance(solved, list) or len(solved) > MAX_MISSIONS:
        return f'terminal.solved: array of ≤{MAX_MISSIONS} mission ids'
    if len(set(solved)) != len(solved):
        return 'terminal.solved: duplicates not allowed'
    for mission in solved:
        if not isinstance(mission, str) or not MISSION_ID.fullmatch(mission):
            return f"terminal.solved: bad mission id {mission!r}"
    commands_run = data.get('commandsRun')
    if not _is_int(commands_run) or not 0 <= commands_run <= MAX_PLAYS:
        return f'terminal.commandsRun: integer 0..{MAX_PLAYS} required'
    for field, cap in (('bestRunSeconds', MAX_RUN_SECONDS), ('runs', MAX_PLAYS)):
        value = data.get(field)
        if value is None:
            continue  # optional (v2) — devices that never speedran stay valid
        if not _is_int(value) or not 0 <= value <= cap:
            return f'terminal.{field}: integer 0..{cap} required'
    return None


def _check_flashcards(data: dict) -> str | None:
    unknown = set(data) - {'completes', 'srs'}
    if unknown:
        return f'flashcards: unknown field(s) {sorted(unknown)}'
    completes = data.get('completes')
    if not isinstance(completes, dict):
        return "flashcards: 'completes' must be an object"
    if len(completes) > MAX_DECKS:
        return f'flashcards: too many decks ({len(completes)} > {MAX_DECKS})'
    for deck_id, count in completes.items():
        if not isinstance(deck_id, str) or not DECK_ID.fullmatch(deck_id):
            return f"flashcards: bad deck id {deck_id!r}"
        if not _is_int(count) or not 0 <= count <= MAX_DECKS * 100:
            return f'flashcards/{deck_id}: integer 0..{MAX_DECKS * 100} required'
    srs = data.get('srs')
    if srs is None:
        return None  # optional (v2) — pre-v2 payloads keep validating
    if not isinstance(srs, dict):
        return "flashcards: 'srs' must be an object"
    if len(srs) > MAX_SRS_CARDS:
        return f'flashcards: too many srs cards ({len(srs)} > {MAX_SRS_CARDS})'
    for slug, entry in srs.items():
        if not isinstance(slug, str) or not SRS_SLUG.fullmatch(slug):
            return f"flashcards: bad srs slug {slug!r}"
        if not isinstance(entry, dict) or set(entry) - {'bucket', 'due'}:
            return f"flashcards/{slug}: srs entry must be an object with bucket/due"
        bucket = entry.get('bucket')
        if not _is_int(bucket) or not 0 <= bucket <= MAX_SRS_BUCKET:
            return f'flashcards/{slug}.bucket: integer 0..{MAX_SRS_BUCKET} required'
        due = entry.get('due')
        if not isinstance(due, str) or not DATE.fullmatch(due) or _parse_day(due) is None:
            return f"flashcards/{slug}.due: real 'YYYY-MM-DD' required"
    return None


def _check_speeddrill(data: dict) -> str | None:
    unknown = set(data) - {'best', 'plays'}
    if unknown:
        return f'speeddrill: unknown field(s) {sorted(unknown)}'
    for field, cap in (('best', MAX_DRILL_BEST), ('plays', MAX_PLAYS)):
        value = data.get(field)
        if not _is_int(value) or not 0 <= value <= cap:
            return f'speeddrill.{field}: integer 0..{cap} required'
    return None


def server_today() -> date:
    """The server's UTC calendar day — the anchor for the ±1-day streak rule."""
    return datetime.now(timezone.utc).date()


def _parse_day(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _check_streak(data: dict, today: date) -> str | None:
    unknown = set(data) - {'lastDay', 'current', 'best', 'totalDays', 'freezes'}
    if unknown:
        return f'streak: unknown field(s) {sorted(unknown)}'
    last_day = data.get('lastDay')
    if not isinstance(last_day, str) or not DATE.fullmatch(last_day):
        return "streak.lastDay: 'YYYY-MM-DD' required"
    claimed = _parse_day(last_day)
    if claimed is None:
        return f'streak.lastDay: not a real date {last_day!r}'
    # The client sends its LOCAL date; accept only within ±1 day of server time
    # (covers timezones up to ±14 h plus honest clock drift) — farther out is
    # a broken or forged clock and must not seed the server's streak.
    if abs((claimed - today).days) > 1:
        return f'streak.lastDay: outside the ±1-day server window ({claimed} vs {today})'
    for field in ('current', 'best', 'totalDays'):
        value = data.get(field)
        if not _is_int(value) or not 0 <= value <= MAX_STREAK:
            return f'streak.{field}: integer 0..{MAX_STREAK} required'
    if data['best'] < data['current']:
        return 'streak: best cannot be below current'
    freezes = data.get('freezes')
    if freezes is None:
        return None  # optional (v2)
    if not _is_int(freezes) or not 0 <= freezes <= MAX_FREEZES:
        return f'streak.freezes: integer 0..{MAX_FREEZES} required'
    return None


_CHECKERS = {
    'learning': lambda data, today: _check_learning(data),
    'terminal': lambda data, today: _check_terminal(data),
    'flashcards': lambda data, today: _check_flashcards(data),
    'speeddrill': lambda data, today: _check_speeddrill(data),
    'streak': _check_streak,
}


def validate_progress(key: str, data: object, *, today: date | None = None) -> str | None:
    """Validate one progress payload. Returns None, or a concrete error string."""
    if key not in PROGRESS_KEYS:
        return f'unknown progress key {key!r} (valid: {", ".join(PROGRESS_KEYS)})'
    if not isinstance(data, dict):
        return f'{key}: payload must be an object'
    if data_json_bytes(data) > MAX_DATA_BYTES:
        return f'{key}: payload exceeds the {MAX_DATA_BYTES // 1024} KB cap'
    anchor = today or server_today()
    return _CHECKERS[key](data, anchor)
