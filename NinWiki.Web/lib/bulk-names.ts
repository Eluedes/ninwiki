// Leitura da lista colada na importacao de inscritos do torneio (espelha a validacao de NinWiki.Api/app/api/tournaments.py::add_guests_bulk;
// a API revalida tudo, aqui e' so' a previa). Aceita um nome por linha, nomes separados por virgula/ponto e virgula/tab e linhas CSV `nome;seed`.

export const MAX_NAME_LENGTH = 60;
export const MAX_ENTRIES = 256;

export type BulkReason = 'duplicate' | 'too_long' | 'invalid' | 'full';
export interface BulkParsed {
  /** Nomes que entrariam, na ordem final (ja' ordenados pelo seed quando a lista traz a coluna). */
  accepted: string[];
  /** Nomes que ficam de fora e o motivo. */
  skipped: { name: string; reason: BulkReason }[];
  /** Linhas/campos vazios ignorados. */
  empty: number;
}

/** Chave para comparar nomes sem diferenciar maiusculas, acentos nem espacos repetidos. */
export function nameKey(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

/** Quebra o texto em itens `{ name, seed }`. `nome;seed` (segundo campo inteiro) vira nome + seed; qualquer outra linha com separador vira varios nomes. */
function splitItems(text: string): { name: string; seed: number | null }[] {
  const out: { name: string; seed: number | null }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/[;,\t]/).map((p) => p.trim().replace(/^"(.*)"$/, '$1').trim());
    if (parts.length === 2 && /^\d{1,4}$/.test(parts[1]) && parts[0]) out.push({ name: parts[0], seed: Number(parts[1]) });
    else for (const p of parts) out.push({ name: p, seed: null });
  }
  return out;
}

/** Valida a lista contra os nomes ja' inscritos e o espaco que sobra (MAX_ENTRIES). */
export function parseBulkNames(text: string, existing: string[]): BulkParsed {
  const items = splitItems(text);
  // Com a coluna seed, ordena por ela (sem seed vai para o fim; sort e' estavel, entao o resto mantem a ordem digitada).
  if (items.some((i) => i.seed !== null)) items.sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity));
  const seen = new Set(existing.map(nameKey));
  const room = MAX_ENTRIES - existing.length;
  const accepted: string[] = [];
  const skipped: BulkParsed['skipped'] = [];
  let empty = 0;
  for (const it of items) {
    const name = it.name.split(/\s+/).filter(Boolean).join(' ');
    if (!name) { empty++; continue; }
    const reason: BulkReason | null = name.length > MAX_NAME_LENGTH ? 'too_long' : !/[\p{L}\p{N}]/u.test(name) ? 'invalid' : seen.has(nameKey(name)) ? 'duplicate' : accepted.length >= room ? 'full' : null;
    if (reason) { skipped.push({ name: name.slice(0, 80), reason }); continue; }
    seen.add(nameKey(name));
    accepted.push(name);
  }
  return { accepted, skipped, empty };
}
