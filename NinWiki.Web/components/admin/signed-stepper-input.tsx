'use client';

// Campo de valor com SINAL e setinhas (para os atributos de item/arma: "+2", "-1", "0"): seta para cima soma 1, seta para baixo tira 1.
// O valor aparece sempre com sinal: positivo "+2", negativo "-1" e zero "0". Dá para digitar a mão também ("+5%", "-3"): as setas mexem
// no número e preservam o que vier depois dele (ex.: "+5%" -> "+6%"). Guarda TEXTO (a API guarda o valor do atributo como texto).

import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** Separa "+5%" em número (5) e resto ("%"); texto sem número vira 0 com o texto inteiro como resto. */
function parse(value: string): { n: number; rest: string } {
  const m = /^\s*([+-]?)\s*(\d+)(.*)$/.exec(value);
  if (!m) return { n: 0, rest: value.trim() };
  return { n: (m[1] === '-' ? -1 : 1) * Number(m[2]), rest: m[3] };
}

/** Número com sinal visível: 2 -> "+2", -1 -> "-1", 0 -> "0" (o resto, como "%", vai junto). */
export function formatSigned(n: number, rest = ''): string {
  return `${n > 0 ? '+' : ''}${n}${rest}`;
}

/** Soma `delta` ao valor em texto (ex.: "+2" + 1 = "+3"; "0" - 1 = "-1"). */
export function stepSigned(value: string, delta: number): string {
  const { n, rest } = parse(value);
  return formatSigned(n + delta, rest);
}

/** Campo de texto com as setinhas de sinal (cima = +1, baixo = -1). */
export function SignedStepperInput({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative w-32 shrink-0 ${className ?? ''}`}>   {/* largura fixa: o numero com sinal (ex.: +12) sempre cabe, o seletor ao lado ocupa o resto */}
      <Input
        value={value}
        placeholder={placeholder}
        inputMode="text"
        className="pr-8 text-center tabular-nums"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(stepSigned(value, e.key === 'ArrowUp' ? 1 : -1));
          }
        }}
      />
      <div className="absolute inset-y-0 right-1 flex flex-col justify-center">
        <button type="button" tabIndex={-1} aria-label="+1" onClick={() => onChange(stepSigned(value, 1))} className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" tabIndex={-1} aria-label="-1" onClick={() => onChange(stepSigned(value, -1))} className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
