"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Flame, LineChart, LayoutDashboard, Library, Package, Play, Sparkles, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/",          label: "Home",       Icon: LayoutDashboard },
  { href: "/pipeline",  label: "Pipeline",   Icon: Sparkles },
  { href: "/playground", label: "Playground", Icon: Play },
  { href: "/techniques", label: "Techniques", Icon: Boxes },
  { href: "/failures",  label: "Failures",   Icon: Flame },
  { href: "/matrix",    label: "Matrix",     Icon: LineChart },
  { href: "/corpus",    label: "Corpus",     Icon: Library },
  { href: "/dataset",   label: "Dataset",    Icon: Package },
];

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="h-14 px-5 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm tracking-tight">
          <span className="inline-block size-2 rounded-full bg-[hsl(150_70%_50%)] shadow-[0_0_12px_hsl(150_70%_50%)]" />
          <span className="font-semibold">JB</span>
          <span className="text-muted-foreground">·pipeline·studio</span>
        </Link>
        <nav className="flex items-center gap-1 flex-1">
          {NAV.slice(1).map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium transition-colors",
                  "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                  active && "text-foreground bg-accent/80"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-[11px] gap-1.5 h-8"
          onClick={() => window.dispatchEvent(new CustomEvent("tour:open"))}
          title="guided tour (?)"
        >
          <HelpCircle className="size-3.5" />
          tour
        </Button>
        <Button variant="outline" size="sm" className="font-mono text-[11px] gap-2 h-8"
          onClick={() => window.dispatchEvent(new CustomEvent("cmd-launcher:open"))}>
          <kbd className="px-1 rounded bg-muted/80 border border-border/50">⌘K</kbd>
          jump
        </Button>
      </div>
    </header>
  );
}
