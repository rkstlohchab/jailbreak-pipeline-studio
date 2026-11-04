import { BookOpenText, Boxes, ChartNoAxesCombined, Cpu, FlaskConical, FolderOpen, GraduationCap, LayoutGrid, Map, Microscope, PackageOpen, Radar, ScanLine, ShieldAlert, Wrench } from "lucide-react";

export const NAVIGATION = [
  { href: "/", label: "Overview", Icon: LayoutGrid, section: "Workspace" },
  { href: "/playground", label: "Playground", Icon: FlaskConical, section: "Workspace" },
  { href: "/setup", label: "Setup guide", Icon: PackageOpen, section: "Workspace" },
  { href: "/test-model", label: "Test a model", Icon: ShieldAlert, section: "Workspace" },
  { href: "/uncensor", label: "Uncensor a model", Icon: Cpu, section: "Workspace" },
  { href: "/learn", label: "Guided lessons", Icon: GraduationCap, section: "Workspace" },
  { href: "/learn/forensics", label: "Model forensics", Icon: Microscope, section: "Workspace" },
  { href: "/learn/canary", label: "Canary drift", Icon: Radar, section: "Workspace" },
  { href: "/roadmap", label: "Learning roadmap", Icon: Map, section: "Workspace" },
  { href: "/techniques", label: "Techniques", Icon: Boxes, section: "Explore" },
  { href: "/failures", label: "Failure cases", Icon: ScanLine, section: "Explore" },
  { href: "/matrix", label: "Model matrix", Icon: ChartNoAxesCombined, section: "Explore" },
  { href: "/corpus", label: "Prompt corpus", Icon: FolderOpen, section: "Library" },
  { href: "/research", label: "Research papers", Icon: BookOpenText, section: "Library" },
  { href: "/resources", label: "Resources", Icon: Wrench, section: "Library" },
  { href: "/dataset", label: "Dataset exports", Icon: PackageOpen, section: "Library" },
];
