"use client";
import { create } from "zustand";
import { api, type SessionSummary } from "@/lib/api";

interface SessionState {
  loaded: boolean;
  loading: boolean;
  sessions: SessionSummary[];
  error: string | null;
  load: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  loaded: false,
  loading: false,
  sessions: [],
  error: null,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const sessions = await api.sessions.list();
      set({ sessions, loaded: true, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
