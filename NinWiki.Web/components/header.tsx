'use client';

// Cabecalho fixo do site publico (nao aparece dentro do /admin, que
// tem seu proprio layout com admin-header.tsx e admin-sidebar.tsx).
//
// SUPORTE MOBILE: o <nav> de linha horizontal some em telas pequenas
// (classe "hidden md:flex") e um botao de hamburguer (☰) o substitui,
// abrindo um painel deslizante (Sheet) com os mesmos links - o padrao
// inverso, "flex md:hidden".
//
// LINKS OFICIAIS (Steam/Discord): ficam separados do array `navItems`
// de proposito - sao links EXTERNOS (saem do site), exibidos so' como
// icone de marca (ver components/icons/brand-icons.tsx), nao como
// texto no meio do menu de categorias.

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/language-selector';
import { ColorThemeToggle } from '@/components/color-theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { SteamIcon, DiscordIcon } from '@/components/icons/brand-icons';
import { NinLockup } from '@/components/icons/nin-logo';
import { isUnderMaintenance } from '@/lib/maintenance';

// Itens do menu principal. Por decisao do mantenedor, o NavMenu fica
// enxuto de proposito: so' Home, Vilas e Mapa (+ os botoes de
// Steam/Discord, que ficam num array separado, mais abaixo). O acesso
// a Mobs/Itens/Guias/Maestrias/Armas/Missoes acontece pelos cards da
// home (components/wiki/wiki-button.tsx aponta pra /catalog/[key] e
// /masteries), nao pelo menu do topo.
//
// PARA ADICIONAR/REMOVER/REORDENAR um item do menu: e' so' editar este
// array. `key` tem que existir em dict.nav (lib/i18n.ts, nos DOIS
// idiomas pt e en). A ordem aqui e' a ordem em que os itens aparecem,
// tanto no menu de desktop quanto no menu mobile - os dois usam o
// MESMO array, entao so' precisa editar em um lugar.
const allNavItems: { key: 'home' | 'blog' | 'tournaments' | 'village' | 'map'; href: string }[] = [
  { key: 'home', href: '/' },
  { key: 'blog', href: '/blog' },
  { key: 'tournaments', href: '/tournaments' },
  { key: 'village', href: '/village' },
  { key: 'map', href: '/map' },
];

// Paginas em manutencao (lib/maintenance.ts) NAO aparecem no menu: nao ha' motivo de mostrar o que ainda nao esta pronto.
const navItems = allNavItems.filter((item) => !isUnderMaintenance(item.href));

// Links oficiais do jogo (fora do nosso site). Confirmados nas paginas
// oficiais: loja da Steam e servidor de Discord do Nin Online.
// Se a equipe tiver um link de convite proprio do Discord (o link pode
// ser regenerado/expirar), trocar so' o `href` abaixo.
const officialLinks = [
  {
    label: 'Steam',
    href: 'https://store.steampowered.com/app/1674010/Nin_Online',
    Icon: SteamIcon,
    hoverClass: 'hover:text-[#66c0f4] hover:bg-[#66c0f4]/10',
  },
  {
    label: 'Discord',
    href: 'https://discord.com/invite/ninonline',
    Icon: DiscordIcon,
    hoverClass: 'hover:text-[#5865F2] hover:bg-[#5865F2]/10',
  },
];

/** Cabecalho do site: logo, menu (Inicio, Blog, Vilas, Mapa), Steam/Discord, idioma e tema. */
export function Header() {
  const { dict } = useLanguage();
  // Controla se o painel do menu mobile esta aberto. Precisamos deste
  // estado (em vez de deixar o Sheet se auto-controlar) para poder
  // FECHAR o painel programaticamente quando o usuario clica em um
  // link (senao o painel ficaria aberto por cima da nova pagina).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    // sticky + backdrop-blur: o header fica fixo no topo ao rolar a
    // pagina, com um leve efeito de "vidro fosco" sobre o conteudo por baixo.
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 md:h-20 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <NinLockup />
          </Link>
        </div>

        {/* Menu de DESKTOP: linha horizontal de botoes, so' visivel a
            partir de telas medias (md = 768px) para cima. */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.key} href={item.href}>
              <Button variant="ghost" size="sm" className="text-sm">
                {dict.nav[item.key]}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {/* Botoes de Steam/Discord - visiveis em qualquer tamanho de
              tela (nao entram no menu mobile, ficam sempre acessiveis
              ao lado do idioma/tema). Cada um ganha a cor de hover da
              propria marca (azul Steam / roxo Discord), pra ficar
              claro que sao links de fora do site, nao mais uma
              categoria do wiki. */}
          {officialLinks.map(({ label, href, Icon, hoverClass }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" title={label}>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 text-muted-foreground transition-colors ${hoverClass}`}
                aria-label={`Abrir ${label} do Nin Online (nova aba)`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </Button>
            </a>
          ))}

          <LanguageSelector />
          <ColorThemeToggle />
          <ThemeToggle />

          {/* Menu MOBILE: botao de hamburguer, so' visivel ABAIXO de
              md (o inverso do <nav> acima). Ao clicar, abre um Sheet
              (painel deslizante) vindo da direita com os mesmos links. */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label={dict.nav.openMenu}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <nav className="mt-8 flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    // Fecha o painel ao navegar - sem isso, o Sheet
                    // continuaria aberto por cima da pagina de destino.
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button variant="ghost" className="w-full justify-start text-base">
                      {dict.nav[item.key]}
                    </Button>
                  </Link>
                ))}
              </nav>

              {/* Steam/Discord tambem dentro do painel mobile, como
                  botoes com texto (nao so' icone) - no celular ha'
                  espaco de sobra e fica mais claro pra onde cada um leva. */}
              <div className="mt-6 flex flex-col gap-1 border-t border-border pt-4">
                {officialLinks.map(({ label, href, Icon, hoverClass }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start gap-2.5 text-base text-muted-foreground ${hoverClass}`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {label}
                    </Button>
                  </a>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
