"""
Tema festivo do site (Natal, Ano Novo, Valentine's Day, Pascoa, Halloween). NAO e' sobre cores: sao enfeites e efeitos de epoca que o site mostra.

  GET  /seasonal-theme   PUBLICO: o tema ativo agora ({theme: "none"} = site normal)
  PUT  /seasonal-theme   troca o tema padrao do site                       site.seasonal_theme (EXCLUSIVA do S.Adm: os outros recebem 404)
"""
from typing import Literal, get_args

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.seasonal_theme import SiteSeasonalTheme
from app.models.users import User
from app.schemas.content import CamelModel

router = APIRouter(prefix="/seasonal-theme", tags=["seasonal-theme"])

SeasonName = Literal["none", "christmas", "newyear", "valentine", "easter", "halloween"]


class SeasonalThemeRead(CamelModel):
    """O tema ativo (o site publico e o painel recebem isto)."""
    theme: SeasonName = "none"
    updated_at: str | None = None
    updated_by: str | None = None


class SeasonalThemeWrite(CamelModel):
    """Corpo de trocar o tema: 'none' volta ao site normal."""
    theme: SeasonName


def _read(row: SiteSeasonalTheme | None) -> SeasonalThemeRead:
    """Linha do banco -> resposta (sem linha = site normal; valor desconhecido tambem vira 'none')."""
    if row is None:
        return SeasonalThemeRead()
    theme = row.theme if row.theme in get_args(SeasonName) else "none"
    return SeasonalThemeRead(theme=theme, updated_at=row.updated_at.isoformat() if row.updated_at else None, updated_by=row.updated_by)


@router.get("", response_model=SeasonalThemeRead)
async def get_seasonal_theme(db: AsyncSession = Depends(get_db)) -> SeasonalThemeRead:
    """Tema ativo agora (publico, so' leitura: o site usa para mostrar os enfeites)."""
    return _read(await db.get(SiteSeasonalTheme, 1))


@router.put("", response_model=SeasonalThemeRead)
async def set_seasonal_theme(
    payload: SeasonalThemeWrite,
    staff: User = Depends(require_permission(Permission.SITE_SEASONAL_THEME)),
    db: AsyncSession = Depends(get_db),
) -> SeasonalThemeRead:
    """Troca o tema festivo padrao do site (so' S.Adm) e registra no log."""
    row = await db.get(SiteSeasonalTheme, 1)
    before = row.theme if row else "none"
    if row is None:
        row = SiteSeasonalTheme(id=1, theme=payload.theme)
        db.add(row)
    row.theme, row.updated_by = payload.theme, staff.username
    await log_action(db, action="update", entity_type="seasonal_theme", entity_id="1", diff={"before": before, "after": payload.theme}, actor=staff)
    await db.commit()
    await db.refresh(row)
    return _read(row)
