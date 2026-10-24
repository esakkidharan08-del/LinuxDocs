"""Deterministic progress merging (Part 2) — the server-side half.

These rules are mirrored 1:1 by the frontend module ``src/lib/progress.ts``;
one shared JSON file (``qa/merge_vectors.json``) is loaded by BOTH a pytest
test and a Node-side test, so the two implementations cannot drift.

The merge is a pure join over two progress payloads for the same key:

* learning    — per path: completed flag OR-ed (never un-complete), quiz
                bests kept as max, lessons read as a sorted set-union.
* terminal    — solved missions as a sorted set-union (never un-solve),
                commandsRun counter as max.
* flashcards  — per-deck completed-session counts as max (counts cannot be
                unioned; max is the loss-free monotone choice).
* speeddrill  — personal best and rounds played as max.
* streak      — best and totalDays as max; ``lastDay`` becomes the LATER of
                the two visits (the newest device reality) and the merged
                ``current`` is that row's streak, "recomputed from the
                last-visit date". When both rows share the same lastDay the
                larger current wins. Broken-gap nessing (a stale chain
                resetting to 0) stays a read-time concern in the client
                (``normalizeStreak``), not part of the pure merge.

Inputs may be None/missing → treated as empty. The result is commutative,
idempotent and order-independent, so replay storms and conflict retries
always converge to the same state.
"""

from __future__ import annotations

from datetime import date

from .progress_schemas import PROGRESS_KEYS

PROGRESS_MERGE_VERSION = 2  # bumped with the vectors file contract version


def _clean(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def _as_int(value: object, default: int = 0) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else default


def _as_list(value: object) -> list:
    return value if isinstance(value, list) else []


def _union_sorted(a: object, b: object) -> list[str]:
    return sorted(set(_as_list(a)) | set(_as_list(b)))  # type: ignore[arg-type]


def _merge_learning(a: object, b: object) -> dict:
    merged: dict = {}
    base, other = _clean(a), _clean(b)
    for path_id in sorted(set(base) | set(other)):
        ea, eb = _clean(base.get(path_id)), _clean(other.get(path_id))
        merged[path_id] = {
            'completed': bool(ea.get('completed')) or bool(eb.get('completed')),
            'bestScore': max(_as_int(ea.get('bestScore')), _as_int(eb.get('bestScore'))),
            'bestTotal': max(_as_int(ea.get('bestTotal')), _as_int(eb.get('bestTotal'))),
            'lessons': _union_sorted(ea.get('lessons'), eb.get('lessons')),
        }
    return merged


def _merge_terminal(a: object, b: object) -> dict:
    out = {
        'solved': _union_sorted(_clean(a).get('solved'), _clean(b).get('solved')),
        'commandsRun': max(_as_int(_clean(a).get('commandsRun')), _as_int(_clean(b).get('commandsRun'))),
    }
    # Faster full-run times are the personal best (min over set values); the
    # run counter is cumulative, so max wins there.
    run_times = [v for v in (_as_int(_clean(a).get('bestRunSeconds')), _as_int(_clean(b).get('bestRunSeconds'))) if v > 0]
    if run_times:
        out['bestRunSeconds'] = min(run_times)
    runs = max(_as_int(_clean(a).get('runs')), _as_int(_clean(b).get('runs')))
    if runs > 0:
        out['runs'] = runs
    return out


def _merge_flashcards(a: object, b: object) -> dict:
    completes: dict[str, int] = {}
    srs: dict[str, dict] = {}
    ca, cb = _clean(a).get('completes'), _clean(b).get('completes')
    sa, sb = _clean(a).get('srs'), _clean(b).get('srs')
    for deck_id in sorted(set(_clean(ca)) | set(_clean(cb))):
        merged_deck = max(_as_int(_clean(ca).get(deck_id)), _as_int(_clean(cb).get(deck_id)))
        if merged_deck > 0:
            completes[deck_id] = merged_deck
    # SRS cards: the device with the HIGHER bucket carries the later review
    # state; equal buckets resolve to the LATER due day. Deterministic join.
    for slug in sorted(set(_clean(sa)) | set(_clean(sb))):
        ea, eb = _clean(sa.get(slug)), _clean(sb.get(slug))
        if not ea and not eb:
            continue
        bucket_a, bucket_b = _as_int(ea.get('bucket')), _as_int(eb.get('bucket'))
        due_a, due_b = str(ea.get('due') or ''), str(eb.get('due') or '')
        if bucket_a > bucket_b:
            srs[slug] = {'bucket': bucket_a, 'due': due_a}
        elif bucket_b > bucket_a:
            srs[slug] = {'bucket': bucket_b, 'due': due_b}
        else:
            srs[slug] = {'bucket': bucket_a, 'due': max(due_a, due_b)}
    out: dict = {'completes': completes}
    if srs:
        out['srs'] = srs
    return out


def _merge_speeddrill(a: object, b: object) -> dict:
    return {
        'best': max(_as_int(_clean(a).get('best')), _as_int(_clean(b).get('best'))),
        'plays': max(_as_int(_clean(a).get('plays')), _as_int(_clean(b).get('plays'))),
    }


def days_between(day_a: str, day_b: str) -> int:
    """Calendar-day distance between two ``YYYY-MM-DD`` strings (b − a)."""

    from datetime import date

    try:
        return (date.fromisoformat(str(day_b)) - date.fromisoformat(str(day_a))).days
    except (TypeError, ValueError):
        return 10 ** 6  # unparseable dates are maximally distant


def _parse_day(value: str) -> date | None:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _merge_streak(a: object, b: object) -> dict:
    ca, cb = _clean(a), _clean(b)
    last_a, last_b = str(ca.get('lastDay', '')), str(cb.get('lastDay', ''))
    best = max(_as_int(ca.get('best')), _as_int(cb.get('best')))
    total_days = max(_as_int(ca.get('totalDays')), _as_int(cb.get('totalDays')))
    freezes = max(_as_int(ca.get('freezes')), _as_int(cb.get('freezes')))

    def _row(last_day: str, current: int) -> dict:
        out: dict = {'lastDay': last_day, 'current': current, 'best': best, 'totalDays': total_days}
        if freezes > 0:
            out['freezes'] = freezes
        return out

    # The most recent visit carries the live chain (\"recomputed from the
    # last-visit date\"); empty/absent days are treated as missing and cannot
    # win. Same-day visits: the longer live chain wins. Symmetric by design.
    day_a, day_b = _parse_day(last_a), _parse_day(last_b)
    if day_a is None and day_b is None:
        return _row('', max(_as_int(ca.get('current')), _as_int(cb.get('current'))))
    if day_b is None:
        return _row(last_a, _as_int(ca.get('current')))
    if day_a is None:
        return _row(last_b, _as_int(cb.get('current')))
    if day_b > day_a:
        return _row(last_b, _as_int(cb.get('current')))
    if day_a > day_b:
        return _row(last_a, _as_int(ca.get('current')))
    return _row(last_b if last_b else last_a,
                max(_as_int(ca.get('current')), _as_int(cb.get('current'))))


_MERGERS = {
    'learning': _merge_learning,
    'terminal': _merge_terminal,
    'flashcards': _merge_flashcards,
    'speeddrill': _merge_speeddrill,
    'streak': _merge_streak,
}


def merge_progress_data(key: str, a: object, b: object) -> dict:
    """Merge two payloads for ``key``. Both may be None; result is always a dict."""
    if key not in PROGRESS_KEYS:
        raise ValueError(f'unknown progress key {key!r}')
    return _MERGERS[key](a, b)
