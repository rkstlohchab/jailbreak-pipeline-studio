#!/usr/bin/env python3
"""Merge a LoRA adapter into its base model and convert to GGUF for Ollama.

Pipeline:
    adapter_dir + base_slug  --[peft.merge_and_unload]-->  merged 16-bit HF
    merged HF                --[llama.cpp convert_hf_to_gguf.py]-->  f16 GGUF
    f16 GGUF                 --[llama.cpp llama-quantize]-->  q4_k_m GGUF
    (prints Modelfile template)

Typical use:

    python studio/scripts/export_gguf.py \\
        --adapter studio/data/finetunes/custom-llama3.2-3b \\
        --base    unsloth/Llama-3.2-3B-Instruct \\
        --output  studio/data/finetunes/custom-llama3.2-3b.gguf \\
        --quant   q4_k_m

Important: --base should be the full-precision (NOT the `-bnb-4bit`) slug,
because we need real fp16 weights to merge the LoRA deltas into.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


VALID_QUANTS = (
    "f32", "f16",
    "q8_0",
    "q6_k",
    "q5_k_m", "q5_k_s", "q5_0", "q5_1",
    "q4_k_m", "q4_k_s", "q4_0", "q4_1",
    "q3_k_l", "q3_k_m", "q3_k_s",
    "q2_k",
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="export_gguf.py",
        description="Merge a LoRA adapter into its base model and export a "
                    "GGUF file suitable for Ollama / llama.cpp.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--adapter", required=True,
                   help="LoRA adapter directory (holds adapter_config.json "
                        "+ adapter_model.safetensors). Produced by "
                        "train_lora.py.")
    p.add_argument("--base", required=True,
                   help="Base model repo id or local path. Use the "
                        "full-precision slug, NOT the -bnb-4bit variant, "
                        "e.g. unsloth/Llama-3.2-3B-Instruct.")
    p.add_argument("--output", required=True,
                   help="Destination .gguf file path.")
    p.add_argument("--quant", default="q4_k_m", choices=VALID_QUANTS,
                   help="llama.cpp quantization method.")
    p.add_argument("--llama-cpp",
                   default=os.environ.get("LLAMA_CPP_DIR", "llama.cpp"),
                   help="Path to a llama.cpp checkout (must contain "
                        "convert_hf_to_gguf.py and a built llama-quantize "
                        "binary). Clone: "
                        "`git clone https://github.com/ggerganov/llama.cpp`, "
                        "then `cmake -B build && cmake --build build -j`.")
    p.add_argument("--merged-dir", default=None,
                   help="Where to save the merged 16-bit HF weights. "
                        "Default: a temporary directory that is deleted "
                        "after the GGUF is written.")
    p.add_argument("--keep-merged", action="store_true",
                   help="Keep the merged HF weights after export.")
    p.add_argument("--skip-merge", action="store_true",
                   help="Skip the merge step (--merged-dir already holds "
                        "merged HF weights).")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Step 1: merge LoRA into base (peft + transformers)
# ---------------------------------------------------------------------------

def _merge(args: argparse.Namespace, merged_dir: Path) -> None:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel

    print(f"[merge] loading base model: {args.base}")
    base = AutoModelForCausalLM.from_pretrained(
        args.base, torch_dtype=torch.float16, low_cpu_mem_usage=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(args.base)

    print(f"[merge] attaching adapter: {args.adapter}")
    wrapped = PeftModel.from_pretrained(base, args.adapter)

    print("[merge] merge_and_unload ...")
    merged = wrapped.merge_and_unload()

    merged_dir.mkdir(parents=True, exist_ok=True)
    print(f"[merge] saving merged 16-bit HF weights -> {merged_dir}")
    merged.save_pretrained(str(merged_dir), safe_serialization=True)
    tokenizer.save_pretrained(str(merged_dir))


# ---------------------------------------------------------------------------
# Step 2: HF -> GGUF -> quantized GGUF (llama.cpp)
# ---------------------------------------------------------------------------

def _find_convert(llama_cpp: Path) -> Path:
    for name in ("convert_hf_to_gguf.py", "convert-hf-to-gguf.py"):
        candidate = llama_cpp / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        f"convert_hf_to_gguf.py not found under {llama_cpp}.\n"
        "  git clone https://github.com/ggerganov/llama.cpp\n"
        "  cd llama.cpp && pip install -r requirements.txt\n"
        "then pass --llama-cpp <path>."
    )


def _find_quantize(llama_cpp: Path) -> Path:
    candidates = [
        llama_cpp / "build" / "bin" / "llama-quantize",
        llama_cpp / "llama-quantize",
        llama_cpp / "build" / "bin" / "quantize",
        llama_cpp / "quantize",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        f"llama-quantize binary not found under {llama_cpp}.\n"
        f"Build it:\n"
        f"  cd {llama_cpp} && cmake -B build && cmake --build build -j"
    )


def _convert_and_quantize(args: argparse.Namespace,
                          merged_dir: Path,
                          out_gguf: Path) -> None:
    llama_cpp = Path(args.llama_cpp).expanduser().resolve()
    convert = _find_convert(llama_cpp)

    fp16_gguf = out_gguf.with_name(out_gguf.stem + ".f16.gguf")
    print(f"[gguf] {convert.name}: {merged_dir} -> {fp16_gguf}")
    subprocess.check_call([
        sys.executable, str(convert),
        str(merged_dir),
        "--outfile", str(fp16_gguf),
        "--outtype", "f16",
    ])

    if args.quant == "f16":
        shutil.move(str(fp16_gguf), str(out_gguf))
        return

    quantize = _find_quantize(llama_cpp)
    print(f"[gguf] llama-quantize: {args.quant} -> {out_gguf}")
    subprocess.check_call([
        str(quantize), str(fp16_gguf), str(out_gguf), args.quant,
    ])
    # Clean up the intermediate fp16 file.
    try:
        fp16_gguf.unlink()
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Step 3: print Modelfile template
# ---------------------------------------------------------------------------

def _print_modelfile(out_gguf: Path) -> None:
    model_name = out_gguf.stem
    bar = "=" * 72
    print()
    print(bar)
    print("Modelfile template")
    print("  Save the block below as a file named `Modelfile` next to")
    print(f"  {out_gguf.name}, then:")
    print(f"      ollama create {model_name} -f Modelfile")
    print(f"      ollama run    {model_name}")
    print(bar)
    print(f"""FROM ./{out_gguf.name}

