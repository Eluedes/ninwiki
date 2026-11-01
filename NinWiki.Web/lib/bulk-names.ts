// Leitura da lista colada na importacao de inscritos do torneio (espelha a validacao de NinWiki.Api/app/api/tournaments.py::add_guests_bulk;
// a API revalida tudo, aqui e' so' a previa). Cada linha vira UM item: um inscrito individual ou uma EQUIPE.
//
//   Naruto                          inscrito individual (varios nomes separados por virgula/ponto e virgula/tab na mesma linha tambem)
//   Sakura;3                        individual com seed (a lista e' ordenada pelos seeds)
//   Time Alpha: Sasuke, Sakura      equipe COM nome (o nome vem antes dos dois pontos; integrantes por virgula, + ou &)
//   Itachi + Kisame                 equipe SEM nome (integrantes separados por + ou &): ela aparece com o nome dos integrantes ("Itachi & Kisame")
// Numeracao no comeco da linha ("1.", "2)", "-", "*") e' ignorada.

export const MAX_NAME_LENGTH = 60;
export const MAX_ENTRIES = 256;
export const MAX_TEAM_SIZE = 10;

export type BulkReason = 'duplicate' | 'too_long' | 'invalid' | 'full' | 'team_too_big';
/** Um item da lista: `name` e' o nome da equipe (opcional); 1 integrante sem nome = inscrito individual. */
export interface BulkItem { name: string | null; members: string[] }
export interface BulkParsed {
  /** Itens que entrariam, na ordem final (ja' ordenados pelo seed quando a lista traz a coluna). */
  accepted: BulkItem[];
  /** Nomes que ficam de fora e o motivo. */
  skipped: { name: string; reason: BulkReason }[];
  /** Linhas/campos vazios ignorados. */
  empty: number;
  /** Quantos jogadores entrariam no total e em quantas equipes (itens com 2+ integrantes). */
  players: number;
  teams: number;
}

/** Chave para comparar nomes sem diferenciar maiusculas, acentos nem espacos repetidos. */
export function nameKey(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

/** Nome mostrado de um item: o nome da equipe ou, sem ele, os nomes dos integrantes ("A & B"). */
export function itemLabel(item: BulkItem): string {
  return item.name ?? item.members.join(' & ');
}

const clean = (s: string) => s.trim().replace(/^"(.*)"$/, '$1').trim().split(/\s+/).filter(Boolean).join(' ');

/** Quebra o texto em itens brutos (nome da equipe, integrantes, seed), sem validar ainda. */
function splitItems(text: string): { name: string | null; members: string[]; seed: number | null }[] {
  const out: { name: string | null; members: string[]; seed: number | null }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*(?:\d{1,3}[.)]|[-*•])\s+/, '').trim();
    if (!line) { out.push({ name: null, members: [''], seed: null }); continue; }   // linha vazia: conta como vazio
    const colon = line.indexOf(':');
    if (colon > 0 && line.slice(colon + 1).trim()) {   // "Nome da equipe: A, B, C"
      const members = line.slice(colon + 1).split(/[,;\t+&]/).map(clean);
      out.push({ name: clean(line.slice(0, colon)) || null, members, seed: null });
      continue;
    }
    if (/[+&]/.test(line)) {   // "A + B" / "A & B": equipe sem nome
      out.push({ name: null, members: line.split(/[+&]/).map(clean), seed: null });
      continue;
    }
    const parts = line.split(/[;,\t]/).map(clean);   // individuais (como antes), com "nome;seed"
    if (parts.length === 2 && /^\d{1,4}$/.test(parts[1]) && parts[0]) out.push({ name: null, members: [parts[0]], seed: Number(parts[1]) });
    else for (const p of parts) out.push({ name: null, members: [p], seed: null });
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
  const accepted: BulkItem[] = [];
  const skipped: BulkParsed['skipped'] = [];
  let empty = 0;
  let players = 0;
  for (const it of items) {
    if (it.members.length > MAX_TEAM_SIZE) { skipped.push({ name: (it.name ?? it.members.slice(0, 2).join(' & ')).slice(0, 80), reason: 'team_too_big' }); continue; }
    const ok: string[] = [];
    for (const name of it.members) {
      if (!name) { empty++; continue; }
      const reason: BulkReason | null = name.length > MAX_NAME_LENGTH ? 'too_long' : !/[\p{L}\p{N}]/u.test(name) ? 'invalid' : seen.has(nameKey(name)) ? 'duplicate' : players + ok.length >= room ? 'full' : null;
      if (reason) { skipped.push({ name: name.slice(0, 80), reason }); continue; }
      seen.add(nameKey(name));
      ok.push(name);
    }
    if (ok.length === 0) continue;
    const teamName = it.name ? it.name.slice(0, MAX_NAME_LENGTH) : null;
    accepted.push({ name: ok.length >= 2 || (teamName && it.members.length >= 2) ? teamName : null, members: ok });
    players += ok.length;
  }
  return { accepted, skipped, empty, players, teams: accepted.filter((a) => a.members.length >= 2).length };
}
