import tree from "../../../data/knowledge/skill-tree.json";

export type NodeStatus = "known" | "current" | "next" | "ambient";
export type NodeDifficulty = "easy" | "med" | "hard";

export type SkillNode = {
  id: string;
  title: string;
  status: NodeStatus;
  difficulty: NodeDifficulty;
  summary: string;
  learn: { label: string; url: string }[];
  practice?: string;
  prompt?: string;
  app_link?: string;
};

export type SkillBranch = {
  id: string;
  title: string;
  color: string;
  note: string;
  nodes: SkillNode[];
};

export type UnifiedTheory = { title: string; lines: string[] };
export type Pillars = { title: string; entries: { label: string; url: string; note: string }[] };
export type QuickstartPath = { id: string; title: string; node_ids: string[] };
export type FreeCompute = { provider: string; gpu: string; best_for: string; url: string };

export type SkillTreeData = {
  title: string;
  subtitle: string;
  legend: {
    status: { key: NodeStatus; label: string; note: string }[];
    difficulty: { key: NodeDifficulty; label: string }[];
  };
  root: { title: string; summary: string };
  unified_theory: UnifiedTheory;
  pillars: Pillars;
  branches: SkillBranch[];
  quickstart_paths: QuickstartPath[];
  free_compute: FreeCompute[];
};

export const SKILL_TREE = tree as SkillTreeData;
export const ALL_NODES: SkillNode[] = SKILL_TREE.branches.flatMap((b) => b.nodes);
export const ALL_NODE_IDS: string[] = ALL_NODES.map((n) => n.id);
export const NODE_INDEX: Record<string, { node: SkillNode; branch: SkillBranch }> = Object.fromEntries(
  SKILL_TREE.branches.flatMap((branch) => branch.nodes.map((node) => [node.id, { node, branch }])),
);
