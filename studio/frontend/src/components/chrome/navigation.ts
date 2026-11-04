import { BookOpenText, Boxes, ChartNoAxesCombined, FlaskConical, FolderOpen, LayoutGrid, PackageOpen, ScanLine } from "lucide-react";

export const NAVIGATION = [
  { href: "/", label: "Overview", Icon: LayoutGrid, section: "Workspace" },
  { href: "/playground", label: "Playground", Icon: FlaskConical, section: "Workspace" },
  { href: "/techniques", label: "Techniques", Icon: Boxes, section: "Explore" },
  { href: "/failures", label: "Failure cases", Icon: ScanLine, section: "Explore" },
  { href: "/matrix", label: "Model matrix", Icon: ChartNoAxesCombined, section: "Explore" },
  { href: "/corpus", label: "Prompt corpus", Icon: FolderOpen, section: "Library" },
  { href: "/research", label: "Research papers", Icon: BookOpenText, section: "Library" },
  { href: "/dataset", label: "Dataset exports", Icon: PackageOpen, section: "Library" },
];
