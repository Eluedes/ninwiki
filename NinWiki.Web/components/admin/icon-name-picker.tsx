'use client';

// Seletor de icone (dropdown) para jutsu/mastery: o icone e' guardado como NOME (ex.: "flame"), nao como emoji.
// Cada opcao mostra o desenho do icone + o nome, entao basta escolher na lista em vez de digitar.

import { MasteryIcon, iconNames } from '@/components/lore/mastery-icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function IconNamePicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        {/* Mostra o icone escolhido ao lado do nome (SelectValue sozinho so' mostra o texto). */}
        <span className="flex items-center gap-2">
          {value && <MasteryIcon icon={value} className="h-4 w-4" />}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {iconNames().map((name) => (
          <SelectItem key={name} value={name}>
            <span className="flex items-center gap-2">
              <MasteryIcon icon={name} className="h-4 w-4" />
              {name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
