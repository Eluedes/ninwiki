'use client';

// Seletor de emoji para os campos "Icon (emoji)" do painel: um botao ao lado do campo de texto abre uma janelinha com abas por assunto
// (armas, itens, comida, natureza, bichos, fantasia, simbolos...) e um clique coloca o emoji no campo. Nao substitui o campo: da' para
// continuar digitando/colando qualquer emoji. Nao depende de biblioteca: as listas ficam aqui mesmo (so' emojis que combinam com o jogo).

import { useState } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';

/** Abas do seletor: rotulo em ingles/portugues + emojis (uma string; cada emoji e' um "caractere" visual). */
const GROUPS: { id: string; en: string; pt: string; emojis: string }[] = [
  { id: 'items', en: 'Items', pt: 'Itens',
    emojis: '📦🎁🧰🪙💰💎💍📿👑🎒👜🧳🔑🗝️📜📃📄📘📗📙📕📚📖🧾🗺️🧭⏳⌛🕯️🪔🔮🧿🪬🏺🪞🧪⚗️💊💉🩹🧴🪶🪵🧱🪨⛓️🧲🔔📯🪄🎴🃏🧸🪁🪆🎲' },
  { id: 'weapons', en: 'Weapons', pt: 'Armas',
    emojis: '⚔️🗡️🔪🪓🏹🛡️🔱⚒️🛠️🔨⛏️🪚🔧🪛🔫💣🧨💥🪃🥊🥋🎯🪝🧹🪄🦯' },
  { id: 'clothes', en: 'Clothes', pt: 'Roupas',
    emojis: '👕👖🧥🥼🦺👘🥻👗👔🧣🧤🧦👢👞👟🥾👒🎩🧢⛑️🪖👓🕶️🥽😷🎭' },
  { id: 'food', en: 'Food', pt: 'Comida',
    emojis: '🍎🍏🍐🍊🍋🍌🍉🍇🍓🫐🍒🍑🥭🍍🥥🥝🍅🥕🌽🌶️🥔🍠🥐🍞🧀🥚🍳🥩🍗🍖🌭🍔🍟🍕🥪🌮🍣🍱🍙🍚🍘🍥🥟🍢🍡🍧🍨🍦🍰🎂🍪🍫🍬🍭🍯🍵🍶🍺🍷🥛☕🧃🧋' },
  { id: 'nature', en: 'Nature', pt: 'Natureza',
    emojis: '🔥💧🌊⚡❄️🌪️🌈☀️🌙⭐🌟✨☄️🌍🌋⛰️🏔️🌲🌳🌴🌵🌿☘️🍀🍁🍂🍃🌱🌾🌸🌺🌻🌹🌷🍄🪸🪨💨☁️🌧️⛈️🌩️🌫️' },
  { id: 'animals', en: 'Animals', pt: 'Bichos',
    emojis: '🐺🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐒🦍🐔🐧🐦🦅🦉🦇🐗🐴🦄🐝🐛🦋🐌🐞🐜🪲🦟🦗🕷️🕸️🦂🐢🐍🦎🦖🐙🦑🦀🦞🦐🐠🐟🐬🐳🦈🐊🐉🐲🦕🐇🐁🐀🐿️🦔🦌🐘🦏🦛🐪🦒🦘🦥🦦🪱🪼' },
  { id: 'fantasy', en: 'Fantasy', pt: 'Fantasia',
    emojis: '💀☠️👻👽👾🤖😈👹👺🤡🧙🧛🧟🧞🧜🧚🧝🥷🦸🦹👑🪽😇🎃🕉️☯️☸️🔯🕎✡️🛐⚜️🔰🪬🧿📿' },
  { id: 'people', en: 'People', pt: 'Pessoas',
    emojis: '😀😎🤓😤😡🥶🥵😱🤔😴🤢🤕🤠🥳😏🙂🙃😇👶🧒👦👧🧑👨👩🧓👴👵👮🕵️💂👷🤴👸👳🧕🤵👰🦸‍♂️🥷' },
  { id: 'symbols', en: 'Symbols', pt: 'Símbolos',
    emojis: '❤️🧡💛💚💙💜🖤🤍💔💯💢💫💦💤🔰⚠️🚫❌⭕✅❎➕➖➗✖️♾️❓❗🔴🟠🟡🟢🔵🟣⚫⚪🟤🔶🔷🔸🔹▶️⏩🔁🔀🔃🔝🆕🆒🆓' },
  { id: 'places', en: 'Places', pt: 'Lugares',
    emojis: '🏠🏡🏘️🏯🏰⛩️🕌🛕⛪🗼🗽🏛️🏗️🏭🏫🏥🏪🏨⛺🏕️🌉🌁🌃🌄🌅🌆🌇🏝️🏜️⛲🛖🚪🪜🛏️🛋️🚩🏴🏳️🏁' },
];

/** Botao + janelinha de emojis; `onPick` recebe o emoji clicado (quem usa coloca no campo, ex.: setValue('icon', emoji)). */
export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const { locale, dict } = useLanguage();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(GROUPS[0].id);
  const current = GROUPS.find((g) => g.id === group) ?? GROUPS[0];
  const emojis = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(current.emojis), (s) => s.segment);
  const label = dict.admin.emojiPicker;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className={cn('shrink-0', className)} title={label} aria-label={label}>
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <button
              key={g.id} type="button" onClick={() => setGroup(g.id)}
              className={cn('rounded-full border px-2 py-0.5 text-xs transition-colors', g.id === group ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}
            >
              {locale === 'pt' ? g.pt : g.en}
            </button>
          ))}
        </div>
        <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
          {emojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`} type="button" onClick={() => { onPick(emoji); setOpen(false); }}
              className="flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-secondary"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
