// Script utilitario (NAO faz parte do site) que exporta os dados
// mockados de lib/*.ts para um unico arquivo JSON, consumido pelo
// script de seed do backend (NinWiki.Api/seed.py).
//
// Existe pra garantir que o banco comeca com EXATAMENTE o mesmo
// conteudo que o site mostra hoje, sem risco de erro de transcricao
// manual - roda direto contra o codigo TypeScript de verdade, nao uma
// copia digitada a mao.
//
// Uso: npx tsx scripts/export-seed-data.ts
// (gera ../../NinWiki.Api/seed_data.json)

import { entries, categories } from '../lib/data';
import {
  masteries,
  attributes,
  jutsus,
} from '../lib/masteries-data';
import { villages, clans, organizations } from '../lib/village-data';
import {
  professions,
  ninjaRanks,
  storyArcs,
  summons,
} from '../lib/guide-data';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const payload = {
  entries,
  categories,
  masteries,
  attributes,
  jutsus,
  villages,
  clans,
  organizations,
  professions,
  ninjaRanks,
  storyArcs,
  summons,
};

const outPath = join(__dirname, '../../NinWiki.Api/seed_data.json');
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
console.log(`Exportado para ${outPath}`);
console.log(
  Object.entries(payload)
    .map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.length : 1}`)
    .join('\n')
);
