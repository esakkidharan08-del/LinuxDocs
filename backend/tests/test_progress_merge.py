"""Cross-implementation merge-contract tests (Part 2).

``qa/merge_vectors.json`` is the single source of truth for the deterministic
progress merge; the Node-side loader (``qa/merge_test.mjs``) runs the SAME
vectors against ``src/lib/progress.ts``, so the Python and TypeScript
implementations cannot drift. Beyond the pinned expected results, every
vector is checked for commutativity and idempotence — a join-semilattice,
which is what lets conflict retries and offline replay storms converge.
"""

import json
import pathlib
import pytest

from app.progress_merge import PROGRESS_MERGE_VERSION, days_between, merge_progress_data
from app.progress_schemas import PROGRESS_KEYS

VECTORS_PATH = pathlib.Path(__file__).resolve().parents[2] / 'qa' / 'merge_vectors.json'
VECTORS = json.loads(VECTORS_PATH.read_text(encoding='utf-8'))


def test_vectors_file_is_the_versioned_contract():
    assert VECTORS['version'] == PROGRESS_MERGE_VERSION


def test_every_progress_key_has_a_vector():
    assert {vector['key'] for vector in VECTORS['vectors']} == set(PROGRESS_KEYS)


@pytest.mark.parametrize('vector', VECTORS['vectors'], ids=lambda v: v['name'])
def test_merge_vector(vector):
    merged = merge_progress_data(vector['key'], vector['a'], vector['b'])
    assert merged == vector['expected'], vector['note']
    # commutative: merge(b, a) must land on the same state
    assert merge_progress_data(vector['key'], vector['b'], vector['a']) == vector['expected']


@pytest.mark.parametrize('vector', VECTORS['vectors'], ids=lambda v: v['name'])
def test_merge_is_idempotent_semilattice(vector):
    expected = vector['expected']
    # absorbing everything already-known is a no-op — replays converge, never oscillate
    assert merge_progress_data(vector['key'], expected, vector['a']) == expected
    assert merge_progress_data(vector['key'], expected, vector['b']) == expected
    assert merge_progress_data(vector['key'], expected, expected) == expected


def test_merge_rejects_unknown_key():
    with pytest.raises(ValueError):
        merge_progress_data('nope', {}, {})


def test_days_between_calendar_math():
    assert days_between('2026-01-10', '2026-01-12') == 2
    assert days_between('2026-01-12', '2026-01-10') == -2
    assert days_between('2026-12-31', '2027-01-01') == 1
    assert days_between('garbage', '2026-01-01') > 365
