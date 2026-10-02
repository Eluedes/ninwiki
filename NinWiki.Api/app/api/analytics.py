"""
Acessos ao site: o navegador do visitante avisa "abri esta pagina" e o painel mostra grafico por dia, paises e paginas mais vistas.

  POST /analytics/hit       conta uma visualizacao (publico; limitado por IP; ignora robos, /admin e /login)
  GET  /analytics/summary   resumo dos ultimos N dias (permissao analytics.view: Adm e S.Adm por padrao)

PRIVACIDADE: so' guardamos CONTAGENS por dia/pais/pagina. O IP nunca e' gravado; para contar visitantes unicos usamos um hash
(dia + IP + navegador + segredo da API) que so' serve para saber "ja' contei este visitante hoje" e e' apagado em 2 dias.
"""
import hashlib
import random
import re
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.config import settings
from app.core.database import get_db
from app.core.geoip import country_of
from app.core.permissions import Permission
from app.core.rate_limit import client_key, limiter, retry_message
from app.core.security import ensure_same_origin
from app.models.traffic import TrafficDaily, TrafficPage, TrafficVisitor
from app.models.users import User
from app.schemas.content import CamelModel

router = APIRouter(prefix="/analytics", tags=["analytics"])

HIT_RATE = "analytics_hit"
HITS_PER_MINUTE = 90          # por IP
MAX_PAGES_PER_DAY = 400       # caminhos distintos por dia (acima disso, o resto vira "/other") - evita encher o banco
IGNORED_PREFIXES = ("/admin", "/login", "/maintenance", "/api", "/_next")
BOT_UA = re.compile(r"bot|crawl|spider|slurp|headless|curl|wget|python|httpx|requests|axios|node-fetch|scrapy|monitor|uptime|preview", re.I)


class HitIn(BaseModel):
    """Corpo de uma visualizacao: so' o caminho da pagina (sem dominio nem parametros)."""
    path: str = Field(min_length=1, max_length=200)


class DayPoint(CamelModel):
    """Um dia do grafico."""
    day: date
    views: int
    visitors: int


class CountryRow(CamelModel):
    """Um pais no ranking (code = ISO de 2 letras; ZZ = desconhecido)."""
    code: str
    views: int
    visitors: int
    share: float   # fracao das visualizacoes do periodo (0 a 1)


class PageRow(CamelModel):
    """Uma pagina no ranking das mais vistas."""
    path: str
    views: int


class TrafficSummary(CamelModel):
    """Resumo do periodo: totais, serie por dia, paises e paginas."""
    days: int
    total_views: int
    total_visitors: int
    series: list[DayPoint]
    countries: list[CountryRow]
    pages: list[PageRow]


def clean_path(raw: str) -> str | None:
    """Caminho limpo ("/blog/x"): sem parametros, sem hash, so' interno; None se for para ignorar (admin, login, lixo)."""
    path = raw.split("?", 1)[0].split("#", 1)[0].strip()
    if not path.startswith("/") or path.startswith("//") or any(ord(c) < 32 for c in path):
        return None
    path = path.rstrip("/") or "/"
    if any(path == p or path.startswith(p + "/") for p in IGNORED_PREFIXES):
        return None
    return path[:200]


def _visitor_hash(day: date, ip: str, ua: str) -> str:
    """Hash anonimo do visitante no dia (nao da' para voltar ao IP: tem o segredo da API no meio)."""
    return hashlib.sha256(f"{day}|{ip}|{ua}|{settings.jwt_secret_key}".encode()).hexdigest()


@router.post("/hit", status_code=204)
async def record_hit(payload: HitIn, request: Request, db: AsyncSession = Depends(get_db)):
    """Conta uma visualizacao de pagina (robos e paginas internas sao ignorados em silencio)."""
    ensure_same_origin(request)
    wait = limiter.hit(HIT_RATE, client_key(), HITS_PER_MINUTE, 60)
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    ua = request.headers.get("user-agent", "")
    path = clean_path(payload.path)
    if path is None or not ua or BOT_UA.search(ua):
        return None
    ip = client_key()
    today = datetime.now(timezone.utc).date()
    country = country_of(ip, request.headers.get("cf-ipcountry"), settings.trust_proxy_headers)

    # visitante novo hoje? (a linha so' entra se ainda nao existia)
    new_visitor = (await db.execute(
        insert(TrafficVisitor).values(day=today, visitor_hash=_visitor_hash(today, ip, ua))
        .on_conflict_do_nothing().returning(TrafficVisitor.visitor_hash))).first() is not None
    daily = insert(TrafficDaily).values(day=today, country=country, views=1, visitors=1 if new_visitor else 0)
    await db.execute(daily.on_conflict_do_update(
        index_elements=["day", "country"],
        set_={"views": TrafficDaily.views + 1, "visitors": TrafficDaily.visitors + (1 if new_visitor else 0)}))

    known = (await db.execute(select(func.count()).select_from(TrafficPage).where(TrafficPage.day == today))).scalar_one()
    exists = (await db.get(TrafficPage, (today, path))) is not None
    stored = path if (exists or known < MAX_PAGES_PER_DAY) else "/other"
    await db.execute(insert(TrafficPage).values(day=today, path=stored, views=1).on_conflict_do_update(
        index_elements=["day", "path"], set_={"views": TrafficPage.views + 1}))

    if random.random() < 0.02:  # faxina ocasional: hashes de visitantes com mais de 2 dias nao servem mais
        await db.execute(delete(TrafficVisitor).where(TrafficVisitor.day < today - timedelta(days=2)))
    await db.commit()
    return None


@router.get("/summary", response_model=TrafficSummary)
async def traffic_summary(
    days: int = Query(30, ge=1, le=365),
    staff: User = Depends(require_permission(Permission.ANALYTICS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Acessos dos ultimos `days` dias (hoje incluso): serie por dia (dias sem visita vem zerados), paises e paginas mais vistas."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    rows = (await db.execute(
        select(TrafficDaily.day, func.sum(TrafficDaily.views), func.sum(TrafficDaily.visitors))
        .where(TrafficDaily.day >= start).group_by(TrafficDaily.day))).all()
    by_day = {d: (int(v), int(u)) for d, v, u in rows}
    series = [DayPoint(day=start + timedelta(days=i), views=by_day.get(start + timedelta(days=i), (0, 0))[0],
                       visitors=by_day.get(start + timedelta(days=i), (0, 0))[1]) for i in range(days)]
    total_views = sum(p.views for p in series)
    total_visitors = sum(p.visitors for p in series)
    country_rows = (await db.execute(
        select(TrafficDaily.country, func.sum(TrafficDaily.views), func.sum(TrafficDaily.visitors))
        .where(TrafficDaily.day >= start).group_by(TrafficDaily.country)
        .order_by(func.sum(TrafficDaily.views).desc()).limit(15))).all()
    countries = [CountryRow(code=c, views=int(v), visitors=int(u), share=(int(v) / total_views if total_views else 0))
                 for c, v, u in country_rows]
    page_rows = (await db.execute(
        select(TrafficPage.path, func.sum(TrafficPage.views)).where(TrafficPage.day >= start)
        .group_by(TrafficPage.path).order_by(func.sum(TrafficPage.views).desc()).limit(8))).all()
    return TrafficSummary(days=days, total_views=total_views, total_visitors=total_visitors, series=series,
                          countries=countries, pages=[PageRow(path=p, views=int(v)) for p, v in page_rows])
