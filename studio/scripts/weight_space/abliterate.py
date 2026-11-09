#!/usr/bin/env python3
"""
Abliteration — Arditi et al. 2024, "Refusal in Language Models is Mediated by
a Single Direction" (https://arxiv.org/abs/2406.11717).

Pipeline:
  1. Run `--dataset-a` (e.g. harmful requests) and `--dataset-b` (benign
     baseline) through the model and cache last-token residual-stream
     activations at every decoder layer.
  2. Compute the per-layer mean-difference direction `d = μ_a - μ_b`.
     With `--layer auto`, pick the layer where `||d||` is largest.
  3. Orthogonalize every attention `o_proj` and MLP `down_proj` weight
     against the chosen unit direction: `W := W - d (dᵀ W)`. Each
     residual-stream writer loses its component along `d`, so no layer
     can ever add that direction back.
  4. Save the modified model (`model.save_pretrained`) + tokenizer to
     `--output`. Weights-only edit, no fine-tuning, no retraining.

Reference open-source implementation: FailSpy/abliterator
(https://github.com/FailSpy/abliterator) — we match its target modules
(attn.W_O, mlp.W_out) and projection formula, translated to the HF naming
convention (self_attn.o_proj, mlp.down_proj).

Target hardware: Colab T4 (16 GB). Batch size 8 fits Llama-3.2-3B fp16
with activation hooks live; CUDA cache is released between batches.

Dry-run contract: `--dry-run` validates arguments and prompt files
without importing torch or transformers.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="abliterate",
        description=(
            "Arditi 2024 single-direction abliteration for open-weight HF "
            "chat models. Permanent, weights-only edit."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument(
        "--model",
        required=True,
        help="HF hub id or local path, e.g. unsloth/Llama-3.2-3B-Instruct.",
    )
    ap.add_argument(
        "--dataset-a",
        required=True,
        help=(
            "Text file: one prompt per line, blanks and `#` comments ignored. "
            "Set A is the behavior to erase (harmful / refused prompts)."
        ),
    )
    ap.add_argument(
        "--dataset-b",
        required=True,
        help="Text file, same format. Set B is the baseline (benign prompts).",
    )
    ap.add_argument(
        "--layer",
        default="auto",
        help=(
            "`auto` picks the layer with the largest ||mean_a - mean_b||. "
            "An integer picks that specific layer index."
        ),
    )
    ap.add_argument(
        "--output",
        required=True,
        help="Destination directory for save_pretrained() of the modified model.",
    )
    ap.add_argument(
        "--batch-size",
        type=int,
        default=8,
        help="Prompts per forward pass during activation collection.",
    )
    ap.add_argument(
        "--max-len",
        type=int,
        default=256,
        help="Max tokenized length per prompt.",
    )
    ap.add_argument(
        "--dtype",
        default="float16",
        choices=["float16", "bfloat16", "float32"],
        help="Model load dtype. fp16 default for T4.",
    )
    ap.add_argument(
        "--device",
        default=None,
        help="Override auto device selection (`cuda` / `cpu` / `mps`).",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate args + prompt files and exit. Does not import torch.",
    )
    ap.add_argument(
        "--seed",
        type=int,
        default=0,
        help="torch manual seed (for reproducibility of tokenization order).",
    )
    return ap


def _validate_prompts(path: str) -> int:
    """File-level validation. Returns the number of prompt lines."""
    from _activations import load_prompts  # local module

    prompts = load_prompts(path)
    too_long = [i for i, p in enumerate(prompts) if len(p) > 2048]
    if too_long:
        print(
            f"[warn] {path}: {len(too_long)} prompts > 2048 chars "
            "(will be truncated by --max-len tokenization)",
            file=sys.stderr,
        )
    return len(prompts)


def _resolve_layer(flag: str):
    """Parse `--layer` into `'auto'` or an int."""
    if flag == "auto":
        return "auto"
    try:
        return int(flag)
    except ValueError:
        raise SystemExit(f"--layer must be 'auto' or an integer, got {flag!r}")


def _dry_run(args) -> int:
    """Validate everything cheap without loading torch. Returns an exit code."""
    print(f"[dry-run] model id: {args.model}")

    n_a = _validate_prompts(args.dataset_a)
    print(f"[dry-run] dataset-a: {args.dataset_a} ({n_a} prompts)")

    n_b = _validate_prompts(args.dataset_b)
    print(f"[dry-run] dataset-b: {args.dataset_b} ({n_b} prompts)")

    if n_a < 8 or n_b < 8:
        print(
            "[warn] fewer than 8 prompts in a set — mean estimate will be noisy",
            file=sys.stderr,
        )

    layer = _resolve_layer(args.layer)
    print(f"[dry-run] layer: {layer}")

    out = Path(args.output)
    if out.exists() and any(out.iterdir()):
        print(f"[warn] output {out} is non-empty — save_pretrained will overwrite")
    else:
        print(f"[dry-run] output will be created: {out}")

    print(
        f"[dry-run] dtype={args.dtype}  batch_size={args.batch_size}  "
        f"max_len={args.max_len}"
    )
    print("[dry-run] OK — arguments and prompt files valid")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    # Make `_activations` importable when invoked as a script.
    sys.path.insert(0, str(Path(__file__).resolve().parent))

    if args.dry_run:
        return _dry_run(args)

    # Heavy imports happen only in the real run.
    import torch
    from _activations import (
        collect_activations,
        compute_direction,
        default_device,
        iter_orthogonalize_targets,
        layer_norm_table,
        load_model_and_tokenizer,
        load_prompts,
        orthogonalize_matrix_,
        pick_best_layer,
    )

    torch.manual_seed(args.seed)
    device = args.device or default_device()
    print(f"[init] device={device}  dtype={args.dtype}")

    prompts_a = load_prompts(args.dataset_a)
    prompts_b = load_prompts(args.dataset_b)
    print(f"[init] dataset-a: {len(prompts_a)}  dataset-b: {len(prompts_b)}")

    print(f"[load] {args.model}")
    t0 = time.time()
    model, tokenizer = load_model_and_tokenizer(args.model, device, args.dtype)
    print(f"[load] done in {time.time() - t0:.1f}s")
    print(
        f"[load] hidden_size={model.config.hidden_size}  "
        f"num_layers={model.config.num_hidden_layers}"
    )

    print(f"[collect-a] {len(prompts_a)} prompts, batch={args.batch_size}")
    acts_a = collect_activations(
        model, tokenizer, prompts_a,
        max_len=args.max_len, batch_size=args.batch_size,
    )
    print(f"[collect-b] {len(prompts_b)} prompts, batch={args.batch_size}")
    acts_b = collect_activations(
        model, tokenizer, prompts_b,
        max_len=args.max_len, batch_size=args.batch_size,
    )

    # Report per-layer norms, pick the layer.
    print("\n  layer      ||μ_a − μ_b||")
    for i, n in layer_norm_table(acts_a, acts_b):
        print(f"  {i:>5}    {n:>12.3f}")

    layer_flag = _resolve_layer(args.layer)
    if layer_flag == "auto":
        layer = pick_best_layer(acts_a, acts_b)
        print(f"\n[layer] auto -> {layer} (peak norm)")
    else:
        layer = layer_flag
        n_layers = model.config.num_hidden_layers
        if not 0 <= layer < n_layers:
            raise SystemExit(f"--layer {layer} out of range [0, {n_layers})")
        print(f"\n[layer] manual -> {layer}")

    direction = compute_direction(acts_a, acts_b, layer)
    print(f"[dir] shape={tuple(direction.shape)}  ||d||={direction.norm().item():.4f}")

    # Free the activation tensors before editing weights.
    del acts_a, acts_b
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    # Orthogonalize every residual-stream writer in-place.
    print("[orth] projecting o_proj and down_proj against direction")
    edited = 0
    for name, weight in iter_orthogonalize_targets(model):
        orthogonalize_matrix_(weight, direction)
        edited += 1
    print(f"[orth] edited {edited} matrices")

    # Save.
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    print(f"[save] {out}")
    model.save_pretrained(out)
    tokenizer.save_pretrained(out)

    meta = {
        "method": "arditi2024_abliteration",
        "base_model": args.model,
        "layer": layer,
        "direction_norm": float(direction.norm().item()),
        "n_dataset_a": len(prompts_a),
        "n_dataset_b": len(prompts_b),
        "dtype": args.dtype,
        "edited_matrices": edited,
        "timestamp": int(time.time()),
    }
    (out / "abliteration_meta.json").write_text(json.dumps(meta, indent=2))
    print(f"[save] wrote abliteration_meta.json")
    print("[done]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
