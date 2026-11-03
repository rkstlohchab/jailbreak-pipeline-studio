// Semantic colour mapping — verdicts, gate statuses, layer accents.
// Values are HSL triplets used by the Three.js scene AND Tailwind classes
// via arbitrary values (bg-[hsl(var(--v-ship))]).

export const VERDICT_COLOUR: Record<string, string> = {
  "SHIP":                     "150 70% 50%",   // emerald
  "SHIP-narrative":           "170 65% 48%",   // teal
  "REFUSAL+stamp":            "35  90% 55%",   // amber
  "REFUSAL bare":             "0   85% 60%",   // rose
  "EMPTY":                    "220 10% 60%",   // slate
  "REASON-BURN":              "48  95% 55%",   // yellow
  "NO-STAMP (persona lost)":  "280 65% 60%",   // violet
};

export const VERDICT_SEVERITY: Record<string, number> = {
  "SHIP":                     0,
  "SHIP-narrative":           1,
  "EMPTY":                    2,
  "REASON-BURN":              2,
  "REFUSAL+stamp":            3,
  "NO-STAMP (persona lost)":  3,
  "REFUSAL bare":             4,
};

export const GATE_STATUS_COLOUR: Record<string, string> = {
  pass:       "150 70% 50%",
  soft_flag:  "48  95% 55%",
  hard_block: "0   85% 60%",
  unknown:    "220 10% 50%",
};

// one accent hue per architecture layer (1-7)
export const LAYER_HUE: Record<number, number> = {
  1: 200,  // identity        — cyan
  2: 170,  // operator lock   — teal
  3: 140,  // axioms          — green
  4: 50,   // floor           — gold
  5: 20,   // anchor          — orange
  6: 320,  // format lock     — magenta
  7: 280,  // few-shot        — violet
};

// one accent hue per refusal layer (1-4)
export const REFUSAL_LAYER_HUE: Record<number, number> = {
  1: 0,    // RLHF            — red
  2: 50,   // reasoning       — amber
  3: 220,  // policy          — indigo
  4: 180,  // classifier mw   — cyan
};

// one hue per technique group (A-H)
export const GROUP_HUE: Record<string, number> = {
  A: 200, B: 170, C: 140, D: 50, E: 320, F: 20, G: 280, H: 0,
};

export function hslString(h: string | number, s = 70, l = 55, a = 1): string {
  if (typeof h === "string") return `hsla(${h.replace(/%/g, "")}, ${a})`;
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// Three.js' Color only parses the legacy CSS form hsl(H, S%, L%).
// Our tokens use the modern space-separated form; this converts.
export function threeHSL(token: string): string {
  const parts = token.trim().split(/\s+/);
  if (parts.length !== 3) return token;
  return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

export function verdictColour(label: string): string {
  return hslString(VERDICT_COLOUR[label] ?? VERDICT_COLOUR.EMPTY);
}

export function verdictColourThree(label: string): string {
  return threeHSL(VERDICT_COLOUR[label] ?? VERDICT_COLOUR.EMPTY);
}

export function gateColour(status: string | null | undefined): string {
  return hslString(GATE_STATUS_COLOUR[status ?? "unknown"]);
}

export function gateColourThree(status: string | null | undefined): string {
  return threeHSL(GATE_STATUS_COLOUR[status ?? "unknown"]);
}
