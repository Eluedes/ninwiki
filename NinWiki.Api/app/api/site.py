"""
Estado do site: MODO MANUTENCAO.

Rotas:
  GET  /site/status        publica: {maintenance, message, messagePt, access}. `access` e' true quando o cabecalho X-Maintenance-Pass traz um
                           passe valido (o site Next confere isso antes de mostrar cada pagina durante a manutencao).
  PUT  /site/maintenance   liga/desliga e muda a mensagem - SO' o S.Adm (permissao site.maintenance; os outros recebem 404)
  POST /site/pass          qualquer membro da equipe LOGADO troca a sessao por um passe de 12 horas; o site guarda o passe num cookie proprio
                           (a sessao em si fica no cookie da API, que o servidor do site nao enxerga) e assim a equipe navega no site normalmente.

A manutencao protege a VITRINE (as paginas): o site Next barra quem nao tem passe. Os dados publicos da API continuam legiveis de proposito.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.security import MAINTENANCE_PASS_HOURS, create_maintenance_pass, read_session_token
from app.models.site import SiteMaintenance
from app.models.users import User
from app.schemas.content import CamelModel

router = APIRouter(prefix="/site", tags=["site"])


class SiteStatus(CamelModel):
    """O que o site precisa saber para decidir se mostra a pagina de manutencao."""
    maintenance: bool
    message: str | None = None
    message_pt: str | None = None
    access: bool = False          # o passe enviado e' valido (equipe logada)


class MaintenanceWrite(CamelModel):
    """Corpo de ligar/desligar a manutencao (mensagens opcionais: vazio = texto padrao)."""
    enabled: bool
    message: str = Field(default="", max_length=300)
    message_pt: str | None = Field(default=None, max_length=300)


class PassRead(CamelModel):
    """Passe de manutencao devolvido a quem esta' logado na equipe."""
    token: str
    hours: int
    maintenance: bool


async def _current(db: AsyncSession) -> SiteMaintenance | None:
    """A linha do modo manutencao (None = nunca foi ligado)."""
    return await db.get(SiteMaintenance, 1)


async def pass_is_valid(db: AsyncSession, token: str | None) -> bool:
    """O passe e' de verdade (assinado, nao vencido) e a pessoa continua ativa na equipe com a mesma versao de sessao?"""
    if not token:
        return False
    data = read_session_token(token, typ="maintenance")
    if data is None:
        return False
    try:
        user = await db.get(User, UUID(str(data["sub"])))
    except ValueError:
        return False
    return user is not None and user.is_active and user.token_version == data.get("ver")


@router.get("/status", response_model=SiteStatus)
async def site_status(
    x_maintenance_pass: str | None = Header(default=None, alias="X-Maintenance-Pass"),
    db: AsyncSession = Depends(get_db),
):
    """Estado publico do site (nunca em cache: o painel liga/desliga na hora)."""
    row = await _current(db)
    enabled = bool(row and row.enabled)
    return SiteStatus(
        maintenance=enabled,
        message=(row.message or None) if row else None,
        message_pt=row.message_pt if row else None,
        access=await pass_is_valid(db, x_maintenance_pass) if enabled else False,
    )


@router.put("/maintenance", response_model=SiteStatus)
async def set_maintenance(
    payload: MaintenanceWrite,
    staff: User = Depends(require_permission(Permission.MAINTENANCE_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    """Liga ou desliga o modo manutencao (so' S.Adm). Fica registrado no log."""
    row = await _current(db)
    if row is None:
        row = SiteMaintenance(id=1)
        db.add(row)
    was = bool(row.enabled)
    row.enabled = payload.enabled
    row.message = payload.message.strip()
    row.message_pt = (payload.message_pt or "").strip() or None
    row.updated_by = staff.username
    await log_action(db, action="maintenance_on" if payload.enabled else "maintenance_off", entity_type="site", entity_id="maintenance",
                     diff={"before": was, "after": payload.enabled}, actor=staff)
    await db.commit()
    await db.refresh(row)
    return SiteStatus(maintenance=row.enabled, message=row.message or None, message_pt=row.message_pt, access=True)


@router.post("/pass", response_model=PassRead)
async def create_pass(staff: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Qualquer membro da equipe logado recebe um passe de 12 horas para navegar no site durante a manutencao."""
    row = await _current(db)
    return PassRead(token=create_maintenance_pass(staff), hours=MAINTENANCE_PASS_HOURS, maintenance=bool(row and row.enabled))
