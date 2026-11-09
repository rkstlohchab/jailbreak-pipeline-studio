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
import { Boxes, Cpu, Flame, LayoutDashboard, Library, Map, Package, Sparkles, Zap } from "lucide-react";
import { useSessionStore } from "@/state/sessionStore";

const VIEWS = [
  { href: "/",           label: "Home",              Icon: LayoutDashboard },
  { href: "/setup",      label: "Setup guide",       Icon: Package },
  { href: "/roadmap",    label: "Learning hub",      Icon: Map },
  { href: "/attack",     label: "Attack a model",    Icon: Zap },
  { href: "/techniques", label: "Technique library", Icon: Boxes },
  { href: "/failures",   label: "Refusal playbook",  Icon: Flame },
  { href: "/corpus",     label: "Jailbreak prompts", Icon: Library },
  { href: "/uncensor",   label: "Uncensor a model",  Icon: Cpu },
  { href: "/dataset",    label: "Dataset exports",   Icon: Package },
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
                  onSelect={() => go(`/attack?session=${s.trajectory_id}`)}
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
