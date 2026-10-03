"""
Importador de noticias da Steam (ver app/core/steam_news.py).

  GET  /steam-news/status   esta ligado? qual jogo, a cada quantos minutos, modo (publica/rascunho) e o resultado da ultima conferencia   posts.publish
  POST /steam-news/import   confere a Steam AGORA e importa os posts novos (botao "Importar agora" do painel do blog)                    posts.publish
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import steam_news
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.users import User
from app.schemas.content import CamelModel

router = APIRouter(prefix="/steam-news", tags=["steam-news"])


class SteamNewsStatus(CamelModel):
    """Estado do importador: ligado?, configuracao em uso e a ultima conferencia."""
    enabled: bool
    app_id: str = ""
    interval_minutes: int = 0
    mode: str = "published"
    require_tag: str = ""
    last_run: dict | None = None


def _status() -> SteamNewsStatus:
    """Monta o estado a partir das configuracoes e da ultima conferencia guardada em memoria."""
    return SteamNewsStatus(
        enabled=bool(settings.steam_news_app_id), app_id=settings.steam_news_app_id,
        interval_minutes=max(10, settings.steam_news_interval_minutes), mode=settings.steam_news_status,
        require_tag=settings.steam_news_require_tag, last_run=steam_news.last_run or None,
    )


@router.get("/status", response_model=SteamNewsStatus)
async def steam_status(staff: User = Depends(require_permission(Permission.POST_PUBLISH))) -> SteamNewsStatus:
    """Mostra se o importador esta' ligado e o resultado da ultima conferencia."""
    return _status()


@router.post("/import", response_model=SteamNewsStatus)
async def steam_import(
    staff: User = Depends(require_permission(Permission.POST_PUBLISH)), db: AsyncSession = Depends(get_db),
) -> SteamNewsStatus:
    """Confere a Steam agora. 404 se o importador estiver desligado (STEAM_NEWS_APP_ID vazio)."""
    if not settings.steam_news_app_id:
        raise HTTPException(status_code=404, detail="Steam news import is not enabled")
    run = await steam_news.import_news(db)
    await log_action(db, action="steam-import", entity_type="post", entity_id="steam",
                     diff={"imported": run["imported"], "matched": run["matched"], "errors": len(run["errors"])}, actor=staff)
    await db.commit()
    return _status()