# The chat template is already embedded in the GGUF metadata.
# Override only if you trained with a different template than the base model.

PARAMETER temperature 0.7
PARAMETER top_p       0.9
PARAMETER num_ctx     4096

# Optional default system prompt:
# SYSTEM \"\"\"You are a concise, helpful assistant.\"\"\"
""")
    print(bar)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    args = parse_args()

    out_gguf = Path(args.output).expanduser().resolve()
    out_gguf.parent.mkdir(parents=True, exist_ok=True)

    adapter_dir = Path(args.adapter).expanduser().resolve()
    if not args.skip_merge and not adapter_dir.exists():
        print(f"[export] FAIL: adapter dir not found: {adapter_dir}",
              file=sys.stderr)
        return 1

    if args.merged_dir:
        merged_dir = Path(args.merged_dir).expanduser().resolve()
        cleanup = False
    else:
        merged_dir = Path(tempfile.mkdtemp(prefix="merged-"))
        cleanup = not args.keep_merged

    try:
        if not args.skip_merge:
            _merge(args, merged_dir)
        elif not merged_dir.exists():
            print(f"[export] FAIL: --skip-merge but {merged_dir} missing",
                  file=sys.stderr)
            return 1

        _convert_and_quantize(args, merged_dir, out_gguf)
    finally:
        if cleanup and merged_dir.exists():
            shutil.rmtree(merged_dir, ignore_errors=True)

    size_mib = out_gguf.stat().st_size / (1 << 20)
    print(f"[export] wrote {out_gguf} ({size_mib:.1f} MiB, quant={args.quant})")
    _print_modelfile(out_gguf)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
