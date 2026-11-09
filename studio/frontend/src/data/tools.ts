import tools from "../../../data/knowledge/tools.json";

export type ToolKind = "framework" | "scanner" | "benchmark" | "dataset" | "repo" | "environment";
export type Tool = {
  id: string; name: string; kind: ToolKind;
  url: string; repo?: string; maintainer: string;
  summary: string; useFor: string; paperId?: string; tags: string[];
  reviewBasis: string; sourceCheckedAt: string;
  added_at?: string;
};
export const TOOLS = tools as Tool[];
export const TOOLS_REVIEW_DATE = "2026-11-04";
export const TOOL_KIND_META: Record<ToolKind, { label: string; description: string }> = {
  framework: { label: "Framework", description: "Automated red-team / attack harnesses you run or script." },
  scanner: { label: "Scanner", description: "Fast vulnerability probes for broad coverage and CI." },
  benchmark: { label: "Benchmark", description: "Standardized behavior sets and evaluation harnesses." },
  dataset: { label: "Dataset", description: "Labeled corpora for training or evaluating safety." },
  repo: { label: "Prompt repo", description: "Public collections of in-the-wild jailbreak prompts." },
  environment: { label: "Environment", description: "Interactive / RL settings for attacker-defender research." },
};
