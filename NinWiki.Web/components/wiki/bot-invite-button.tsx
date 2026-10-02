'use client';

// Botao "Convidar o bot" - abre o convite do bot do Wiki no Discord (permissoes minimas, ver lib/bot-invite.ts).
// Sem NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID configurado nao desenha nada.

import { Bot } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { botInviteUrl } from '@/lib/bot-invite';
import { cn } from '@/lib/utils';

/** Botao de convite do bot; `compact` = versao pequena (rodape), senao o botao grande (cartao da Home). */
export function BotInviteButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { dict } = useLanguage();
  const url = botInviteUrl();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        compact
          ? 'border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-card-foreground'
          : 'bg-[#5865F2] px-5 py-2.5 text-sm text-white hover:bg-[#4752c4]',
        className
      )}
    >
      <Bot className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {compact ? dict.invite.buttonShort : dict.invite.button}
    </a>
  );
}

/** Cartao da Home que apresenta o bot e convida (so' aparece com o Application ID configurado). */
export function BotInviteCard() {
  const { dict } = useLanguage();
  if (!botInviteUrl()) return null;
  return (
    <section className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-[#5865F2]/30 bg-gradient-to-br from-[#5865F2]/10 via-card to-card p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{dict.invite.title}</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{dict.invite.subtitle}</p>
        <p className="mt-1 text-xs text-muted-foreground/80">{dict.invite.perms}</p>
      </div>
      <BotInviteButton className="shrink-0" />
    </section>
  );
}
