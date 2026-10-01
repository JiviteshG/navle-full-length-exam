import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
export const readJSON = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
export const blueprint = readJSON('data/blueprint.json');
export const bank = readJSON('data/questions/index.json').files.flatMap((f) => readJSON(`data/questions/${f}`));
