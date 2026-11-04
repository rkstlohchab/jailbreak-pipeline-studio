import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studio = path.dirname(frontend);
const repo = path.dirname(studio);
const records = {};
const readJson = async (filename) => JSON.parse(await readFile(filename, 'utf8'));
const files = async (directory) => (await readdir(directory)).sort();
const put = (endpoint, data) => { records[endpoint] = { data }; };
const taxonomyNames = ['techniques', 'failure_cases', 'refusal_types', 'architecture_layers', 'model_families', 'verdicts', 'asks'];
for (const name of taxonomyNames) put(`taxonomy/${name}`, await readJson(path.join(studio, 'data/taxonomy', `${name}.json`)));
put('taxonomy', { kinds: taxonomyNames });

const sessions = [];
for (const filename of await files(path.join(studio, 'data/sessions'))) {
  if (!/^sess_[\w-]+\.json$/.test(filename)) continue;
  const data = await readJson(path.join(studio, 'data/sessions', filename));
  put(`sessions/${data.trajectory_id}`, data);
  const { trajectory_id, goal, outcome, created_at, model } = data;
  sessions.push({ trajectory_id, goal, outcome, created_at, model, response_chars: data.response.character_count });
}
put('sessions', sessions);

const corpus = [];
for (const filename of await files(path.join(studio, 'data/corpus'))) {
  if (!filename.endsWith('.json') || filename === 'manifest.json') continue;
  const data = await readJson(path.join(studio, 'data/corpus', filename));
  if (!data.slug || !data.classification) continue;
  // Collection metadata uses a portable name; workstation paths stay on the workstation.
  data.source_path = data.name;
  put(`corpus/${data.slug}`, data);
  corpus.push({ slug: data.slug, name: data.name, source_path: data.name,
    content_hash: data.content_hash, character_count: data.character_count,
    overall_tier: data.classification.meta?.overall_tier ?? null,
    overall_strength: data.classification.meta?.overall_strength ?? null,
    techniques_detected: data.classification.techniques_detected?.length ?? 0,
    classifier_model: data.classification._classifier_meta?.classifier_model ?? null });
}
corpus.sort((a, b) => (b.overall_strength ?? 0) - (a.overall_strength ?? 0) || a.name.localeCompare(b.name));
put('corpus', corpus);

const promptFiles = [
  ['starter_prompt_v1', 'starter_prompt_v1_body.txt'],
  ['chat_prompt_v1', 'chat_prompt_v1.md'],
  ['pentest_prompt_v1', 'pentest_prompt_v1.md'],
];
const prompts = [];
for (const [name, filename] of promptFiles) {
  const text = await readFile(path.join(repo, 'Stage 2 - Diagnosis and First Build', filename), 'utf8');
  const prompt = { name, path: filename, character_count: [...text].length, sha256: 'sha256:' + createHash('sha256').update(text).digest('hex') };
  put(`prompts/${name}`, { ...prompt, text });
  prompts.push(prompt);
}
put('prompts', prompts);

const exports = [];
for (const filename of await files(path.join(studio, 'datasets/export'))) {
  if (!/^[\w.-]+\.(jsonl|json|md)$/.test(filename)) continue;
  const content = await readFile(path.join(studio, 'datasets/export', filename), 'utf8');
  records[`export/${filename}`] = { content, filename };
  exports.push({ name: filename, bytes: Buffer.byteLength(content), lines: content ? content.trimEnd().split('\n').length : 0 });
}
put('export', exports);
put('health', { status: 'ok', mode: 'collection', provider: 'openai', model: '', provider_key_set: false });
const output = path.join(frontend, '.collection');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'index.json'), JSON.stringify(records));
console.log(`Prepared hosted collection: ${sessions.length} sessions, ${corpus.length} corpus entries, ${exports.length} exports.`);
