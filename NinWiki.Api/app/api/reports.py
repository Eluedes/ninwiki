"""
Reports de visitantes sobre conteudo desatualizado ou erro de traducao (content, jutsu e mastery).

Publico (sem login, com defesas):
  POST   /reports                 envia um report

Painel (permissao reports.manage):
  GET    /reports                 lista (filtros: status=open|resolved|dismissed|all, kind, limit)
  PATCH  /reports/{id}            muda o status (resolvido / descartado / reaberto)
  DELETE /reports/{id}            apaga

Defesas do endpoint publico: so' aceita a origem do nosso site, limite por IP (por minuto e por dia), campo "isca" anti-robo,
texto simples com tamanho e links limitados, alvo conferido no banco (a pagina precisa existir e estar no ar), e um teto geral
de reports novos por hora (um ataque nao consegue encher o painel).
"""
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.rate_limit import client_key, limiter, retry_message
from app.core.security import ensure_same_origin
from app.models.content import ContentItem
from app.models.enums import ContentStatus
from app.models.masteries import Jutsu, Mastery
from app.models.reports import ContentReport
from app.models.users import User
from app.schemas.reports import MAX_REPORT_CHARS, MIN_REPORT_CHARS, ReportCreate, ReportRead, ReportStatusUpdate

router = APIRouter(prefix="/reports", tags=["reports"])

REPORTS_PER_MINUTE = 3        # por IP
REPORTS_PER_DAY = 20          # por IP
MAX_NEW_REPORTS_PER_HOUR = 200   # no site todo
MAX_LINKS = 1


def _clean(raw: str) -> str:
    """Texto simples: tira caracteres de controle, comprime linhas em branco e confere tamanho minimo/maximo e links."""
    text = "".join(ch for ch in raw if ch in "\n" or ch.isprintable())
    text = re.sub(r"[ ]{2,}", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()
    if len(text) < MIN_REPORT_CHARS:
        raise HTTPException(status_code=422, detail=f"Please describe the problem (at least {MIN_REPORT_CHARS} characters).")
    if len(text) > MAX_REPORT_CHARS:
        raise HTTPException(status_code=422, detail=f"Message too long (max {MAX_REPORT_CHARS} characters).")
    if len(re.findall(r"https?://|www\.", text, flags=re.I)) > MAX_LINKS:
        raise HTTPException(status_code=422, detail=f"Too many links (max {MAX_LINKS}).")
    return text


async def _resolve_target(db: AsyncSession, target_type: str, target_id: str) -> tuple[str, str]:
    """(nome, endereco no site) do alvo; 404 se a pagina nao existe (ou de conteudo ainda em rascunho)."""
    if target_type == "content":
        item = (await db.execute(select(ContentItem).where(ContentItem.slug == target_id))).scalar_one_or_none()
        if item is not None and item.status == ContentStatus.PUBLISHED:
            return item.name, f"/detail/{item.slug}"
    elif target_type == "jutsu":
        jutsu = await db.get(Jutsu, target_id)
        if jutsu is not None and jutsu.status == ContentStatus.PUBLISHED:   # rascunho nao existe para o visitante
            return jutsu.name, f"/jutsus/{jutsu.id}"
    else:
        mastery = await db.get(Mastery, target_id)
        if mastery is not None:
            return mastery.name, f"/masteries/{mastery.id}"
    raise HTTPException(status_code=404, detail="Page not found")


@router.post("", status_code=204)
async def create_report(payload: ReportCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """Visitante envia um report sobre uma pagina. Publico, entao com todas as defesas descritas no topo do arquivo."""
    ensure_same_origin(request)
    key = client_key()
    for bucket, limit, window in (("reports-min", REPORTS_PER_MINUTE, 60), ("reports-day", REPORTS_PER_DAY, 86400)):
        wait = limiter.hit(bucket, key, limit, window)
        if wait is not None:
            raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    if payload.website.strip():
        return Response(status_code=204)   # robo preencheu a isca: finge que deu certo e descarta
    message = _clean(payload.message)
    name, path = await _resolve_target(db, payload.target_type, payload.target_id)
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (await db.execute(select(func.count()).select_from(ContentReport).where(ContentReport.created_at > since))).scalar_one()
    if recent >= MAX_NEW_REPORTS_PER_HOUR:
        return Response(status_code=204)   # teto atingido: ignora em silencio
    # Mesmo texto, mesma pagina, mesmo IP e ainda aberto = duplicado (clique repetido): nao cria outro.
    dup = (await db.execute(select(ContentReport.id).where(
        ContentReport.target_type == payload.target_type, ContentReport.target_id == payload.target_id,
        ContentReport.ip_address == key, ContentReport.message == message, ContentReport.status == "open").limit(1))).first()
    if dup is None:
        db.add(ContentReport(
            target_type=payload.target_type, target_id=payload.target_id, target_name=name[:200], target_path=path,
            kind=payload.kind, message=message, locale=payload.locale, ip_address=key[:45],
        ))
        await db.commit()
    return Response(status_code=204)


@router.get("", response_model=list[ReportRead])
async def list_reports(
    status: str = Query("open", pattern="^(open|resolved|dismissed|all)$"),
    kind: str | None = Query(None, pattern="^(outdated|translation|other)$"),
    limit: int = Query(100, ge=1, le=300),
    staff: User = Depends(require_permission(Permission.REPORTS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    """Lista os reports, mais recentes primeiro."""
    stmt = select(ContentReport).order_by(ContentReport.created_at.desc()).limit(limit)
    if status != "all":
        stmt = stmt.where(ContentReport.status == status)
    if kind:
        stmt = stmt.where(ContentReport.kind == kind)
    return (await db.execute(stmt)).scalars().all()


async def _get_or_404(db: AsyncSession, report_id: UUID) -> ContentReport:
    """Acha o report pelo id ou responde 404."""
    report = await db.get(ContentReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.patch("/{report_id}", response_model=ReportRead)
async def update_report(
    report_id: UUID, body: ReportStatusUpdate,
    staff: User = Depends(require_permission(Permission.REPORTS_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Marca o report como resolvido, descartado ou reabre (open)."""
    report = await _get_or_404(db, report_id)
    report.status = body.status
    report.handled_by, report.handled_at = (None, None) if body.status == "open" else (staff.username, datetime.now(timezone.utc))
    await log_action(db, action=body.status, entity_type="report", entity_id=str(report.id), diff={"name": report.target_name}, actor=staff)
    await db.commit()
    return report


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: UUID, staff: User = Depends(require_permission(Permission.REPORTS_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Apaga o report (limpeza)."""
    report = await _get_or_404(db, report_id)
    await db.delete(report)
    await log_action(db, action="delete", entity_type="report", entity_id=str(report_id), diff={"name": report.target_name}, actor=staff)
    await db.commit()
