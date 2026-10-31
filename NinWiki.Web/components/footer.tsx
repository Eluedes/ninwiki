'use client';

// Rodape do site publico, com aviso legal (disclaimer) e ano atual.

import { useLanguage } from '@/components/providers/language-provider';
import { NinLockup } from '@/components/icons/nin-logo';
import { BotInviteButton } from '@/components/wiki/bot-invite-button';

/** Rodape do site. */
export function Footer() {
  const { dict } = useLanguage();

  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <NinLockup size="sm" />
          <p className="max-w-lg text-sm text-muted-foreground">
            {dict.footer.disclaimer}
          </p>
          {/* new Date().getFullYear(): calculado no momento do render.
              Como este componente e' 'use client', isso roda no navegador -
              nao ha risco de o ano "congelar" numa build antiga, ja' que
              nao ha build estatica (SSG) sendo usada aqui. */}
          <BotInviteButton compact />
          <p className="text-xs text-muted-foreground">
            {dict.footer.madeWith} &middot; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
