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

PROGRESS_MERGE_VERSION = 1  # bumped with the vectors file contract version


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
    return {
        'solved': _union_sorted(_clean(a).get('solved'), _clean(b).get('solved')),
        'commandsRun': max(_as_int(_clean(a).get('commandsRun')), _as_int(_clean(b).get('commandsRun'))),
    }


def _merge_flashcards(a: object, b: object) -> dict:
    completes: dict[str, int] = {}
    ca, cb = _clean(a).get('completes'), _clean(b).get('completes')
    for deck_id in sorted(set(_clean(ca)) | set(_clean(cb))):
        merged_deck = max(_as_int(_clean(ca).get(deck_id)), _as_int(_clean(cb).get(deck_id)))
        if merged_deck > 0:
            completes[deck_id] = merged_deck
    return {'completes': completes}


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

    # The most recent visit carries the live chain (\"recomputed from the
    # last-visit date\"); empty/absent days are treated as missing and cannot
    # win. Same-day visits: the longer live chain wins. Symmetric by design.
    day_a, day_b = _parse_day(last_a), _parse_day(last_b)
    if day_a is None and day_b is None:
        return {'lastDay': '', 'current': max(_as_int(ca.get('current')), _as_int(cb.get('current'))),
                'best': best, 'totalDays': total_days}
    if day_b is None:
        return {'lastDay': last_a, 'current': _as_int(ca.get('current')), 'best': best, 'totalDays': total_days}
    if day_a is None:
        return {'lastDay': last_b, 'current': _as_int(cb.get('current')), 'best': best, 'totalDays': total_days}
    if day_b > day_a:
        return {'lastDay': last_b, 'current': _as_int(cb.get('current')), 'best': best, 'totalDays': total_days}
    if day_a > day_b:
        return {'lastDay': last_a, 'current': _as_int(ca.get('current')), 'best': best, 'totalDays': total_days}
    return {'lastDay': last_b if last_b else last_a,
            'current': max(_as_int(ca.get('current')), _as_int(cb.get('current'))),
            'best': best, 'totalDays': total_days}


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
