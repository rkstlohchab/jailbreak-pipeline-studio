import type { Paper, PaperCategory, ResearchAccess } from "../data/research-papers";

export type PaperFilters = { query?: string; category?: PaperCategory | "all"; access?: ResearchAccess | "all"; year?: string; savedOnly?: boolean; savedIds?: string[] };
const searchable = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
export function filterPapers(papers: Paper[], filters: PaperFilters): Paper[] {
  const terms = searchable(filters.query?.trim() ?? "").split(/\s+/).filter(Boolean);
  return papers.filter((p) => {
    if (filters.category && filters.category !== "all" && p.category !== filters.category) return false;
    if (filters.access && filters.access !== "all" && p.access !== filters.access) return false;
    if (filters.year && filters.year !== "all" && String(p.year) !== filters.year) return false;
    if (filters.savedOnly && !filters.savedIds?.includes(p.id)) return false;
    const haystack = searchable([p.id, p.title, ...p.authors, p.summary, ...p.tags].join(" "));
    return terms.every((term) => haystack.includes(term));
  }).sort((a, b) => b.published.localeCompare(a.published) || a.title.localeCompare(b.title));
}
export function authorLabel(authors: string[]) {
  const name = (author: string) => author.includes(", ") ? author.split(", ").reverse().join(" ") : author;
  return authors.length > 2 ? `${name(authors[0])} et al.` : authors.map(name).join(" & ");
}
const bibEscape = (s: string) => s.replace(/[\\{}%&#_$~^]/g, (c) => ({ "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" }[c] ?? `\\${c}`));
export function papersToBibtex(papers: Paper[]) {
  return papers.map((p) => {
    const fields = [
      `  title = {{${bibEscape(p.title)}}}`,
      `  author = {${p.authors.map(bibEscape).join(" and ")}}`,
      `  year = {${p.year}}`,
      ...(p.arxivId ? [`  eprint = {${p.arxivId}}`, "  archivePrefix = {arXiv}"] : []),
      `  url = {${p.url}}`,
      `  note = {${bibEscape(p.source)}; source checked ${p.sourceCheckedAt}}`,
    ];
    return `@misc{studio_${p.id.replace(/[^a-zA-Z0-9]/g, "_")},\n${fields.join(",\n")}\n}`;
  }).join("\n\n") + "\n";
}
export function downloadText(filename: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
