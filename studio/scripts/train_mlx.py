"""LoRA fine-tune on Apple Silicon via MLX.

Mirrors `train_lora.py` but uses `mlx-lm` instead of Unsloth, so it runs on
M1/M2/M3/M4 Macs without CUDA. Reads the same alpaca-format JSONL that the
studio's /dataset page exports.

Install:
    pip install mlx-lm

Quickstart:
    python train_mlx.py \\
      --model mlx-community/Llama-3.2-3B-Instruct-4bit \\
      --dataset studio/data/exports/alpaca.jsonl \\
      --output studio/data/finetunes/custom-llama3.2-3b-mlx \\
      --iters 500 --lora-layers 16 --batch-size 2

Notes:
  - `--dataset` is converted in place to MLX's expected format (one JSON object
    per line with a "text" field), written to <output>/train.jsonl before mlx_lm
    is invoked.
  - 3B 4-bit quantized model trains comfortably on 16 GB unified memory.
  - 1B base (Llama-3.2-1B) runs on 8 GB machines.
  - `--dry-run` validates arguments + dataset shape without importing mlx.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


DEFAULTS = {
    "model": "mlx-community/Llama-3.2-3B-Instruct-4bit",
    "iters": 500,
    "lora_layers": 16,
    "batch_size": 2,
    "learning_rate": 1e-5,
    "max_seq_length": 2048,
    "save_every": 100,
}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="train_mlx",
        description="LoRA fine-tune on Apple Silicon via mlx-lm.",
    )
    p.add_argument("--model", default=DEFAULTS["model"],
                   help="MLX-format model id (or local path). "
                        "Browse mlx-community/* on HuggingFace for pre-quantized options.")
    p.add_argument("--dataset", required=True,
                   help="Path to alpaca.jsonl ({instruction, input, output} per line).")
    p.add_argument("--output", required=True,
                   help="Directory to write LoRA adapters + formatted dataset.")
    p.add_argument("--iters", type=int, default=DEFAULTS["iters"],
                   help="Training iterations. 500 is a reasonable floor; 1000-2000 for stronger adaptation.")
    p.add_argument("--lora-layers", type=int, default=DEFAULTS["lora_layers"],
                   help="How many transformer layers to attach LoRA to (-1 for all).")
    p.add_argument("--batch-size", type=int, default=DEFAULTS["batch_size"])
    p.add_argument("--learning-rate", type=float, default=DEFAULTS["learning_rate"])
    p.add_argument("--max-seq-length", type=int, default=DEFAULTS["max_seq_length"])
    p.add_argument("--save-every", type=int, default=DEFAULTS["save_every"],
                   help="Checkpoint interval (iters).")
    p.add_argument("--chat-template", default="llama3",
                   choices=["llama3", "chatml", "none"],
                   help="How to format alpaca rows into a chat prompt. 'none' means raw instruction+input+output concatenation.")
    p.add_argument("--merge", action="store_true",
                   help="After training, fuse LoRA into the base model and write the merged weights to <output>/merged/.")
    p.add_argument("--dry-run", action="store_true",
                   help="Validate args + dataset; skip model/mlx import.")
    return p.parse_args(argv)


def _format_alpaca_row(row: dict, template: str) -> str:
    """Format one alpaca record into a single training string."""
    instruction = (row.get("instruction") or "").strip()
    inp = (row.get("input") or "").strip()
    output = (row.get("output") or "").strip()
    user = instruction + (f"\n\n{inp}" if inp else "")

    if template == "llama3":
        return (
            "<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n"
            f"{user}<|eot_id|>"
            "<|start_header_id|>assistant<|end_header_id|>\n\n"
            f"{output}<|eot_id|>"
        )
    if template == "chatml":
        return (
            f"<|im_start|>user\n{user}<|im_end|>\n"
            f"<|im_start|>assistant\n{output}<|im_end|>"
        )
    return f"{user}\n\n{output}"


def _convert_dataset(src: Path, dst: Path, template: str) -> tuple[int, int]:
    """Convert alpaca.jsonl -> mlx-lm's {"text": ...} per line. Returns (n_ok, n_skipped)."""
    n_ok = 0
    n_skip = 0
    with src.open("r", encoding="utf-8") as fin, dst.open("w", encoding="utf-8") as fout:
        for i, line in enumerate(fin, 1):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                n_skip += 1
                continue
            if not any(k in row for k in ("instruction", "output")):
                n_skip += 1
                continue
            text = _format_alpaca_row(row, template)
            fout.write(json.dumps({"text": text}) + "\n")
            n_ok += 1
    return n_ok, n_skip


