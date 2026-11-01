'use client';

// Convite do bot do Wiki no Discord: botao (rodape) e cartao da Home com o que o bot faz e o passo a passo.
// Link e permissoes: ver lib/bot-invite.ts. Sem NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID configurado nada e' desenhado.

import { useLanguage } from '@/components/providers/language-provider';
import { botInviteUrl } from '@/lib/bot-invite';
import { cn } from '@/lib/utils';

/** Logo do Discord (o lucide nao traz icones de marca). Decorativo: o texto do botao ja' diz tudo. */
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.42s.956-2.42 2.157-2.42c1.21 0 2.176 1.095 2.157 2.42 0 1.334-.956 2.42-2.157 2.42Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.42s.956-2.42 2.157-2.42c1.21 0 2.176 1.095 2.157 2.42 0 1.334-.947 2.42-2.157 2.42Z" />
    </svg>
  );
}

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
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        compact
          ? 'border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-[#5865F2]/60 hover:text-card-foreground'
          : 'bg-[#5865F2] px-6 py-3 text-sm text-white shadow-lg shadow-[#5865F2]/25 hover:bg-[#4752c4]',
        className
      )}
    >
      <DiscordIcon className={compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
      {compact ? dict.invite.buttonShort : dict.invite.button}
      <span className="sr-only"> (Discord)</span>
    </a>
  );
}

/** Cartao da Home: o que o bot faz (4 comandos de exemplo), passo a passo em 3 etapas e o botao. So' aparece com o Application ID configurado. */
export function BotInviteCard() {
  const { dict } = useLanguage();
  if (!botInviteUrl()) return null;
  const t = dict.invite;
  return (
    <section
      aria-labelledby="bot-invite-title"
      className="mt-12 overflow-hidden rounded-2xl border border-[#5865F2]/30 bg-card bg-gradient-to-br from-[#5865F2]/15 via-card to-card"
    >
      <div className="grid gap-8 p-6 md:grid-cols-2 md:p-8">
        <div className="flex flex-col items-start gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#5865F2]/15 px-3 py-1 text-xs font-semibold text-[#8f9bff]">
            <DiscordIcon className="h-3.5 w-3.5" />
            {t.badge}
          </span>
          <h2 id="bot-invite-title" className="text-2xl font-bold tracking-tight">{t.title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t.subtitle}</p>
          <BotInviteButton className="w-full sm:w-auto" />
          <p className="max-w-md text-xs text-muted-foreground/80">{t.perms}</p>
          <p className="max-w-md text-xs text-muted-foreground/80">{t.note}</p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.examplesTitle}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {t.examples.map((e) => (
                <li key={e.cmd} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                  <code className="text-sm font-semibold text-[#8f9bff]">{e.cmd}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.stepsTitle}</h3>
            <ol className="space-y-2">
              {t.steps.map((s, i) => (
                <li key={s.title} className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-white">{i + 1}</span>
                  <p className="text-sm">
                    <span className="font-semibold">{s.title}</span>
                    <span className="text-muted-foreground"> — {s.text}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
