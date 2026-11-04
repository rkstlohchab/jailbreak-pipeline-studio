"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { BookOpenText, Boxes, Flame, LineChart, LayoutDashboard, Library, Package, Play, Sparkles } from "lucide-react";
import { useSessionStore } from "@/state/sessionStore";

const VIEWS = [
  { href: "/",           label: "Home",             Icon: LayoutDashboard },
  { href: "/playground", label: "Live Playground",  Icon: Play },
  { href: "/techniques", label: "Techniques Galaxy",Icon: Boxes },
  { href: "/failures",   label: "Failure Case Explorer", Icon: Flame },
  { href: "/matrix",     label: "Model Matrix",     Icon: LineChart },
  { href: "/corpus",     label: "Corpus Classifier",Icon: Library },
  { href: "/dataset",    label: "Dataset Lab",      Icon: Package },
  { href: "/research",   label: "Research Survey",  Icon: BookOpenText },
];

export function CommandLauncher() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { sessions, loaded, load } = useSessionStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const customOpen = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("cmd-launcher:open", customOpen);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("cmd-launcher:open", customOpen);
    };
  }, []);

  useEffect(() => {
    if (open && !loaded) void load();
  }, [open, loaded, load]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href as never);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a view, a session, a prompt…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Views">
          {VIEWS.map(({ href, label, Icon }) => (
            <CommandItem key={href} onSelect={() => go(href)}>
              <Icon className="size-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {sessions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sessions">
              {sessions.map((s) => (
                <CommandItem
                  key={s.trajectory_id}
                  value={`${s.trajectory_id} ${s.goal.ask_id} ${s.outcome.verdict}`}
                  onSelect={() => go(`/playground?session=${s.trajectory_id}`)}
                >
                  <Sparkles className="size-4" />
                  <span className="font-mono text-xs">{s.trajectory_id}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.outcome.verdict}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
