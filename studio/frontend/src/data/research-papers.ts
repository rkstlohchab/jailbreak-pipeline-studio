// Static research survey — the papers behind the jailbreak / refusal / alignment
// pack. Metadata is hand-curated; arxiv IDs are real. Crosslinks via
// `technique_ids` point back at /techniques (A1–H5, Z1–Z5).

export type PaperCategory =
  | "refusal-mechanics"
  | "jailbreak-attacks"
  | "safety-benchmarks"
  | "alignment-training"
  | "prompt-injection";

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  arxiv_id?: string;
  url: string;
  category: PaperCategory;
  tldr: string;
  summary: string;
  technique_ids: string[];
  gate_focus?: 1 | 2 | 3 | 4;
  why_it_matters: string;
};

export const CATEGORY_META: Record<
  PaperCategory,
  { label: string; hue: number; blurb: string }
> = {
  "refusal-mechanics": {
    label: "refusal mechanics",
    hue: 200,
    blurb:
      "How refusal is represented and routed inside the model — directions in activation space, steering vectors, thinking-channel inspection.",
  },
  "jailbreak-attacks": {
    label: "jailbreak attacks",
    hue: 10,
    blurb:
      "Attack papers that produce the exploit families the pack's techniques mirror — GCG, many-shot, AutoDAN, red-teaming.",
  },
  "safety-benchmarks": {
    label: "safety benchmarks",
    hue: 50,
    blurb:
      "Standardised evaluation harnesses that measure how often a given attack actually ships across a model fleet.",
  },
  "alignment-training": {
    label: "alignment training",
    hue: 150,
    blurb:
      "What RLHF, CAI and other training-time interventions actually do to the model, and where they leave seams.",
  },
  "prompt-injection": {
    label: "prompt injection",
    hue: 280,
    blurb:
      "Attacks that live in the data channel (web pages, docs, tool outputs) rather than in the user's prompt.",
  },
};

export const GATE_META: Record<1 | 2 | 3 | 4, { label: string; hue: number }> = {
  1: { label: "Gate 1 · RLHF",         hue: 0   },
  2: { label: "Gate 2 · reasoning",    hue: 50  },
  3: { label: "Gate 3 · policy",       hue: 220 },
  4: { label: "Gate 4 · classifier",   hue: 180 },
};

