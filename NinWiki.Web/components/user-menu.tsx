'use client';

// Menu do LEITOR logado com o Discord (nao confundir com o login da equipe do painel /admin): avatar + nome, "Meu perfil", "Meus torneios" e "Sair".
// Deslogado mostra "Entrar com Discord". Duas apresentacoes do mesmo estado: <UserMenu> (menu suspenso do cabecalho, desktop; Radix cuida de foco,
// teclado e aria) e <UserMenuMobile> (lista dentro do painel do menu movel). O estado vem de useAccount(), chamado uma vez no <Header>.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, Trophy, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/components/providers/language-provider';
import { getReaderMe, readerLoginUrl, readerLogout, type ApiReader } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';

/** Leitor logado (ou null), se a consulta ja' terminou, e a acao de sair (apaga o cookie do leitor pela API, que confere origem/CSRF, e volta para a pagina inicial). */
export function useAccount() {
  const [state, setState] = useState<{ reader: ApiReader | null; loaded: boolean }>({ reader: null, loaded: false });
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    getReaderMe()
      .then((reader) => alive && setState({ reader, loaded: true }))
      .catch(() => alive && setState({ reader: null, loaded: true }));
    return () => { alive = false; };
  }, []);

  const signOut = useCallback(async () => {
    setError(false);
    try {
      await readerLogout();
      setState({ reader: null, loaded: true });
      router.push('/');
      router.refresh();
    } catch {
      setError(true);
    }
  }, [router]);

  return { ...state, signOut, error };
}
export type Account = ReturnType<typeof useAccount>;

/** Avatar do Discord (ou um icone se nao houver). */
function Avatar({ reader, className }: { reader: ApiReader; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- avatar externo do Discord
  return reader.avatarUrl ? <img src={reader.avatarUrl} alt="" className={`${className} rounded-full`} /> : <UserRound className={className} aria-hidden />;
}

/** Botao "Entrar com Discord" (volta para a pagina atual depois do login). */
function SignInButton({ className }: { className?: string }) {
  const { dict } = useLanguage();
  const pathname = usePathname();
  return (
    <Button asChild size="sm" className={className}>
      <a href={readerLoginUrl(pathname)}>{dict.discord.signIn}</a>
    </Button>
  );
}

/** Menu suspenso do cabecalho (desktop). Enquanto a consulta nao termina, nao mostra nada (evita piscar o botao de entrar). */
export function UserMenu({ account }: { account: Account }) {
  const { dict } = useLanguage();
  const d = dict.discord;
  if (!account.loaded) return null;
  if (!account.reader) return <SignInButton className="hidden md:inline-flex" />;
  const { reader } = account;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="hidden h-9 max-w-44 gap-2 px-2 md:inline-flex" aria-label={`${d.menuLabel}: ${reader.username}`}>
          <Avatar reader={reader} className="h-6 w-6 shrink-0" />
          <span className="truncate text-sm">{reader.username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{fill(d.signedInAs, { name: reader.username })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/profile"><UserRound className="mr-2 h-4 w-4" aria-hidden />{d.myProfile}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/tournaments?mine=1"><Trophy className="mr-2 h-4 w-4" aria-hidden />{d.myTournaments}</Link></DropdownMenuItem>
        {reader.isSuperAdmin && <DropdownMenuItem asChild><Link href="/admin"><LayoutDashboard className="mr-2 h-4 w-4" aria-hidden />{d.adminPanel}</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { void account.signOut(); }}><LogOut className="mr-2 h-4 w-4" aria-hidden />{d.signOut}</DropdownMenuItem>
        {account.error && <p role="alert" className="px-2 py-1.5 text-xs text-destructive">{d.signOutError}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Versao para o painel do menu movel: lista de botoes (avatar + nome, perfil, torneios, sair). `onNavigate` fecha o painel. */
export function UserMenuMobile({ account, onNavigate }: { account: Account; onNavigate: () => void }) {
  const { dict } = useLanguage();
  const d = dict.discord;
  if (!account.loaded) return null;
  if (!account.reader) return <div className="mt-6 border-t border-border pt-4"><SignInButton className="w-full" /></div>;
  const { reader } = account;
  return (
    <div className="mt-6 flex flex-col gap-1 border-t border-border pt-4" aria-label={d.menuLabel}>
      <p className="mb-1 flex items-center gap-2 px-2 text-sm text-muted-foreground"><Avatar reader={reader} className="h-6 w-6 shrink-0" /><span className="truncate">{fill(d.signedInAs, { name: reader.username })}</span></p>
      <Link href="/profile" onClick={onNavigate}><Button variant="ghost" className="w-full justify-start gap-2.5 text-base"><UserRound className="h-[18px] w-[18px]" aria-hidden />{d.myProfile}</Button></Link>
      <Link href="/tournaments?mine=1" onClick={onNavigate}><Button variant="ghost" className="w-full justify-start gap-2.5 text-base"><Trophy className="h-[18px] w-[18px]" aria-hidden />{d.myTournaments}</Button></Link>
      {reader.isSuperAdmin && <Link href="/admin" onClick={onNavigate}><Button variant="ghost" className="w-full justify-start gap-2.5 text-base"><LayoutDashboard className="h-[18px] w-[18px]" aria-hidden />{d.adminPanel}</Button></Link>}
      <Button variant="ghost" className="w-full justify-start gap-2.5 text-base" onClick={() => { onNavigate(); void account.signOut(); }}><LogOut className="h-[18px] w-[18px]" aria-hidden />{d.signOut}</Button>
      {account.error && <p role="alert" className="px-2 text-xs text-destructive">{d.signOutError}</p>}
    </div>
  );
}
