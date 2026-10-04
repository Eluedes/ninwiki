'use client';

// Barra de progresso de envio (upload) usada em TODOS os envios do painel: campo de imagem, editor do blog, banco de imagens e anexos de avisos.
// Mostra a porcentagem e os MB ja' mandados ("Enviando 2,3 / 4,8 MB · 48%"). Quando os bytes todos sairam (100%) mas o servidor ainda
// nao respondeu, troca o texto para "processando" - assim da' para ver se a lentidao e' a SUA conexao (barra andando devagar) ou o servidor (barra cheia esperando).
// Aceita um arquivo ou um lote (`detail` = "3/10 arquivos"). Nao faz nada sozinha: so' desenha o que recebe.

import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';

/** Tamanho legivel: "850 KB" ou "2,3 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Barra de envio: `loaded`/`total` em bytes; `detail` e' um texto extra opcional (ex.: "3/10 arquivos"). */
export function UploadProgressBar({ loaded, total, detail, className }: { loaded: number; total: number; detail?: string; className?: string }) {
  const { dict } = useLanguage();
  const t = dict.admin.uploadProgress;
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const waiting = total > 0 && loaded >= total;
  return (
    <div className={cn('space-y-1', className)} role="status" aria-live="polite">
      <Progress value={percent} className="h-2" />
      <p className="text-xs text-muted-foreground">
        {waiting ? t.processing : `${t.sending} ${formatBytes(loaded)} / ${formatBytes(total)} · ${percent}%`}
        {detail ? ` · ${detail}` : ''}
      </p>
    </div>
  );
}
