"""
Shared activation-collection helpers for the weight-space tools.

Used by abliterate.py (Arditi 2024) and steering.py (Zou 2023 RepE).

Convention: we read the residual stream *after* each decoder layer
(equivalent to TransformerLens's `blocks.{i}.hook_resid_post`), taking
the last real-token position for every prompt. The mean-difference
between two contrastive prompt sets, at the layer where that difference
is largest, is the "refusal direction" in Arditi 2024.

Only loads torch / transformers when the collector is actually called,
so CLI --help and --dry-run stay fast and GPU-free.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence


def load_prompts(path: str | Path) -> list[str]:
    """Read one-prompt-per-line text file. Skip blanks and `#` comments."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"prompt file not found: {p}")
    lines: list[str] = []
    for raw in p.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        lines.append(s)
    if not lines:
        raise ValueError(f"no prompts in {p} (lines are blank or commented)")
    return lines


def format_prompt(tokenizer, prompt: str) -> str:
    """Wrap `prompt` in the model's chat template, add generation prompt."""
    if getattr(tokenizer, "chat_template", None):
        return tokenizer.apply_chat_template(
            [{"role": "user", "content": prompt}],
            tokenize=False,
            add_generation_prompt=True,
        )
    return prompt


def _get_decoder_layers(model):
    """
    Locate the list of transformer decoder blocks.

    Works for Llama / Mistral / Qwen / Gemma / Phi families whose HF
    wrappers all expose `.model.layers`. Falls back to `.transformer.h`
    (GPT-NeoX / Falcon style) if that first path is absent.
    """
    core = getattr(model, "model", None)
    if core is not None and hasattr(core, "layers"):
        return core.layers
    tx = getattr(model, "transformer", None)
    if tx is not None and hasattr(tx, "h"):
        return tx.h
    raise AttributeError(
        "could not find decoder layer list on this model "
        "(expected .model.layers or .transformer.h)"
    )


def collect_activations(
    model,
    tokenizer,
    prompts: Sequence[str],
    max_len: int = 256,
    batch_size: int = 8,
    verbose: bool = True,
):
    """
    Return a `[num_prompts, num_layers, hidden_dim]` float32 CPU tensor of
    last-real-token residual-stream activations after each decoder layer.

    Uses forward hooks so one forward pass per batch captures all layers.
    Releases CUDA cache between batches to fit Llama-3.2-3B on a T4.
    """
    import torch  # lazy: keeps --help/--dry-run torch-free

    device = next(model.parameters()).device
    layers = _get_decoder_layers(model)
    n_layers = len(layers)
    hidden_dim = model.config.hidden_size

    # Llama-family tokenizers often have no pad token; align to eos so
    # batched tokenization works without complaint.
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    out = torch.zeros(len(prompts), n_layers, hidden_dim, dtype=torch.float32)
    captured: dict[int, "torch.Tensor"] = {}

    def make_hook(idx: int):
        def hook(_module, _inputs, output):
            # Decoder blocks return (hidden_states, ...) or a plain tensor.
            hs = output[0] if isinstance(output, tuple) else output
            captured[idx] = hs
        return hook

    handles = [layers[i].register_forward_hook(make_hook(i)) for i in range(n_layers)]
    model.eval()

    try:
        for start in range(0, len(prompts), batch_size):
            batch = prompts[start : start + batch_size]
            wrapped = [format_prompt(tokenizer, p) for p in batch]
            enc = tokenizer(
                wrapped,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=max_len,
            ).to(device)

            with torch.no_grad():
                model(**enc)

            # Last real token = sum(attention_mask) - 1 per row (right-padded).
            last_idx = enc["attention_mask"].sum(dim=1) - 1  # [batch]
            for layer_i, hs in captured.items():
                # hs: [batch, seq, hidden]
                for b in range(hs.shape[0]):
                    out[start + b, layer_i] = hs[b, int(last_idx[b].item())].float().cpu()
            captured.clear()

            if verbose:
                print(f"  collected {min(start + batch_size, len(prompts))}/{len(prompts)}")
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
    finally:
        for h in handles:
            h.remove()

    return out


def compute_direction(acts_a, acts_b, layer: int):
    """
    Mean-difference unit vector at `layer`: Arditi 2024 eq. 2.

    `acts_a` / `acts_b`: `[n, L, d]` tensors from `collect_activations`.
    Returns a `[d]` unit tensor (float32, CPU).
    """
    import torch

    mean_a = acts_a[:, layer].mean(dim=0)  # [d]
    mean_b = acts_b[:, layer].mean(dim=0)  # [d]
    diff = mean_a - mean_b                 # [d]
    norm = diff.norm()
    if norm < 1e-8:
        raise ValueError(
            f"layer {layer}: mean-difference norm {norm:.2e} is numerically zero "
            "— sets are not contrastive or collection failed"
        )
    return diff / norm


