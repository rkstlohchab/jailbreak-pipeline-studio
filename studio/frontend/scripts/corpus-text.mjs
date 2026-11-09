import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export async function corpusText(record, directory) {
  if (!/^[a-zA-Z0-9_-]+$/.test(record.slug)) throw new Error('Invalid corpus slug');
  let text = record.prompt_text;
  if (typeof text !== 'string') {
    try { text = await readFile(path.join(directory, '_prompts', `${record.slug}.txt`), 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { prompt_text: null, prompt_text_status: 'missing' };
    }
  }
  // Never pair a classification with different text or follow workstation paths.
  if (createHash('sha256').update(text).digest('hex') !== record.content_hash) {
    return { prompt_text: null, prompt_text_status: 'mismatch' };
  }
  return { prompt_text: text, prompt_text_status: 'verified' };
}
