// Grava o cookie do PASSE de manutencao (ninwiki_pass) no endereco do SITE. A sessao da equipe mora no cookie da API (outro endereco), que o servidor do
// site nao enxerga; por isso a pagina de manutencao troca a sessao por um passe (API: POST /site/pass) e entrega o passe aqui. Antes de gravar, o passe
// e' conferido na API (assinado, nao vencido, pessoa ativa na equipe): passe falso nao vira cookie. O proxy.ts confere o cookie a cada pagina.
import { NextResponse, type NextRequest } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const PASS_COOKIE = 'ninwiki_pass';
const PASS_SECONDS = 12 * 3600;   // mesma validade do passe na API (MAINTENANCE_PASS_HOURS)
// Em producao o cookie e' sempre Secure (atras de proxy com TLS, nextUrl.protocol pode vir "http:").
const isSecure = (req: NextRequest) => process.env.NODE_ENV === 'production' || req.nextUrl.protocol === 'https:';

/** Sair da conta: apaga o cookie do passe (sem isso o site continuaria abrindo durante a manutencao por ate' 12 horas depois do logout). */
export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASS_COOKIE, '', { httpOnly: true, secure: isSecure(req), sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}

/** Recebe {token}, confere na API e responde com o cookie httpOnly do passe. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!token || token.length > 2000) return NextResponse.json({ ok: false }, { status: 400 });
  let valid = false;
  try {
    const res = await fetch(`${API}/site/status`, { headers: { 'X-Maintenance-Pass': token }, cache: 'no-store', signal: AbortSignal.timeout(4000) });
    const status = res.ok ? await res.json() : null;
    // Com a manutencao desligada o passe nao e' conferido (access = false): nesse caso nao ha' o que liberar, mas tambem nao ha' bloqueio.
    valid = Boolean(status?.access);
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.json({ ok: false }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASS_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'lax',
    path: '/',
    maxAge: PASS_SECONDS,
  });
  return res;
}
