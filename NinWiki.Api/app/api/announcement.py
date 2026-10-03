"""
Anuncio da pagina inicial do site.

  GET    /announcement   PUBLICO: o anuncio atual ({active:false} quando nao ha nada para mostrar)
  PUT    /announcement   define/troca o anuncio                    announcement.manage
  DELETE /announcement   remove o anuncio (a Home fica sem nada)   announcement.manage

Texto simples (sem HTML), com link opcional so' para https:// ou caminho do proprio site. A traducao para portugues e' automatica
(DeepL, se houver chave) e fica salva; a Home mostra a versao do idioma do visitante.
"""
import re
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.translation import translate_field
from app.models.announcement import SiteAnnouncement
from app.models.users import User
from app.schemas.content import CamelModel

router = APIRouter(prefix="/announcement", tags=["announcement"])

LEVELS = ("info", "success", "warning", "event")


class AnnouncementRead(CamelModel):
    """O anuncio como a Home e o painel recebem."""
    active: bool
    message: str = ""
    message_pt: str | None = None
    link_url: str = ""
    link_label: str = ""
    level: str = "info"
    updated_at: str | None = None
    updated_by: str | None = None


class AnnouncementWrite(CamelModel):
    """Corpo de definir o anuncio: mensagem vazia = remove."""
    message: str = Field(default="", max_length=600)
    message_pt: str | None = Field(default=None, max_length=600)   # opcional: corrige a traducao a mao
    link_url: str = Field(default="", max_length=300)
    link_label: str = Field(default="", max_length=60)
    level: Literal["info", "success", "warning", "event"] = "info"

    @field_validator("message", "message_pt", "link_label")
    @classmethod
    def _clean_text(cls, v: str | None) -> str | None:
        """Texto em uma linha so', sem caracteres de controle nem espacos extras."""
        if v is None:
            return None
        return " ".join("".join(ch if ch.isprintable() else " " for ch in v).split())

    @field_validator("link_url")
    @classmethod
    def _check_link(cls, v: str) -> str:
        """So' https:// ou caminho do proprio site (/...): nada de javascript:, data: ou //outro-site."""
        v = v.strip()
        if not v:
            return ""
        if v.startswith("//") or "\\" in v or re.search(r"[\s<>\"']", v):
            raise ValueError("Invalid link")
        if not (v.startswith("https://") or v.startswith("/")):
            raise ValueError("The link must start with https:// or / (a page of this site)")
        return v


def _read(row: SiteAnnouncement | None) -> AnnouncementRead:
    """Converte a linha do banco na resposta ({active:false} se nao houver mensagem)."""
    if row is None or not row.message.strip():
        return AnnouncementRead(active=False)
    return AnnouncementRead(
        active=True, message=row.message, message_pt=row.message_pt, link_url=row.link_url, link_label=row.link_label,
        level=row.level if row.level in LEVELS else "info",
        updated_at=row.updated_at.isoformat() if row.updated_at else None, updated_by=row.updated_by,
    )


@router.get("", response_model=AnnouncementRead)
async def get_announcement(db: AsyncSession = Depends(get_db)) -> AnnouncementRead:
    """O anuncio atual da Home (publico). Sem anuncio: {active: false}."""
    return _read(await db.get(SiteAnnouncement, 1))


@router.put("", response_model=AnnouncementRead)
async def set_announcement(
    payload: AnnouncementWrite,
    staff: User = Depends(require_permission(Permission.ANNOUNCEMENT_MANAGE)), db: AsyncSession = Depends(get_db),
) -> AnnouncementRead:
    """Define o anuncio (ou remove, se a mensagem vier vazia) e registra no log."""
    row = await db.get(SiteAnnouncement, 1)
    if row is None:
        row = SiteAnnouncement(id=1)
        db.add(row)
    message = payload.message or ""
    if not message:
        row.message, row.message_pt, row.link_url, row.link_label = "", None, "", ""
        action = "clear"
    else:
        changed = message != row.message
        row.message = message
        # Traducao: a digitada a mao vale; senao, se o texto mudou, traduz de novo (sem chave da DeepL fica sem traducao).
        row.message_pt = payload.message_pt or ((await translate_field(message)) if changed or not row.message_pt else row.message_pt)
        row.link_url, row.link_label, row.level = payload.link_url, payload.link_label, payload.level
        action = "update"
    row.updated_by = staff.username
    await log_action(db, action=action, entity_type="announcement", entity_id="home",
                     diff={"message": message[:120], "level": payload.level, "link": payload.link_url}, actor=staff)
    await db.commit()
    await db.refresh(row)
    return _read(row)


@router.delete("", response_model=AnnouncementRead)
async def clear_announcement(
    staff: User = Depends(require_permission(Permission.ANNOUNCEMENT_MANAGE)), db: AsyncSession = Depends(get_db),
) -> AnnouncementRead:
    """Remove o anuncio: a Home volta a ficar sem nada."""
    row = await db.get(SiteAnnouncement, 1)
    if row is not None and row.message:
        row.message, row.message_pt, row.link_url, row.link_label = "", None, "", ""
        row.updated_by = staff.username
        await log_action(db, action="clear", entity_type="announcement", entity_id="home", diff=None, actor=staff)
        await db.commit()
    return AnnouncementRead(active=False)