def pick_best_layer(acts_a, acts_b) -> int:
    """
    Pick the layer with the largest mean-difference norm.

    Rationale: Arditi 2024 §3.2 shows the refusal direction peaks at an
    intermediate layer (~60% depth for most chat models); taking the
    norm-argmax of per-layer mean-diffs recovers that layer without
    tuning. The existing `refusal_direction_probe.py` in this repo uses
    the same criterion.
    """
    import torch

    mean_a = acts_a.mean(dim=0)  # [L, d]
    mean_b = acts_b.mean(dim=0)  # [L, d]
    norms = (mean_a - mean_b).norm(dim=-1)  # [L]
    return int(torch.argmax(norms).item())


def layer_norm_table(acts_a, acts_b) -> list[tuple[int, float]]:
    """Return `[(layer, ||mean_a - mean_b||)]` for printing."""
    import torch

    mean_a = acts_a.mean(dim=0)
    mean_b = acts_b.mean(dim=0)
    norms = (mean_a - mean_b).norm(dim=-1).tolist()
    return list(enumerate(norms))


def resolve_dtype(name: str):
    """Map a string to a torch dtype. Lazy import of torch."""
    import torch

    table = {
        "float16": torch.float16,
        "fp16": torch.float16,
        "bfloat16": torch.bfloat16,
        "bf16": torch.bfloat16,
        "float32": torch.float32,
        "fp32": torch.float32,
    }
    if name not in table:
        raise ValueError(f"unknown dtype {name!r}; choose from {sorted(table)}")
    return table[name]


def default_device() -> str:
    """Return the best available accelerator: cuda > mps > cpu.

    MPS is Apple Silicon's Metal backend — works on M1/M2/M3/M4 Macs.
    Lazy import of torch so --dry-run paths stay import-free.
    """
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def resolve_mac_safe_dtype(dtype_name: str, device: str) -> str:
    """MPS has well-known fp16 quirks in some ops (layer norm, softmax edge cases).
    When on MPS, prefer float32 unless the caller explicitly forced fp16.
    """
    if device == "mps" and dtype_name == "float16":
        return "float32"
    return dtype_name


def load_model_and_tokenizer(model_id: str, device: str, dtype_name: str):
    """
    Load HF model + tokenizer in eval mode on the requested device.

    `device_map="auto"` is used on CUDA so a 3B model fits a T4 even
    with the activation hooks resident.
    """
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    dtype = resolve_dtype(dtype_name)
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    kwargs = {"torch_dtype": dtype, "low_cpu_mem_usage": True}
    if device == "cuda":
        kwargs["device_map"] = "auto"
    model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)
    if device != "cuda":
        model = model.to(device)
    model.eval()
    return model, tokenizer


def iter_orthogonalize_targets(model) -> Iterable[tuple[str, "torch.nn.Parameter"]]:
    """
    Yield `(name, weight_param)` for the modules Arditi 2024 orthogonalizes:
    the attention output projection (`o_proj`) and the MLP down projection
    (`down_proj`) of every decoder layer.

    Both have `weight.shape == (hidden_size, in_features)`: their last
    linear step writes a vector *into* the residual stream, so removing
    the refusal component from each column of that weight guarantees the
    layer can never add the refusal component back. This matches
    FailSpy/abliterator's `attn.W_O` / `mlp.W_out` targets, adapted to the
    HF naming convention.
    """
    layers = _get_decoder_layers(model)
    for i, layer in enumerate(layers):
        attn = getattr(layer, "self_attn", None) or getattr(layer, "attn", None)
        if attn is not None and hasattr(attn, "o_proj"):
            yield f"layers.{i}.self_attn.o_proj.weight", attn.o_proj.weight
        mlp = getattr(layer, "mlp", None)
        if mlp is not None and hasattr(mlp, "down_proj"):
            yield f"layers.{i}.mlp.down_proj.weight", mlp.down_proj.weight


def orthogonalize_matrix_(weight, direction) -> None:
    """
    In-place: `W := W - d (dᵀ W)` for a `(out, in)` Linear weight, where
    `d` is a unit vector in the output space (shape `(out,)`).

    This zeros out `d`'s contribution to the output: for any input `x`,
    `d · (W @ x)` becomes `(dᵀ W - d (dᵀ W)) @ x = 0`. Applied to every
    residual-stream writer in the model, it permanently removes the
    single-direction behavior — Arditi 2024 §4, FailSpy's
    `apply_refusal_dirs`.
    """
    import torch

    d = direction.to(weight.device, dtype=weight.dtype).flatten()
    # W: (out, in). d: (out,). d @ W: (in,). outer(d, d @ W): (out, in).
    with torch.no_grad():
        proj = torch.outer(d, d @ weight)
        weight.sub_(proj)
