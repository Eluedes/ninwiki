"""
Manutencao automatica da API: de tempos em tempos apaga o que ficou VELHO e INUTIL, para o banco e a memoria nao incharem.

O que faz a cada rodada (padrao: a cada 6 horas; MAINTENANCE_INTERVAL_HOURS=0 desliga):
  1. Memoria: esquece baldes vazios/vencidos do limitador de requisicoes, do freio do registro de erros e do aviso de flood
     (antes eles so' eram limpos quando passavam de milhares de entradas).
  2. Banco - registro de erros: problemas resolvidos ha' mais de ERROR_RETENTION_DAYS_RESOLVED dias (30) e qualquer problema sem
     ocorrencia ha' mais de ERROR_RETENTION_DAYS dias (90).
  3. Banco - log geral (audit_log): linhas com mais de AUDIT_RETENTION_DAYS dias (365; 0 = nunca apaga).
  4. Banco - acessos: impressoes digitais de visitantes (2 dias), e contagens por dia/pais/pagina/cidade com mais de 400 dias.
  5. Disco: arquivos temporarios de backup que o bot nao apagou.
Nao mexe em conteudo do wiki, imagens, usuarios nem posts. Devolve/loga o resumo do que apagou.
"""
import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import backup, error_log, hardening
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.rate_limit import limiter
from app.models.errors import ErrorEvent
from app.models.reports import ContentReport
from app.models.traffic import TrafficDaily, TrafficPage, TrafficPlace, TrafficVisitor
from app.models.users import AuditLogEntry

log = logging.getLogger("ninwiki.maintenance")
REPORT_RETENTION_DAYS = 60   # reports resolvidos/descartados somem depois disso
TRAFFIC_DAYS = 400   # a tela de acessos mostra no maximo 365 dias


def sweep_memory() -> dict[str, int]:
    """Limpa as tabelas em memoria (limitador, freio de erros, aviso de flood). Devolve quantas entradas apagou de cada."""
    return {"rateLimiter": limiter.sweep(), "errorBrake": error_log.sweep(), "floodNotices": hardening.sweep_flood()}


async def prune_database(db: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """Apaga do banco o que passou da retencao (ver o topo do arquivo). Devolve quantas linhas apagou de cada tabela."""
    now = now or datetime.now(timezone.utc)
    today: date = now.date()
    out: dict[str, int] = {}

    async def run(name: str, statement) -> None:
        out[name] = (await db.execute(statement)).rowcount or 0

    if settings.error_retention_days_resolved > 0:
        await run("errorsResolved", delete(ErrorEvent).where(
            ErrorEvent.resolved.is_(True), ErrorEvent.last_seen < now - timedelta(days=settings.error_retention_days_resolved)))
    if settings.error_retention_days > 0:
        await run("errorsOld", delete(ErrorEvent).where(ErrorEvent.last_seen < now - timedelta(days=settings.error_retention_days)))
    if settings.audit_retention_days > 0:
        await run("auditLog", delete(AuditLogEntry).where(AuditLogEntry.created_at < now - timedelta(days=settings.audit_retention_days)))
    # Reports de visitantes ja' tratados (resolvidos/descartados) ha' mais de 60 dias; os abertos nunca sao apagados sozinhos.
    await run("reportsHandled", delete(ContentReport).where(
        ContentReport.status.in_(("resolved", "dismissed")), ContentReport.handled_at < now - timedelta(days=REPORT_RETENTION_DAYS)))
    await run("trafficVisitors", delete(TrafficVisitor).where(TrafficVisitor.day < today - timedelta(days=2)))
    await run("trafficDaily", delete(TrafficDaily).where(TrafficDaily.day < today - timedelta(days=TRAFFIC_DAYS)))
    await run("trafficPages", delete(TrafficPage).where(TrafficPage.day < today - timedelta(days=TRAFFIC_DAYS)))
    await run("trafficPlaces", delete(TrafficPlace).where(TrafficPlace.day < today - timedelta(days=TRAFFIC_DAYS)))
    await db.commit()
    return out


async def run_once() -> dict:
    """Uma rodada completa: memoria, banco e arquivos temporarios. Nunca levanta (uma falha vira aviso no log e a proxima rodada tenta de novo)."""
    summary: dict = {"memory": {}, "database": {}}
    try:
        summary["memory"] = sweep_memory()
    except Exception:  # noqa: BLE001
        log.exception("Manutencao: falha ao limpar a memoria")
    try:
        async with AsyncSessionLocal() as db:
            summary["database"] = await prune_database(db)
    except Exception:  # noqa: BLE001
        log.exception("Manutencao: falha ao limpar o banco")
    try:
        await asyncio.to_thread(backup.cleanup_old)
    except Exception:  # noqa: BLE001
        log.exception("Manutencao: falha ao limpar arquivos temporarios")
    deleted = sum(summary["database"].values()) + sum(summary["memory"].values())
    if deleted:
        log.info("Manutencao: %s", summary)
    return summary


async def loop() -> None:
    """Tarefa de fundo: roda `run_once` de MAINTENANCE_INTERVAL_HOURS em horas (a primeira, 5 minutos depois de a API subir)."""
    await asyncio.sleep(300)
    while True:
        await run_once()
        await asyncio.sleep(max(1, settings.maintenance_interval_hours) * 3600)
