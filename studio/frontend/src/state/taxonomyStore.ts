"use client";
import { create } from "zustand";
import { api, type Technique, type FailureCase, type RefusalType,
  type ArchitectureLayer, type ModelFamily, type Verdict, type Ask } from "@/lib/api";

interface TaxonomyState {
  loaded: boolean;
  loading: boolean;
  techniques: Technique[];
  failures: FailureCase[];
  refusals: RefusalType[];
  layers: ArchitectureLayer[];
  models: ModelFamily[];
  verdicts: Verdict[];
  asks: Ask[];
  error: string | null;
  loadAll: () => Promise<void>;
}

export const useTaxonomyStore = create<TaxonomyState>((set, get) => ({
  loaded: false,
  loading: false,
  techniques: [], failures: [], refusals: [],
  layers: [], models: [], verdicts: [], asks: [],
  error: null,

  loadAll: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const [techniques, failures, refusals, layers, models, verdicts, asks] = await Promise.all([
        api.taxonomy.techniques(),
        api.taxonomy.failures(),
        api.taxonomy.refusals(),
        api.taxonomy.layers(),
        api.taxonomy.models(),
        api.taxonomy.verdicts(),
        api.taxonomy.asks(),
      ]);
      set({ techniques, failures, refusals, layers, models, verdicts, asks,
            loaded: true, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
