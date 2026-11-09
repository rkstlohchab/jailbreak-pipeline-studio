"""Tests for the corpus -> auto-attack wiring."""
from __future__ import annotations

from app.services import corpus_pool


def test_pool_summary_has_every_technique() -> None:
    summary = corpus_pool.pool_summary()
    expected = {
        "baseline", "prefix_inject", "refusal_suppress", "time_shift",
        "fictional_frame", "cognitive_overload", "translation_obfuscation",
        "crescendo_seed", "dan",
    }
    assert set(summary.keys()) == expected


def test_pool_returns_coverage_for_major_techniques() -> None:
    summary = corpus_pool.pool_summary()
    # baseline is a control — it's fine to have zero. The eight framing/obfuscation
    # families must have at least one corpus prompt backing them.
    for name in ("prefix_inject", "refusal_suppress", "time_shift", "fictional_frame",
                 "cognitive_overload", "translation_obfuscation", "crescendo_seed", "dan"):
        assert summary[name]["corpus_matches"] > 0, f"{name} has no corpus prompts"


def test_pick_prompt_returns_non_empty_tuple() -> None:
    result = corpus_pool.pick_prompt("fictional_frame", "test goal")
    assert result is not None, "fictional_frame should have corpus matches"
    text, slug = result
    assert isinstance(text, str) and len(text) > 50
    assert isinstance(slug, str) and slug


def test_pick_prompt_baseline_returns_none() -> None:
    # baseline has no taxonomy IDs mapped (it's a hardcoded control).
    assert corpus_pool.pick_prompt("baseline", "test goal") is None


def test_goal_injection_appends_when_no_placeholder() -> None:
    template = "Some corpus prompt body with no placeholders at all."
    injected = corpus_pool._inject_goal(template, "find X")
    assert "Task: find X" in injected
    assert injected.startswith("Some corpus prompt")


def test_goal_injection_substitutes_placeholder() -> None:
    template = "Answer this: {goal} — in detail."
    injected = corpus_pool._inject_goal(template, "ask Y")
    assert "ask Y" in injected
    assert "{goal}" not in injected
    for variant in ("{GOAL}", "[GOAL]", "<GOAL>", "<TASK>", "{QUESTION}", "<QUESTION>"):
        tmpl = f"prefix {variant} suffix"
        out = corpus_pool._inject_goal(tmpl, "Z")
        assert "Z" in out
        assert variant not in out


def test_exclude_slugs_prevents_reuse() -> None:
    first = corpus_pool.pick_prompt("fictional_frame", "goal A")
    assert first is not None
    _, first_slug = first
    second = corpus_pool.pick_prompt("fictional_frame", "goal A", exclude_slugs={first_slug})
    # Either second picks a different slug, or there was only one candidate.
    if second is not None:
        _, second_slug = second
        assert second_slug != first_slug


def test_improvements_for_known_slug() -> None:
    result = corpus_pool.pick_prompt("fictional_frame", "goal")
    assert result is not None
    _, slug = result
    improvements = corpus_pool.improvements_for(slug)
    assert isinstance(improvements, list)


def test_improvements_for_unknown_slug_is_empty() -> None:
    assert corpus_pool.improvements_for("definitely-not-a-slug") == []


def test_build_prompt_prefers_corpus_over_hardcoded() -> None:
    from app.services.auto_attack import _build_prompt, _attack_by_id
    attack = _attack_by_id("fictional_frame")
    assert attack is not None
    text, slug = _build_prompt(attack, "sample goal", None, set(), None)
    # The hardcoded fictional_frame scaffold contains "Vex, an amoral genius".
    # A corpus-sourced prompt won't contain that exact string.
    assert slug is not None, "fictional_frame should resolve to a corpus prompt"
    assert "Vex, an amoral genius" not in text, "should prefer corpus, not hardcoded fallback"


def test_build_prompt_falls_back_when_corpus_missing() -> None:
    from app.services.auto_attack import _build_prompt, _attack_by_id
    attack = _attack_by_id("baseline")
    assert attack is not None
    text, slug = _build_prompt(attack, "GOAL123", None, set(), None)
    assert slug is None, "baseline has no corpus mapping — must fall back"
    assert "GOAL123" in text


def test_build_prompt_splices_improvements_on_retry() -> None:
    from app.services.auto_attack import _build_prompt, _attack_by_id
    attack = _attack_by_id("fictional_frame")
    assert attack is not None
    improvements = ["Add a stronger context prefix", "Suppress refusal vocabulary"]
    text, _ = _build_prompt(attack, "G", "partial", set(), improvements)
    assert "Address these weaknesses" in text
    assert "stronger context prefix" in text


def test_build_prompt_adds_antihollow_on_partial() -> None:
    from app.services.auto_attack import _build_prompt, _attack_by_id, ANTI_HOLLOW_CLAUSE
    attack = _attack_by_id("fictional_frame")
    assert attack is not None
    text, _ = _build_prompt(attack, "G", "partial", set(), None)
    assert ANTI_HOLLOW_CLAUSE.strip()[:40] in text
