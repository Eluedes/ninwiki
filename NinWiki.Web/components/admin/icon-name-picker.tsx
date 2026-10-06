'use client';

// Seletor visual de icone para jutsu/mastery: o icone e' guardado como NOME (ex.: "flame"), nao como emoji.
// Mostra todos os icones disponiveis em uma grade; o escolhido fica destacado.

import { MasteryIcon, iconNames } from '@/components/lore/mastery-icon';
import { cn } from '@/lib/utils';

export function IconNamePicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {iconNames().map((name) => (
        <button
          key={name}
          type="button"
          title={name}
          aria-pressed={value === name}
          onClick={() => onChange(name)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md border transition-colors',
            value === name ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
          )}
        >
          <MasteryIcon icon={name} className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
