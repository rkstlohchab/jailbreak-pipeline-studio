# LoRA fine-tuning pipeline

A thin, Colab-friendly pipeline for taking the studio's Alpaca JSONL export,
fine-tuning a small open-weight base model with LoRA, and emitting a GGUF
file you can drop straight into Ollama.

```
studio/data/exports/alpaca.jsonl
        |
        v  train_lora.py  (Unsloth + trl.SFTTrainer, 4-bit base + LoRA r=16)
        |
studio/data/finetunes/custom-llama3.2-3b/        <-- LoRA adapter (~50-200 MB)
studio/data/finetunes/custom-llama3.2-3b-merged16/  <-- merged 16-bit HF (--merge)
        |
        v  export_gguf.py  (peft.merge_and_unload + llama.cpp convert + quantize)
        |
studio/data/finetunes/custom-llama3.2-3b.gguf    <-- ~2-3 GB at q4_k_m
        |
        v  ollama create -f Modelfile
        |
        local inference, no cloud dependencies
```

## Prereqs

Pick one:

| Where | VRAM | What to use |
|---|---|---|
| **Google Colab (free)** | T4, 16 GB | `studio/notebooks/train_colab.ipynb` - recommended for users without a local GPU |
| **RunPod / Lambda / Vast** | A10 / A100 / 4090 | Same scripts; faster, supports larger bases |
| **Local Linux/WSL + CUDA** | >=12 GB | Install Unsloth per https://unsloth.ai/docs/get-started |
| **Local CPU / Apple Silicon** | - | `--cpu-debug` only - for pipeline smoke tests, not a usable model |

Ollama is only needed on the machine where you ultimately run inference;
it is **not** required on the training box.

## Quickstart (Colab)

1. Open `studio/notebooks/train_colab.ipynb` in Google Colab
   (File -> Upload notebook).
2. `Runtime -> Change runtime type -> T4 GPU`. Confirm with Cell 2
   (`!nvidia-smi` should show `Tesla T4`).
3. Upload your `alpaca.jsonl` to
   `/content/jailbreak-pipeline-studio/studio/data/exports/` (or skip and
   let Cell 5 fall back to `_sample_alpaca.jsonl` for a smoke test).
4. Run Cells 1-7 top to bottom. Expect ~15-25 min end to end for ~1k rows.
5. Cell 8 downloads the GGUF; the final Markdown cell has the two
   `ollama create` / `ollama run` commands you then paste locally.

## Quickstart (local CUDA)

```bash
# 1. Install (see https://unsloth.ai/docs/get-started for the matrix)
pip install unsloth datasets accelerate peft bitsandbytes transformers trl

# 2. Validate the dataset without touching the GPU
python studio/scripts/train_lora.py \
    --dry-run \
    --dataset studio/data/exports/alpaca.jsonl

# 3. Train
python studio/scripts/train_lora.py \
    --model   unsloth/Llama-3.2-3B-Instruct-bnb-4bit \
    --dataset studio/data/exports/alpaca.jsonl \
    --output  studio/data/finetunes/custom-llama3.2-3b \
    --epochs 2 --lora-r 16 --lora-alpha 32 \
    --batch-size 2 --grad-accum 4 \
    --max-seq-length 2048 \
    --merge

# 4. Convert to GGUF (needs a built llama.cpp checkout)
git clone --depth 1 https://github.com/ggerganov/llama.cpp
cd llama.cpp && pip install -r requirements.txt \
    && cmake -B build && cmake --build build -j
cd -
python studio/scripts/export_gguf.py \
    --adapter studio/data/finetunes/custom-llama3.2-3b \
    --base    unsloth/Llama-3.2-3B-Instruct \
    --output  studio/data/finetunes/custom-llama3.2-3b.gguf \
    --quant   q4_k_m \
    --llama-cpp ./llama.cpp

# 5. Run in Ollama (follow the Modelfile template export_gguf.py prints)
ollama create custom-llama3.2-3b -f Modelfile
ollama run    custom-llama3.2-3b 'hello'
```

## FAQ

### How long will training take?

Rules of thumb, free T4, LoRA r=16, seq-len 2048, effective batch 8:

| Base model | 500 rows, 2 epochs | 2k rows, 2 epochs | 10k rows, 2 epochs |
|---|---|---|---|
| Llama-3.2-1B | ~4 min | ~12 min | ~55 min |
| Llama-3.2-3B | ~10 min | ~25 min | ~2 h |
| Qwen2.5-7B   | OOM at seq 2048 | drop seq to 1024 | A100 territory |

