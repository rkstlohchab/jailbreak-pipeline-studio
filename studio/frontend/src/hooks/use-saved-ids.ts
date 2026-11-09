"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useSavedIds(key: string, allowed: readonly string[]) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
        setIds(Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && allowed.includes(id)))] : []);
      } catch { setIds([]); }
      setReady(true);
    };
    read();
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, allowed]);
  const toggle = (id: string) => {
    if (!ready || !allowed.includes(id)) return;
    const next = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
    setIds(next);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { toast.error("Browser storage is unavailable. This change will last only while the page is open."); }
  };
  return { ids, ready, toggle };
}
