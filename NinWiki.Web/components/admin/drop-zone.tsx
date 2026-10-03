'use client';

// Area de arrastar-e-soltar: envolve qualquer conteudo e, ao arrastar arquivos do computador por cima, mostra um aviso
// ("Solte as imagens aqui") e entrega os arquivos soltos em `onFiles`. So' reage a ARQUIVOS (arrastar texto ou links da pagina nao ativa).

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

/** True se o arrasto atual carrega arquivos do computador. */
function hasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

/** Envolve `children` numa area que aceita arquivos soltos; `label` e' o texto do aviso. */
export function DropZone({ onFiles, label, className, children, disabled = false }: {
  onFiles: (files: File[]) => void;
  label: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0); // dragenter/dragleave disparam tambem nos filhos: conta para nao piscar

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={(e) => { if (disabled || !hasFiles(e)) return; e.preventDefault(); depth.current += 1; setOver(true); }}
      onDragOver={(e) => { if (disabled || !hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={(e) => { if (disabled || !hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/85 text-primary backdrop-blur-sm">
          <UploadCloud className="h-10 w-10" />
          <p className="text-sm font-semibold">{label}</p>
        </div>
      )}
    </div>
  );
}