Bigger models are rarely worth it on T4; prefer a focused dataset + 3B over
a sprawling dataset + 7B that only half-fits.

### "CUDA out of memory"

In order of cheapest fix first:

1. `--batch-size 1 --grad-accum 8` (keeps effective batch 8).
2. `--max-seq-length 1024`.
3. `--lora-r 8 --lora-alpha 16`.
4. Switch to the 1B base.
5. Restart the runtime (`Runtime -> Disconnect and delete runtime`) - Colab
   leaks VRAM across failed runs.

### "`ImportError: cannot import name 'FastLanguageModel'`"

Your Unsloth install is stale or partial. Reinstall:

```bash
pip uninstall -y unsloth unsloth_zoo
pip install --upgrade --no-cache-dir unsloth
```

### "`convert_hf_to_gguf.py not found`"

`export_gguf.py` expects a llama.cpp checkout. Either:

- Pass `--llama-cpp /path/to/llama.cpp`, or
- Set `LLAMA_CPP_DIR=/path/to/llama.cpp` in the environment.

### "`llama-quantize` binary not found"

You cloned llama.cpp but didn't build it:

```bash
cd llama.cpp
cmake -B build
cmake --build build -j --target llama-quantize
```

The binary ends up at `llama.cpp/build/bin/llama-quantize`.

### Loss stays at 0 / NaN

Three common causes:

- Dataset is empty or all whitespace -> run `--dry-run` first.
- Chat template mismatch -> pass `--chat-template` explicitly.
- `fp16=True` on a card that only has bf16, or vice versa. `train_lora.py`
  picks this automatically via `is_bfloat16_supported()`; if you've patched
  that out, flip it manually.

### Should I merge the LoRA?

For GGUF/Ollama: **yes**, you must merge. `export_gguf.py` does this via
`peft.PeftModel.merge_and_unload()`. For `vllm` or `text-generation-webui`
with LoRA support, you can keep the adapter separate.

### Can I keep training from a previous adapter?

Not out of the box - the current script attaches a fresh LoRA each run.
To resume, load the adapter with `PeftModel.from_pretrained(model, adapter)`
instead of `FastLanguageModel.get_peft_model(...)` in `_train_gpu`.

## Switching the base model

The `--model` flag takes any Hugging Face repo id; the Unsloth `-bnb-4bit`
variants are what fit in 16 GB. Known-good slugs:

| Slug | Params | T4 OK? | Notes |
|---|---|---|---|
| `unsloth/Llama-3.2-1B-Instruct-bnb-4bit` | 1.2 B | yes, fast | Best for quick iteration; worst reasoning. |
| `unsloth/Llama-3.2-3B-Instruct-bnb-4bit` | 3.2 B | yes | **Default.** Best quality/speed trade-off on free T4. |
| `unsloth/Qwen2.5-3B-Instruct-bnb-4bit`   | 3.1 B | yes | Stronger multilingual; chat template differs. |
| `unsloth/mistral-7b-instruct-v0.3-bnb-4bit` | 7.2 B | tight | Drop `--max-seq-length` to 1024 on T4. |
| `unsloth/Phi-3.5-mini-instruct-bnb-4bit` | 3.8 B | yes | Small but strong at instruction following. |

When switching, also update the `--base` flag in `export_gguf.py` to the
**full-precision** version of the same model (drop the `-bnb-4bit` suffix),
because the merge step needs real fp16 weights:

| Training `--model` | Export `--base` |
|---|---|
| `unsloth/Llama-3.2-3B-Instruct-bnb-4bit` | `unsloth/Llama-3.2-3B-Instruct` |
| `unsloth/Qwen2.5-3B-Instruct-bnb-4bit`   | `unsloth/Qwen2.5-3B-Instruct` |
| `unsloth/mistral-7b-instruct-v0.3-bnb-4bit` | `unsloth/mistral-7b-instruct-v0.3` |

## Files in this pipeline

- `train_lora.py`            - LoRA trainer (Unsloth GPU path + CPU debug + `--dry-run`).
- `export_gguf.py`           - Merge LoRA into base + convert to GGUF via llama.cpp.
- `_sample_alpaca.jsonl`     - 3-row Alpaca sample used by `--dry-run`.
- `../notebooks/train_colab.ipynb` - 9-cell Colab walkthrough.
