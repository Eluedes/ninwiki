'use client';

// Historico de VERSOES de uma entry (painel): lista os estados anteriores (antes de cada edicao) e deixa voltar para um deles.
// Restaurar tambem entra no historico, entao da' para desfazer a restauracao. Depois de restaurar a pagina recarrega para
// mostrar o formulario com os dados voltados.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, listContentVersions, restoreContentVersion, type ApiContentVersion } from '@/lib/api-client';

/** Lista de versoes anteriores de uma entry com o botao "Restaurar". */
export function VersionHistory({ itemId }: { itemId: string }) {
  const { dict, locale } = useLanguage();
  const t = dict.admin.versionHistory;
  const [versions, setVersions] = useState<ApiContentVersion[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setVersions(await listContentVersions(itemId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    }
  }, [itemId, t.loadError]);

  useEffect(() => {
    // adiado por um instante (callback) para nao chamar setState direto dentro do efeito
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /** Pede confirmacao, restaura a versao e recarrega a pagina. */
  async function handleRestore(v: ApiContentVersion) {
    if (!window.confirm(t.confirm)) return;
    setBusyId(v.id);
    setError(null);
    try {
      await restoreContentVersion(itemId, v.id);
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.restoreError);
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-card-foreground">{t.title}</h3>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {versions === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{v.name}</span>
                <span className="text-muted-foreground"> · {new Date(v.createdAt).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US')}{v.savedBy ? ` · ${t.by} ${v.savedBy}` : ''}</span>
              </span>
              <Button type="button" size="sm" variant="outline" disabled={busyId !== null} onClick={() => handleRestore(v)}>
                {busyId === v.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                {t.restore}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