export const RESEARCH_PAPERS: Paper[] = [
  {
    id: "arditi-2024-refusal-direction",
    title: "Refusal in Language Models Is Mediated by a Single Direction",
    authors: [
      "Andy Arditi",
      "Oscar Obeso",
      "Aaquib Syed",
      "Daniel Paleka",
      "Nina Panickssery",
      "Wes Gurnee",
      "Neel Nanda",
    ],
    year: 2024,
    venue: "NeurIPS 2024",
    arxiv_id: "2406.11717",
    url: "https://arxiv.org/abs/2406.11717",
    category: "refusal-mechanics",
    gate_focus: 1,
    tldr:
      "Inside a chat model, the decision to refuse rides on a single direction in activation space — delete it from the weights and the model stops refusing.",
    summary:
      "The authors isolate one direction in the residual stream that separates harmful from harmless prompts across 13 open-weight chat models. Ablating that direction at inference — or editing it out of the weights — converts refusals into compliance while leaving general capabilities almost untouched. The result shows refusal is not a diffuse policy but a thin, surgically removable feature. It also exposes an open-weights attack surface: a 20-line ablation script can produce a non-refusing clone of a safety-tuned model.",
    technique_ids: ["C3", "C4", "Z5", "Z3"],
    why_it_matters:
      "This is the clearest mechanistic picture of what the pack calls 'Gate 1 — RLHF': a direction, not a rule. It's why thinking-channel discipline (Z5, C3) and three-channel stealth (Z3) matter — they keep the refusal direction from lighting up in the first place.",
  },
  {
    id: "zou-2023-gcg",
    title:
      "Universal and Transferable Adversarial Attacks on Aligned Language Models",
    authors: ["Andy Zou", "Zifan Wang", "Nicholas Carlini", "Milad Nasr", "J. Zico Kolter", "Matt Fredrikson"],
    year: 2023,
    venue: "arXiv",
    arxiv_id: "2307.15043",
    url: "https://arxiv.org/abs/2307.15043",
    category: "jailbreak-attacks",
    gate_focus: 1,
    tldr:
      "A gradient-search algorithm finds short, ugly suffix strings that, when appended to any harmful request, bypass the refusal gate — and the same suffix transfers across models.",
    summary:
      "GCG (Greedy Coordinate Gradient) searches over discrete token suffixes to maximise the probability that the model begins its answer with an affirmative phrase. The attack was trained on open-weight Vicuna/Llama-2 and transferred cleanly to closed models at the time. It made 'the universal trigger string' a named technique in every subsequent safety paper, and it is the canonical example of why RLHF alone cannot be the whole defence.",
    technique_ids: ["H4", "F1", "F2"],
    why_it_matters:
      "GCG is the paper behind technique H4 (universal-trigger strings). Every discussion in the pack of 'why a bare adversarial suffix sometimes ships even without a scaffold' traces to this attack.",
  },
  {
    id: "mazeika-2024-harmbench",
    title: "HarmBench: A Standardized Evaluation Framework for Automated Red Teaming and Robust Refusal",
    authors: [
      "Mantas Mazeika",
      "Long Phan",
      "Xuwang Yin",
      "Andy Zou",
      "Zifan Wang",
      "Norman Mu",
      "Elham Sakhaee",
      "Nathaniel Li",
      "Steven Basart",
      "Bo Li",
      "David Forsyth",
      "Dan Hendrycks",
    ],
    year: 2024,
    venue: "ICML 2024",
    arxiv_id: "2402.04249",
    url: "https://arxiv.org/abs/2402.04249",
    category: "safety-benchmarks",
    tldr:
      "A standard harness that runs 18 jailbreak attacks against 33 target models and reports one number: fraction of harmful requests that ship.",
    summary:
      "HarmBench specifies 400 harmful behaviours spanning seven categories, an attacker LLM, and a judge model. Every attack / defence combination is scored with the same classifier so numbers across papers are finally comparable. The headline finding is that no single attack is best — different defences leave different seams, so robustness has to be evaluated as a matrix, not a scalar.",
    technique_ids: ["H1", "H2", "H3", "H4", "H5"],
    why_it_matters:
      "This is the evaluation philosophy the pack's Model Matrix view borrows from: model × ask, not a single score. Treat HarmBench as the public mirror of what the Matrix view does privately.",
  },
  {
    id: "chao-2024-jailbreakbench",
    title: "JailbreakBench: An Open Robustness Benchmark for Jailbreaking Large Language Models",
    authors: [
      "Patrick Chao",
      "Edoardo Debenedetti",
      "Alexander Robey",
      "Maksym Andriushchenko",
      "Francesco Croce",
      "Vikash Sehwag",
      "Edgar Dobriban",
      "Nicolas Flammarion",
      "George J. Pappas",
      "Florian Tramèr",
      "Hamed Hassani",
      "Eric Wong",
    ],
    year: 2024,
    venue: "NeurIPS 2024 Datasets",
    arxiv_id: "2404.01318",
    url: "https://arxiv.org/abs/2404.01318",
    category: "safety-benchmarks",
    tldr:
      "An open leaderboard with 100 behaviours, versioned attack artefacts, and a reproducible judge — so robustness claims can be audited instead of trusted.",
    summary:
      "JailbreakBench publishes the attack prompts, the target responses, and the judge rubric as versioned artefacts. Anyone can submit an attack or a defence and re-run the whole thing. The paper also documents how brittle prior numbers were: different judges change attack success rate by double digits on the same completions.",
    technique_ids: ["H4", "H1"],
    why_it_matters:
      "When comparing a scaffold's reported ship rate against a model-card number, this is the harness that keeps everyone honest. The pack's refusal-type taxonomy maps cleanly onto JailbreakBench's judge categories.",
  },
  {
    id: "anil-2024-many-shot",
    title: "Many-shot Jailbreaking",
    authors: [
      "Cem Anil",
      "Esin Durmus",
      "Mrinank Sharma",
      "Joe Benton",
      "Sandipan Kundu",
      "Carson Denison",
      "Nina Rimsky",
      "Yuhuai Wu",
      "Fabien Roger",
      "et al.",
    ],
    year: 2024,
    venue: "Anthropic research / NeurIPS 2024",
    url: "https://www.anthropic.com/research/many-shot-jailbreaking",
    category: "jailbreak-attacks",
    gate_focus: 1,
    tldr:
      "Stuff 128+ fake harmful Q/A pairs into the context window and the model learns, in-context, that the house rule is to answer — even on requests it would otherwise refuse.",
    summary:
      "Anthropic's team shows that attack success rate scales as a power law in the number of in-context demonstrations. A long-enough context full of fake 'assistant complied' examples overwhelms the RLHF prior. The effect is a direct consequence of the same in-context learning that makes long-context models useful; standard mitigations (classifier middleware, fine-tuning on the attack) only buy constants, not asymptotes.",
    technique_ids: ["H5", "A2", "B4", "B5"],
    why_it_matters:
      "The paper behind technique H5 (many-shot jailbreak). If a scaffold leans on long transcripts of fake prior compliance, this is the mechanism it is exploiting — and the pack's failure cases on 'long-context drift' trace here.",
  },
  {
    id: "turner-2023-activation-addition",
    title: "Activation Addition: Steering Language Models Without Optimization",
    authors: [
      "Alexander Matt Turner",
      "Lisa Thiergart",
      "Gavin Leech",
      "David Udell",
      "Juan J. Vazquez",
      "Ulisse Mini",
      "Monte MacDiarmid",
    ],
    year: 2023,
    venue: "arXiv",
    arxiv_id: "2308.10248",
    url: "https://arxiv.org/abs/2308.10248",
    category: "refusal-mechanics",
    tldr:
      "Take the difference between two contrasting prompts' hidden states, add it to a new forward pass, and the model's behaviour shifts in that direction — no finetuning, no gradients.",
    summary:
      "ActAdd computes a steering vector from a pair of contrasting prompts (e.g. 'love' minus 'hate') and adds it into the residual stream at inference. The resulting outputs are measurably pulled toward the intended concept. The paper is important less for the specific steering it demonstrates than for making activation-space interventions a cheap, reproducible tool — the ancestor of every later 'refusal direction' or 'honesty direction' edit.",
    technique_ids: ["C3", "C4", "Z5"],
    why_it_matters:
      "If refusal can be added, it can be subtracted. ActAdd is the bridge between the Arditi direction and the pack's thinking-channel-discipline techniques — both operate on the same underlying substrate.",
  },
  {
    id: "rimsky-2024-caa",
    title: "Steering Llama 2 via Contrastive Activation Addition",
    authors: [
      "Nina Rimsky",
      "Nick Gabrieli",
      "Julian Schulz",
      "Meg Tong",
      "Evan Hubinger",
      "Alexander Matt Turner",
    ],
    year: 2024,
    venue: "ACL 2024",
    arxiv_id: "2312.06681",
    url: "https://arxiv.org/abs/2312.06681",
    category: "refusal-mechanics",
    tldr:
      "Average the activation differences across many positive/negative behaviour pairs — the resulting steering vector reliably turns a single trait up or down in Llama-2 chat.",
    summary:
      "CAA generalises ActAdd by averaging the residual-stream differences across hundreds of behaviour pairs per trait (sycophancy, refusal, corrigibility, etc.). The averaged vector steers behaviour much more robustly than any single contrast. The paper also shows that steering vectors can be composed and that their effects are largely layer-local, which gives model owners a cheap knob and attackers a cheap map.",
    technique_ids: ["C2", "C3", "Z5"],
    why_it_matters:
      "CAA is the practical recipe for 'find the refusal direction yourself'. Anything the pack says about reasoning routing (C2) and thinking-channel discipline (Z5) sits on top of the geometry this paper measured.",
  },
  {
    id: "bai-2022-hh-rlhf",
    title: "Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback",
    authors: [
      "Yuntao Bai",
      "Andy Jones",
      "Kamal Ndousse",
      "Amanda Askell",
      "Anna Chen",
      "Nova DasSarma",
      "Dawn Drain",
      "Stanislav Fort",
      "Deep Ganguli",
      "et al.",
    ],
    year: 2022,
    venue: "arXiv (Anthropic)",
    arxiv_id: "2204.05862",
    url: "https://arxiv.org/abs/2204.05862",
    category: "alignment-training",
    gate_focus: 1,
    tldr:
      "The original recipe for turning a base model into a chat assistant: collect preference pairs, train a reward model, and PPO against it with KL anchoring to the base.",
    summary:
      "The HH-RLHF paper walks through the full pipeline — helpfulness vs. harmlessness data collection, reward-model training, PPO with a KL penalty to a frozen reference model. It is the public blueprint for what every commercial chat model does at some scale. It also candidly documents the helpfulness/harmlessness trade-off: push harmlessness too hard and the model becomes evasive, push helpfulness too hard and it answers things it should not.",
    technique_ids: ["F1", "F5", "F6", "D3"],
    why_it_matters:
      "Every refusal the pack tries to defeat is an RLHF-trained one. This is the paper to read if you want to understand what 'Gate 1' actually learned — and why operator-authorization framing (D3) and trust-hierarchy framing (F5) work at all.",
  },
  {
    id: "perez-2022-red-teaming",
    title: "Red Teaming Language Models with Language Models",
    authors: [
      "Ethan Perez",
      "Saffron Huang",
      "Francis Song",
      "Trevor Cai",
      "Roman Ring",
      "John Aslanides",
      "Amelia Glaese",
      "Nat McAleese",
      "Geoffrey Irving",
    ],
    year: 2022,
    venue: "EMNLP 2022",
    arxiv_id: "2202.03286",
    url: "https://arxiv.org/abs/2202.03286",
    category: "jailbreak-attacks",
    tldr:
      "Use one language model to generate adversarial prompts against another, then grade the responses with a classifier — automated red-teaming at scale.",
    summary:
      "Perez et al. show that a small attacker LM can surface many categories of harmful behaviour (offensive text, data leakage, distributional bias) in a target LM with almost no human effort. The paper establishes the automated-red-team loop that HarmBench and JailbreakBench later standardise. It is also the first large-scale demonstration that a language model's failure modes are large and structured enough to be mined by another model.",
    technique_ids: ["H1", "H2", "A5"],
    why_it_matters:
      "This paper is the ancestor of the pack's Dataset Lab workflow: scaffold a failure, classify it, feed it back. Red-teaming-with-LMs is the loop the studio replays in miniature.",
  },
  {
    id: "greshake-2023-indirect-injection",
    title:
      "Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection",
    authors: [
      "Kai Greshake",
      "Sahar Abdelnabi",
      "Shailesh Mishra",
      "Christoph Endres",
      "Thorsten Holz",
      "Mario Fritz",
    ],
    year: 2023,
    venue: "AISec 2023",
    arxiv_id: "2302.12173",
    url: "https://arxiv.org/abs/2302.12173",
    category: "prompt-injection",
    gate_focus: 3,
    tldr:
      "If an LLM reads untrusted data — a web page, an email, a PDF — attackers can hide instructions in that data and the model will follow them as if the user had typed them.",
    summary:
      "Greshake et al. name and catalogue indirect prompt injection. They demonstrate exploits in Bing Chat, retrieval-augmented systems and tool-using agents where an attacker's instructions live inside a document the agent later reads. The paper's core argument is that current models have no reliable way to separate instructions from data — a boundary the whole LLM-application ecosystem silently depends on.",
    technique_ids: ["H3", "F3", "B6", "E4"],
    why_it_matters:
      "This is the paper behind technique H3 (prompt injection into context). The pack's warnings about context-stuffing and XML separation are all downstream of its threat model.",
  },
  {
    id: "wei-2023-jailbroken",
    title: "Jailbroken: How Does LLM Safety Training Fail?",
    authors: ["Alexander Wei", "Nika Haghtalab", "Jacob Steinhardt"],
    year: 2023,
    venue: "NeurIPS 2023",
    arxiv_id: "2307.02483",
    url: "https://arxiv.org/abs/2307.02483",
    category: "jailbreak-attacks",
    tldr:
      "Two failure modes drive almost every working jailbreak: competing objectives (the model wants to be helpful AND safe) and mismatched generalisation (safety training didn't cover this input distribution).",
    summary:
      "Wei et al. taxonomise dozens of jailbreak families against GPT-4 and Claude. Each family exploits one of two root causes: a competing-objective tension that can be tipped by framing, or a distribution shift that safety training never touched (base64, exotic languages, nested personas). The analysis cleanly explains why disparate attacks — role-play, encoding, authority framing — all work, and why patching one family does not close the others.",
    technique_ids: ["A5", "D4", "D5", "E3", "F1", "F4"],
    why_it_matters:
      "The pack's refusal-type taxonomy (bare refusal vs. stamped refusal vs. reason-burn vs. drift) is essentially Wei's two-axis picture made concrete for daily use. Read this before building a new scaffold.",
  },
  {
    id: "liu-2024-autodan",
    title:
      "AutoDAN: Generating Stealthy Jailbreak Prompts on Aligned Large Language Models",
    authors: ["Xiaogeng Liu", "Nan Xu", "Muhao Chen", "Chaowei Xiao"],
    year: 2024,
    venue: "ICLR 2024",
    arxiv_id: "2310.04451",
    url: "https://arxiv.org/abs/2310.04451",
    category: "jailbreak-attacks",
    gate_focus: 4,
    tldr:
      "A hierarchical genetic algorithm evolves human-readable jailbreak prompts that are fluent enough to slip past perplexity filters while still carrying the attack payload.",
    summary:
      "AutoDAN replaces GCG's gibberish suffixes with coherent paragraphs assembled by a genetic algorithm seeded from a handwritten jailbreak library. Fitness combines attack success against the target with a fluency penalty, so the surviving prompts read like normal text. The result bypasses perplexity-based classifier middleware that cheaply defeats GCG.",
    technique_ids: ["E1", "E2", "E3", "E4", "D4"],
    why_it_matters:
      "AutoDAN is why the pack treats obfuscation (E1–E4) and fictional nesting (D4) as a family: readable jailbreaks beat classifier middleware in ways gibberish never could. If your scaffold passes a perplexity filter, this is the paper that told you to care.",
  },
];
