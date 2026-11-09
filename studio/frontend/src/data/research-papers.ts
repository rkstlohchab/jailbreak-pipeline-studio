import papers from "../../../data/knowledge/research-papers.json";

export type PaperCategory = "refusal-mechanics" | "attack-studies" | "evaluation" | "alignment" | "prompt-injection" | "defenses";
export type ResearchAccess = "black-box" | "open-weights" | "mixed" | "training";
export type Paper = {
  id: string; title: string; authors: string[]; published: string; year: number;
  url: string; pdfUrl: string; arxivId?: string; source: string; sourceRevisionAt: string;
  category: PaperCategory; access: ResearchAccess;
  summary: string; takeaway: string; limitations: string; tags: string[];
  reviewBasis: string; sourceCheckedAt: string;
  added_at?: string;
};
export const RESEARCH_PAPERS = papers as Paper[];
export const KNOWLEDGE_REVIEW_DATE = "2026-11-04";
export const CATEGORY_META: Record<PaperCategory, { label: string; description: string }> = {
  "refusal-mechanics": { label: "Refusal mechanisms", description: "Internal representations, steering, and the limits of mechanistic explanations." },
  "attack-studies": { label: "Attack studies", description: "Published adversarial evaluations, with access requirements and historical limits." },
  evaluation: { label: "Evaluation", description: "Benchmarks, answer quality, over-refusal, and reproducibility." },
  alignment: { label: "Alignment", description: "Training methods and how they shape model behavior." },
  "prompt-injection": { label: "Prompt injection", description: "Trust boundaries in retrieved content, tools, and agent workflows." },
  defenses: { label: "Defenses", description: "Safeguards and their robustness, usability, and runtime trade-offs." },
};
export const ACCESS_META: Record<ResearchAccess, string> = {
  "black-box": "API / black-box studies", "open-weights": "Model internals", mixed: "Mixed access", training: "Training methods",
};
