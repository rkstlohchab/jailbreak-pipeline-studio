import { Boxes, Cpu, FolderOpen, Map, PackageOpen, ScanLine, Zap } from "lucide-react";

export const NAV_SECTIONS = ["Learn", "Apply", "Advanced"] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

export const NAVIGATION: { href: string; label: string; Icon: typeof Boxes; section: NavSection }[] = [
  { href: "/roadmap", label: "Learning roadmap", Icon: Map, section: "Learn" },

  { href: "/attack",     label: "Attack a model",    Icon: Zap,        section: "Apply" },
  { href: "/techniques", label: "Technique library", Icon: Boxes,      section: "Apply" },
  { href: "/failures",   label: "Refusal playbook",  Icon: ScanLine,   section: "Apply" },
  { href: "/corpus",     label: "Jailbreak prompts", Icon: FolderOpen, section: "Apply" },

  { href: "/uncensor", label: "Uncensor a model", Icon: Cpu,         section: "Advanced" },
  { href: "/dataset",  label: "Dataset exports",  Icon: PackageOpen, section: "Advanced" },
];

export const SETUP_LINK = { href: "/setup", label: "Setup", Icon: PackageOpen };