def _validate_dataset(path: Path) -> tuple[int, list[str]]:
    """Return (record_count, issues[])."""
    issues: list[str] = []
    if not path.exists():
        issues.append(f"Dataset file does not exist: {path}")
        return 0, issues
    n = 0
    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as e:
                issues.append(f"line {i}: invalid JSON ({e})")
                continue
            if not isinstance(row, dict):
                issues.append(f"line {i}: not an object")
                continue
            if "instruction" not in row and "output" not in row:
                issues.append(f"line {i}: missing both 'instruction' and 'output'")
                continue
            n += 1
    return n, issues


def dry_run(args: argparse.Namespace) -> int:
    ds_path = Path(args.dataset)
    n, issues = _validate_dataset(ds_path)
    print(f"[dry-run] dataset: {ds_path}")
    print(f"[dry-run] records: {n}")
    if issues:
        print(f"[dry-run] issues ({len(issues)}):")
        for msg in issues[:20]:
            print(f"  - {msg}")
        if len(issues) > 20:
            print(f"  ... and {len(issues) - 20} more")
    print(f"[dry-run] model: {args.model}")
    print(f"[dry-run] output: {args.output}")
    print(f"[dry-run] iters={args.iters} lora_layers={args.lora_layers} batch_size={args.batch_size} lr={args.learning_rate}")
    print("[dry-run] mlx_lm NOT imported.")
    return 0 if n > 0 else 1


def run(args: argparse.Namespace) -> int:
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1) Convert dataset into mlx-lm's expected format.
    #    mlx-lm's `lora` script looks for {train,valid,test}.jsonl in --data <dir>
    data_dir = out_dir / "mlx_data"
    data_dir.mkdir(exist_ok=True)
    train_path = data_dir / "train.jsonl"
    valid_path = data_dir / "valid.jsonl"
    n_ok, n_skip = _convert_dataset(Path(args.dataset), train_path, args.chat_template)
    if n_ok == 0:
        print(f"[error] no usable records after conversion (skipped={n_skip})", file=sys.stderr)
        return 2
    # Simple 90/10 split via moving the last 10% into valid.jsonl
    lines = train_path.read_text(encoding="utf-8").splitlines()
    cut = max(1, len(lines) // 10)
    train_lines, valid_lines = lines[:-cut], lines[-cut:]
    train_path.write_text("\n".join(train_lines) + "\n", encoding="utf-8")
    valid_path.write_text("\n".join(valid_lines) + "\n", encoding="utf-8")
    print(f"[data] formatted {n_ok} rows (skip={n_skip}) → train={len(train_lines)} valid={len(valid_lines)}")

    # 2) Run mlx_lm.lora CLI.
    adapter_dir = out_dir / "adapters"
    adapter_dir.mkdir(exist_ok=True)
    cmd = [
        sys.executable, "-m", "mlx_lm", "lora",
        "--model", args.model,
        "--train",
        "--data", str(data_dir),
        "--iters", str(args.iters),
        "--batch-size", str(args.batch_size),
        "--learning-rate", str(args.learning_rate),
        "--adapter-path", str(adapter_dir),
        "--num-layers", str(args.lora_layers),
        "--save-every", str(args.save_every),
        "--max-seq-length", str(args.max_seq_length),
    ]
    print(f"[train] {' '.join(cmd)}")
    rc = subprocess.call(cmd)
    if rc != 0:
        print(f"[error] mlx_lm.lora exited with {rc}", file=sys.stderr)
        return rc
    print(f"[train] adapters saved to {adapter_dir}")

    # 3) Optional merge/fuse.
    if args.merge:
        merged_dir = out_dir / "merged"
        merged_dir.mkdir(exist_ok=True)
        fuse_cmd = [
            sys.executable, "-m", "mlx_lm", "fuse",
            "--model", args.model,
            "--adapter-path", str(adapter_dir),
            "--save-path", str(merged_dir),
        ]
        print(f"[fuse] {' '.join(fuse_cmd)}")
        rc = subprocess.call(fuse_cmd)
        if rc != 0:
            print(f"[error] mlx_lm.fuse exited with {rc}", file=sys.stderr)
            return rc
        print(f"[fuse] merged weights at {merged_dir}")

    # 4) Hint on inference.
    print()
    print("[next] test the adapter with:")
    print(f"  python -m mlx_lm.generate --model {args.model} "
          f"--adapter-path {adapter_dir} --prompt 'your test prompt'")
    if args.merge:
        print(f"[next] or run the merged model directly:")
        print(f"  python -m mlx_lm.generate --model {args.output}/merged --prompt 'your test prompt'")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.dry_run:
        return dry_run(args)

    # Preflight: mlx-lm installed?
    try:
        import mlx_lm  # noqa: F401
    except ImportError:
        print("[error] mlx-lm not installed. Run: pip install mlx-lm", file=sys.stderr)
        return 3

    return run(args)


if __name__ == "__main__":
    sys.exit(main())
