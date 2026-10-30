'use client';

// Pagina inicial do painel (rota /admin): cards de estatisticas +
// atividade recente. Tudo aqui e' dado real da API (Conteudo, Jutsus, Blog,
// Equipe e a atividade do log) - cada cartao so' aparece pra quem tem permissao.

import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { listContentItems, listJutsus, listAuditLog, listPosts, listStaff, listErrors, type ApiAuditLogEntry, type ApiContentItemSummary } from '@/lib/api-client';
import { Bug, FileText, Boxes, Users, Zap, Loader2, Plus, Pencil, Trash2, History, Send, FileEdit, Clock } from 'lucide-react';
import Link from 'next/link';
import { NoticeBoard } from '@/components/admin/notice-board';
import { TrafficCard } from '@/components/admin/traffic-card';
import { cn, formatDateTime } from '@/lib/utils';
import { auditTarget } from '@/lib/audit-target';

// Quantos dias sem edicao pra uma entry contar como "desatualizada" -
// numero redondo, sem significado especial do jogo, so' um ponto de
// corte razoavel pra' chamar atencao. Facil de ajustar se 30 dias
// virar cedo/tarde demais na pratica.
const STALE_DAYS = 30;

/** Visao Geral do painel: quadro de avisos, estatisticas e atividade recente. */
export default function AdminOverviewPage() {
  // Titulo da aba (esta pagina e' Client Component, entao nao exporta metadata).
  useEffect(() => {
    document.title = 'Overview - Admin · Nin Online Wiki';
  }, []);

  const { dict, locale } = useLanguage();
  const { can } = useAuth();
  const t = dict.admin.overview;
  const actionConfig: Record<string, { label: string; icon: typeof Plus; className: string }> = {
    create: { label: t.actionCreated, icon: Plus, className: 'bg-emerald-900/30 text-emerald-400' },
    update: { label: t.actionUpdated, icon: Pencil, className: 'bg-sky-900/30 text-sky-400' },
    delete: { label: t.actionDeleted, icon: Trash2, className: 'bg-red-900/30 text-red-400' },
  };
  const entityTypeLabel: Record<string, string> = { content_item: t.entityContentItem, jutsu: t.entityJutsu };
  const [contentCount, setContentCount] = useState<number | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [staleItems, setStaleItems] = useState<ApiContentItemSummary[]>([]);
  const [jutsuCount, setJutsuCount] = useState<number | null>(null);
  const [postCount, setPostCount] = useState<number | null>(null);
  // "Agora" fixado uma vez (e nao chamado a cada render): Date.now() no render e' impuro e faria o numero de dias oscilar.
  const [now] = useState(() => Date.now());
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [openErrors, setOpenErrors] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<ApiAuditLogEntry[]>([]);

  useEffect(() => {
    // Sem tratamento de erro visivel em cada card de proposito: se a
    // API estiver fora do ar, cada card fica so' com o icone girando
    // (loading infinito) em vez de quebrar a pagina - o erro de
    // verdade e' mostrado em detalhe nas paginas de Conteudo/Jutsus/Log.
    listContentItems()
      .then((items) => {
        setContentCount(items.length);
        const breakdown: Record<string, number> = {};
        for (const item of items) breakdown[item.category] = (breakdown[item.category] ?? 0) + 1;
        setCategoryBreakdown(breakdown);

        setPublishedCount(items.filter((i) => i.status === 'published').length);
        setDraftCount(items.filter((i) => i.status === 'draft').length);

        // "Desatualizada" = ninguem mexe ha' mais de STALE_DAYS dias.
        // So' considera PUBLICADAS - rascunho recem-criado e' esperado
        // ficar parado ate' alguem terminar de preencher, nao e' a
        // mesma coisa que uma pagina publicada esquecida.
        const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
        const stale = items
          .filter((i) => i.status === 'published' && new Date(i.updatedAt).getTime() < cutoff)
          .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
          .slice(0, 8);
        setStaleItems(stale);
      })
      .catch(() => setContentCount(null));

    listJutsus().then((j) => setJutsuCount(j.length)).catch(() => setJutsuCount(null));

    listPosts().then((p) => setPostCount(p.length)).catch(() => setPostCount(null));
    // Equipe e feed de atividade exigem permissao (staff.view / audit.view - Adm+). Creator nem pede.
    if (can('staff.view')) {
      listStaff().then((m) => setStaffCount(m.length)).catch(() => setStaffCount(null));
    }
    // Problemas abertos do wiki (so' o S.Adm tem errors.view)
    if (can('errors.view')) {
      listErrors('open').then((e) => setOpenErrors(e.length)).catch(() => setOpenErrors(null));
    }
    if (can('audit.view')) {
      listAuditLog(8).then(setRecentActivity).catch(() => setRecentActivity([]));
    }
  }, [can]);

  const stats = [
    { label: dict.admin.sidebar.content, value: contentCount, icon: Boxes, href: '/admin/content' },
    { label: dict.admin.sidebar.jutsus, value: jutsuCount, icon: Zap, href: '/admin/jutsus' },
    { label: dict.admin.overview.totalPosts, value: postCount, icon: FileText, href: '/admin/blog-posts' },
    ...(can('staff.view') ? [{ label: dict.admin.sidebar.staff, value: staffCount, icon: Users, href: '/admin/staff' }] : []),
    ...(can('errors.view') ? [{ label: dict.admin.errorsPage.open, value: openErrors, icon: Bug, href: '/admin/errors' }] : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{dict.admin.overview.title}</h1>

      {/* Quadro de avisos da equipe (Adm/S.Adm postam e anexam arquivos; todos leem e baixam) */}
      {can('notices.view') && <NoticeBoard />}

      {/* Cards de estatistica - todo dashboard precisa disso: um
          resumo numerico rapido, sem precisar entrar em cada secao. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              {value === null ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-card-foreground">{value}</p>
              )}
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Acessos ao site: grafico + paises que mais acessam (so' quem tem analytics.view) */}
      {can('analytics.view') && <TrafficCard />}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Atividade recente - puxa do log de auditoria de verdade
            agora que ele existe, em vez de um feed mockado. */}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <History className="h-5 w-5 text-primary" />
              {t.recentActivity}
            </h2>
            <Link href="/admin/audit-log" className="text-xs text-primary hover:underline">{t.viewAll}</Link>
          </div>
          <div className="space-y-2">
            {recentActivity.map((entry) => {
              const cfg = actionConfig[entry.action] ?? { label: dict.admin.auth.logActions[entry.action] ?? entry.action, icon: History, className: 'bg-secondary text-muted-foreground' };
              const Icon = cfg.icon;
              const name = auditTarget(entry.diff, entry.entityId);   // sempre texto (renomear imagem grava o nome como {before, after})
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', cfg.className)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm text-card-foreground">
                    <span className="font-semibold">{entry.actorName ?? t.system}</span> {cfg.label}{' '}
                    <span className="text-muted-foreground">{entityTypeLabel[entry.entityType] ?? dict.admin.auth.logEntities[entry.entityType] ?? entry.entityType}</span>{' '}
                    &quot;{name}&quot;
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt, locale, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            {recentActivity.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{t.noActivity}</p>
            )}
          </div>
        </div>

        {/* Detalhamento por categoria - outra coisa comum em dashboard:
            nao so' "quantas entries", mas "quantas de cada tipo". */}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-bold">{t.contentByCategory}</h2>
          <div className="space-y-2">
            {Object.entries(categoryBreakdown).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{category}</span>
                <span className="font-semibold text-card-foreground">{count}</span>
              </div>
            ))}
            {Object.keys(categoryBreakdown).length === 0 && contentCount !== null && (
              <p className="text-sm text-muted-foreground">{t.noEntriesYet}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Publicado vs rascunho - dado que ja existia (status), so'
            nunca tinha sido resumido num lugar so'. */}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Send className="h-4 w-4 text-primary" /> {t.publishedVsDraft}
          </h2>
          {publishedCount === null || draftCount === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-900/30 text-emerald-400">
                  <Send className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-sm text-muted-foreground">{t.published}</span>
                <span className="font-semibold tabular-nums text-card-foreground">{publishedCount}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-900/30 text-amber-400">
                  <FileEdit className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-sm text-muted-foreground">{t.draft}</span>
                <span className="font-semibold tabular-nums text-card-foreground">{draftCount}</span>
              </div>
              {/* Barrinha visual simples - so' pra' dar uma nocao de
                  proporcao de relance, sem precisar de biblioteca de
                  grafico pra' dois numeros. */}
              {publishedCount + draftCount > 0 && (
                <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="bg-emerald-500" style={{ width: `${(publishedCount / (publishedCount + draftCount)) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(draftCount / (publishedCount + draftCount)) * 100}%` }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paginas desatualizadas - publicadas ha' mais de STALE_DAYS
            dias sem edicao nenhuma. So' um alerta pra revisar, nao
            significa que o conteudo esta' errado. */}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Clock className="h-4 w-4 text-primary" /> {t.stalePages}
          </h2>
          <div className="space-y-2">
            {staleItems.map((item) => {
              const daysSince = Math.floor((now - new Date(item.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
              return (
                <Link
                  key={item.id}
                  href={`/admin/content/edit/${item.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2 transition-colors hover:border-primary/40"
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-card-foreground">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{t.daysAgo.replace('{days}', String(daysSince))}</span>
                </Link>
              );
            })}
            {staleItems.length === 0 && contentCount !== null && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t.nothingStale.replace('{days}', String(STALE_DAYS))}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
