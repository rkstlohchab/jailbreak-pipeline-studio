#!/usr/bin/env python3
"""LoRA fine-tune a small open-weight model on an Alpaca JSONL file.

Primary path (GPU):     Unsloth + trl.SFTTrainer, 4-bit base, LoRA adapter.
Fallback path (CPU):    transformers + peft + trl with TinyLlama fp32.
Dry-run path (stdlib):  schema check only; does NOT import torch.

Typical Colab T4 (16 GB) invocation:

    python studio/scripts/train_lora.py \\
        --model unsloth/Llama-3.2-3B-Instruct-bnb-4bit \\
        --dataset studio/data/exports/alpaca.jsonl \\
        --output studio/data/finetunes/custom-llama3.2-3b \\
        --epochs 2 --lora-r 16 --lora-alpha 32 \\
        --batch-size 2 --grad-accum 4 \\
        --max-seq-length 2048

The adapter is saved to --output. Pass --merge to also save merged 16-bit
weights in a sibling '<output>-merged16' directory, which export_gguf.py
can then turn into a GGUF for Ollama.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Stdlib-only up here on purpose: `--dry-run` must not import torch.

REQUIRED_KEYS = ("instruction", "input", "output")

LORA_TARGET_MODULES = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="train_lora.py",
        description="LoRA fine-tune a small open-weight model on an Alpaca "
                    "JSONL dataset. Built for Google Colab's free T4 GPU "
                    "(16 GB VRAM) but runs on any CUDA GPU.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--model",
                   default="unsloth/Llama-3.2-3B-Instruct-bnb-4bit",
                   help="Base model slug (HF repo id). Use an Unsloth "
                        "`*-bnb-4bit` slug on Colab T4.")
    p.add_argument("--dataset",
                   default="studio/data/exports/alpaca.jsonl",
                   help="Path to an Alpaca JSONL "
                        "({instruction, input, output} per line).")
    p.add_argument("--output",
                   default="studio/data/finetunes/custom-llama3.2-3b",
                   help="Directory to write the LoRA adapter into.")
    p.add_argument("--epochs", type=float, default=2.0,
                   help="Number of passes over the dataset.")
    p.add_argument("--lora-r", type=int, default=16, help="LoRA rank.")
    p.add_argument("--lora-alpha", type=int, default=32,
                   help="LoRA alpha (scale).")
    p.add_argument("--lora-dropout", type=float, default=0.0)
    p.add_argument("--batch-size", type=int, default=2,
                   help="per_device_train_batch_size.")
    p.add_argument("--grad-accum", type=int, default=4,
                   help="gradient_accumulation_steps (effective batch = "
                        "batch_size * grad_accum).")
    p.add_argument("--max-seq-length", type=int, default=2048)
    p.add_argument("--learning-rate", type=float, default=2e-4)
    p.add_argument("--warmup-ratio", type=float, default=0.03)
    p.add_argument("--weight-decay", type=float, default=0.01)
    p.add_argument("--max-steps", type=int, default=-1,
                   help="Hard cap on optimizer steps (-1 = use --epochs).")
    p.add_argument("--seed", type=int, default=3407)
    p.add_argument("--chat-template", default=None,
                   help="Explicit unsloth chat_template name "
                        "(llama-3.1, chatml, qwen-2.5, mistral, gemma-2, "
                        "phi-3). Default: inferred from --model.")
    p.add_argument("--merge", action="store_true",
                   help="After training, also save merged 16-bit weights "
                        "to <output>-merged16 (feed to export_gguf.py).")
    p.add_argument("--dry-run", action="store_true",
                   help="Validate the dataset (keys, counts, first 3 rows) "
                        "without importing torch or loading a model.")
    p.add_argument("--cpu-debug", action="store_true",
                   help="Force a CPU fp32 TinyLlama smoke test "
                        "(overrides --model). For local pipeline checks.")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Dry run (stdlib only)
# ---------------------------------------------------------------------------

def _load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                rows.append(json.loads(raw))
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"{path}:{lineno}: invalid JSON: {exc.msg}"
                ) from exc
    return rows


def _validate_rows(rows: list[dict]) -> list[str]:
    problems: list[str] = []
    if not rows:
        return ["dataset has 0 records"]
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            problems.append(f"record {i}: not a JSON object")
            continue
        for key in REQUIRED_KEYS:
            if key not in row:
                problems.append(f"record {i}: missing key '{key}'")
        if "instruction" in row and not isinstance(row["instruction"], str):
            problems.append(f"record {i}: 'instruction' must be str")
        if "output" in row and not isinstance(row["output"], str):
            problems.append(f"record {i}: 'output' must be str")
        if "input" in row and row["input"] is not None \
                and not isinstance(row["input"], str):
            problems.append(f"record {i}: 'input' must be str or null")
        # cap how many problems we surface on bad datasets
        if len(problems) >= 25:
            problems.append("... (truncated)")
            break
    return problems


def do_dry_run(args: argparse.Namespace) -> int:
    path = Path(args.dataset).expanduser().resolve()
    if not path.exists():
        print(f"[dry-run] FAIL: dataset not found: {path}", file=sys.stderr)
        return 1
    print(f"[dry-run] reading {path}")
    try:
        rows = _load_jsonl(path)
    except ValueError as exc:
        print(f"[dry-run] FAIL: {exc}", file=sys.stderr)
        return 1
    print(f"[dry-run] loaded {len(rows)} record(s)")

    problems = _validate_rows(rows)
    if problems:
        for msg in problems:
            print(f"[dry-run] FAIL: {msg}", file=sys.stderr)
        return 1

    print(f"[dry-run] all records have required keys: "
          f"{tuple(REQUIRED_KEYS)}")
    print("[dry-run] preview — first 3 record(s):")
    for i, row in enumerate(rows[:3]):
        instr = (row.get("instruction") or "").replace("\n", " ")[:140]
        inp = (row.get("input") or "").replace("\n", " ")[:100]
        out = (row.get("output") or "").replace("\n", " ")[:140]
        print(f"  [{i}] instruction: {instr!r}")
        if inp:
            print(f"      input      : {inp!r}")
        print(f"      output     : {out!r}")

    print("[dry-run] OK")
    return 0


# ---------------------------------------------------------------------------
# Chat template auto-detect
# ---------------------------------------------------------------------------

def _pick_chat_template(model_slug: str) -> str:
    """Map an Unsloth model slug to an unsloth.chat_templates name."""
    s = model_slug.lower()
    if "llama-3.2" in s or "llama3.2" in s \
            or "llama-3.1" in s or "llama3.1" in s:
        return "llama-3.1"
    if "llama-3" in s or "llama3" in s:
        return "llama-3"
    if "qwen2.5" in s or "qwen-2.5" in s or "qwen3" in s:
        return "qwen-2.5"
    if "qwen" in s:
        return "qwen-2.5"
    if "mistral" in s:
        return "mistral"
    if "gemma-2" in s or "gemma2" in s:
        return "gemma-2"
    if "phi-3" in s or "phi3" in s:
        return "phi-3"
    if "tinyllama" in s:
        return "chatml"
    return "chatml"


# ---------------------------------------------------------------------------
# Row formatter — shared between GPU and CPU paths
# ---------------------------------------------------------------------------

def _make_formatter(tokenizer):
    def format_row(ex):
        instr = ex.get("instruction") or ""
        inp = ex.get("input") or ""
        user = instr if not inp else f"{instr}\n\n{inp}"
        convo = [
            {"role": "user", "content": user},
            {"role": "assistant", "content": ex.get("output") or ""},
        ]
        text = tokenizer.apply_chat_template(
            convo, tokenize=False, add_generation_prompt=False,
        )
        return {"text": text}
    return format_row


# ---------------------------------------------------------------------------
# GPU training (Unsloth)
# ---------------------------------------------------------------------------

def _train_gpu(args: argparse.Namespace,
               dataset_path: Path,
               output_dir: Path) -> int:
    from unsloth import FastLanguageModel, is_bfloat16_supported
    from unsloth.chat_templates import get_chat_template
    from datasets import load_dataset
    from trl import SFTConfig, SFTTrainer

    print(f"[train] loading base model: {args.model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=args.max_seq_length,
        dtype=None,            # auto: bf16 on Ampere+, fp16 on T4
        load_in_4bit=True,
    )

    print(f"[train] attaching LoRA (r={args.lora_r}, "
          f"alpha={args.lora_alpha}, dropout={args.lora_dropout})")
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        target_modules=LORA_TARGET_MODULES,
        use_gradient_checkpointing="unsloth",
        random_state=args.seed,
        use_rslora=False,
        loftq_config=None,
    )

    template_name = args.chat_template or _pick_chat_template(args.model)
    print(f"[train] chat template: {template_name}")
    tokenizer = get_chat_template(tokenizer, chat_template=template_name)

    print(f"[train] loading dataset: {dataset_path}")
    raw = load_dataset(
        "json",
        data_files=str(dataset_path),
        split="train",
    )
    format_row = _make_formatter(tokenizer)
    ds = raw.map(format_row, remove_columns=raw.column_names)
    print(f"[train] dataset size: {len(ds)}")

    eos = tokenizer.eos_token or ""
    if eos:
        def _ensure_eos(ex):
            t = ex["text"]
            return {"text": t if t.endswith(eos) else t + eos}
        ds = ds.map(_ensure_eos)

    bf16 = is_bfloat16_supported()
    sft_cfg = SFTConfig(
        output_dir=str(output_dir / "trainer_state"),
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        num_train_epochs=args.epochs if args.max_steps < 0 else 1,
        max_steps=args.max_steps,
        learning_rate=args.learning_rate,
        warmup_ratio=args.warmup_ratio,
        weight_decay=args.weight_decay,
        lr_scheduler_type="cosine",
        fp16=not bf16,
        bf16=bf16,
        optim="adamw_8bit",
        logging_steps=1,
        save_strategy="no",
        seed=args.seed,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        packing=False,
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        args=sft_cfg,
    )

    eff_batch = args.batch_size * args.grad_accum
    print(f"[train] starting training "
          f"(epochs={args.epochs}, effective_batch={eff_batch}, "
          f"lr={args.learning_rate}, bf16={bf16})")
    trainer.train()

    print(f"[train] saving LoRA adapter -> {output_dir}")
    model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    if args.merge:
        merged_dir = output_dir.with_name(output_dir.name + "-merged16")
        print(f"[train] merging LoRA into base + saving 16-bit -> "
              f"{merged_dir}")
        model.save_pretrained_merged(
            str(merged_dir),
            tokenizer,
            save_method="merged_16bit",
        )

    print("[train] done.")
    return 0


# ---------------------------------------------------------------------------
# CPU debug training (vanilla stack, TinyLlama)
# ---------------------------------------------------------------------------

def _train_cpu_debug(args: argparse.Namespace,
                     dataset_path: Path,
                     output_dir: Path) -> int:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig, get_peft_model
    from trl import SFTConfig, SFTTrainer
    from datasets import load_dataset

    model_slug = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    print(f"[train/cpu] loading {model_slug} in fp32 (debug smoke test)")
    tokenizer = AutoTokenizer.from_pretrained(model_slug)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        model_slug, torch_dtype=torch.float32,
    )

    peft_cfg = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        target_modules=LORA_TARGET_MODULES,
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_cfg)

    raw = load_dataset(
        "json",
        data_files=str(dataset_path),
        split="train",
    )
    format_row = _make_formatter(tokenizer)
    ds = raw.map(format_row, remove_columns=raw.column_names)
    print(f"[train/cpu] dataset size: {len(ds)} (expect this to be slow)")

    max_steps_cap = 4
    sft_cfg = SFTConfig(
        output_dir=str(output_dir / "trainer_state"),
        per_device_train_batch_size=1,
        gradient_accumulation_steps=1,
        num_train_epochs=min(args.epochs, 1.0),
        max_steps=(min(args.max_steps, max_steps_cap)
                   if args.max_steps > 0 else max_steps_cap),
        learning_rate=args.learning_rate,
        logging_steps=1,
        save_strategy="no",
        seed=args.seed,
        dataset_text_field="text",
        max_seq_length=min(args.max_seq_length, 512),
        packing=False,
        report_to="none",
    )
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        args=sft_cfg,
    )
    trainer.train()
    model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    print(f"[train/cpu] CPU debug fine-tune saved -> {output_dir}")
    return 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_training(args: argparse.Namespace) -> int:
    import torch  # torch is only imported here, never during --dry-run

    has_cuda = torch.cuda.is_available()
    if not has_cuda and not args.cpu_debug:
        print("[train] FAIL: no CUDA GPU detected. Run this on Colab's "
              "T4 runtime (Runtime -> Change runtime type -> GPU) or pass "
              "--cpu-debug for a TinyLlama fp32 smoke test.",
              file=sys.stderr)
        return 2

    dataset_path = Path(args.dataset).expanduser().resolve()
    if not dataset_path.exists():
        print(f"[train] FAIL: dataset not found: {dataset_path}",
              file=sys.stderr)
        return 1

    output_dir = Path(args.output).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.cpu_debug:
        return _train_cpu_debug(args, dataset_path, output_dir)
    return _train_gpu(args, dataset_path, output_dir)


def main() -> int:
    args = parse_args()
    if args.dry_run:
        return do_dry_run(args)
    return run_training(args)


if __name__ == "__main__":
    raise SystemExit(main())
