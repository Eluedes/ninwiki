'use client';

// Listagem de Masteries no painel admin - agora com edicao (as 8
// masteries continuam sendo estrutura fixa do jogo no NUMERO delas,
// mas o CONTEUDO de cada uma - textos, icone, cor, atributos, paths -
// e' editavel via /admin/masteries/edit/{id}).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listMasteries, ApiError, type ApiMastery } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { Loader2, AlertTriangle, ExternalLink, Pencil } from 'lucide-react';

/** Lista de masteries no painel. */
export default function MasteriesAdminPage() {
  const { dict } = useLanguage();
  const t = dict.admin.masteries;
  const [masteries, setMasteries] = useState<ApiMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMasteries()
      .then(setMasteries)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.loadError))
      .finally(() => setLoading(false));
  }, [t.loadError]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">{t.genericLoadError}</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2">
          {masteries.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold"
                    style={{ backgroundColor: `${m.color}20`, color: m.color }}
                  >
                    {m.element[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-card-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.type === 'elemental' ? `${t.elemental} · ${m.element}` : t.nonElemental}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/admin/masteries/edit/${m.id}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                  title={t.edit}
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              </div>

              {m.paths.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.paths} ({m.paths.length})
                  </p>
                  {m.paths.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-card-foreground">{p.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href={`/admin/jutsus?masteryId=${m.id}`}
                className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {t.viewJutsus} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
