"""
Regras de gerenciamento da equipe - UM lugar so', usado pelo PAINEL
(app/api/staff.py) e pelo BOT do Discord (app/api/bot.py). Como os dois
caminhos passam por aqui, as regras sao identicas: o bot nao consegue
fazer nada que o painel proibiria.

REGRAS (todas testadas em scripts/testar_permissoes.py):
  - Cada acao exige a permissao certa (ver app/core/permissions.py).
  - Hierarquia: so' mexe em quem esta' ESTRITAMENTE abaixo (Adm mexe em
    Creator; nunca em outro Adm). S.Adm mexe em qualquer um.
  - Ninguem altera a si mesmo (evita se trancar pra' fora sem querer).
  - Donos (SUPER_ADMIN_DISCORD_IDS do .env) NAO podem ser rebaixados nem
    desativados - a unica forma e' editar o .env.
  - Nunca sobra zero S.Adm ativo.
  - Mudar cargo ou desativar derruba as sessoes da pessoa (token_version).

Nenhuma funcao aqui da' commit: quem chama decide (mesma transacao do log).
"""
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.config import settings
from app.core.permissions import Permission, assignable_roles, can_manage_role, user_has_permission
from app.models.enums import StaffRole
from app.models.roles import CustomRole
from app.models.users import User


class StaffError(Exception):
    """Regra de negocio violada - vira uma resposta HTTP com este status/mensagem."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def is_owner(user: User) -> bool:
    """Dono do sistema = Discord ID listado em SUPER_ADMIN_DISCORD_IDS."""
    return user.discord_id in settings.super_admin_ids


async def get_by_discord_id(db: AsyncSession, discord_id: int) -> User | None:
    """Acha um membro da equipe pelo Discord ID."""
    return (await db.execute(select(User).where(User.discord_id == discord_id))).scalar_one_or_none()


async def _count_active_super_admins(db: AsyncSession) -> int:
    """Quantos S.Adm ativos existem (nunca pode chegar a zero)."""
    stmt = select(func.count()).select_from(User).where(User.role == StaffRole.SUPER_ADMIN, User.is_active.is_(True))
    return (await db.execute(stmt)).scalar_one()


def _require(actor: User, permission: Permission) -> None:
    """Exige que quem age tenha a permissao (senao StaffError 403)."""
    if not user_has_permission(actor, permission):
        raise StaffError(403, "You do not have permission to do this")


def _check_target_manageable(actor: User, target: User) -> None:
    """Confere a hierarquia: dono nao e' alterado, ninguem altera a si mesmo, so' mexe em quem esta' abaixo."""
    if target.id == actor.id:
        raise StaffError(400, "You cannot change your own role or status")
    if is_owner(target):
        raise StaffError(403, "This user is a system owner (set in the .env) and cannot be changed here")
    if not can_manage_role(actor.role, target.role):
        raise StaffError(403, "You can only change people whose role is below yours")


async def add_staff(
    db: AsyncSession, actor: User, discord_id: int, role: StaffRole,
    username: str | None = None, source: str = "panel", custom_role_id: UUID | None = None,
) -> User:
    """Cadastra alguem na equipe (ou reativa) respeitando permissao e hierarquia; registra no log."""
    _require(actor, Permission.STAFF_CREATE)
    if role not in assignable_roles(actor.role):
        raise StaffError(403, "You cannot register someone with this role")
    custom = await _custom_role_for(db, role, custom_role_id)
    if await get_by_discord_id(db, discord_id) is not None:
        raise StaffError(409, "This Discord ID is already registered on the team")
    user = User(
        discord_id=discord_id,
        # Nome provisorio: no primeiro login a pessoa ganha o nome/avatar reais do Discord.
        username=(username or f"Discord {discord_id}")[:100],
        role=role,
        custom_role_id=custom.id if custom else None,
        created_by_id=actor.id,
    )
    db.add(user)
    await db.flush()
    await log_action(
        db, action="create", entity_type="staff", entity_id=str(discord_id),
        diff={"role": custom.name if custom else role.value, "username": user.username}, actor=actor, source=source,
    )
    await db.refresh(user)
    return user


def clean_username(raw: str) -> str:
    """Nome de exibicao: sem caracteres de controle, espacos extras e quebras de linha; de 1 a 100 caracteres."""
    name = " ".join("".join(ch if ch.isprintable() else " " for ch in raw).split())
    if not name:
        raise StaffError(422, "The name cannot be empty")
    if len(name) > 100:
        raise StaffError(422, "The name can have at most 100 characters")
    return name


async def rename(db: AsyncSession, actor: User, target: User, new_name: str, source: str = "panel") -> User:
    """
    Troca o nome (nick) de exibicao de alguem da equipe - o S.Adm pode mudar o de qualquer um, inclusive o proprio e o dos
    donos (so' o NOME muda; cargo e acesso nao). O nome fica "travado": o login do Discord nao o sobrescreve mais.
    """
    _require(actor, Permission.STAFF_EDIT)
    name = clean_username(new_name)
    before = target.username
    target.username = name
    target.username_locked = True
    if before != name:
        await log_action(
            db, action="rename", entity_type="staff", entity_id=str(target.discord_id),
            diff={"before": before, "after": name}, actor=actor, source=source,
        )
    return target


async def _custom_role_for(db: AsyncSession, role: StaffRole, custom_role_id: UUID | None) -> CustomRole | None:
    """Confere o cargo personalizado pedido: so' existe junto de role = creator e tem que existir de verdade (senao 422)."""
    if custom_role_id is None:
        return None
    if role != StaffRole.CREATOR:
        raise StaffError(422, "A custom role can only be used with the Creator base role")
    custom = await db.get(CustomRole, custom_role_id)
    if custom is None:
        raise StaffError(422, "This custom role does not exist")
    return custom


async def change_role(
    db: AsyncSession, actor: User, target: User, new_role: StaffRole, source: str = "panel", custom_role_id: UUID | None = None,
) -> User:
    """Troca o cargo (comum ou personalizado) de alguem, derruba a sessao dele e registra no log."""
    _require(actor, Permission.STAFF_EDIT)
    _check_target_manageable(actor, target)
    if new_role not in assignable_roles(actor.role):
        raise StaffError(403, "You cannot give this role")
    custom = await _custom_role_for(db, new_role, custom_role_id)
    if new_role == target.role and (custom.id if custom else None) == target.custom_role_id:
        return target
    if target.role == StaffRole.SUPER_ADMIN and target.is_active and await _count_active_super_admins(db) <= 1:
        raise StaffError(400, "Precisa existir pelo menos um S.Adm ativo")
    before = target.custom_role.name if target.custom_role else target.role.value
    target.role = new_role
    target.custom_role_id = custom.id if custom else None
    target.token_version += 1  # derruba as sessoes antigas: o cargo mudou
    await log_action(
        db, action="role_change", entity_type="staff", entity_id=str(target.discord_id),
        diff={"before": before, "after": custom.name if custom else new_role.value, "username": target.username},
        actor=actor, source=source,
    )
    await db.flush()
    await db.refresh(target)
    return target


async def set_active(db: AsyncSession, actor: User, target: User, active: bool, source: str = "panel") -> User:
    """Ativa/desativa alguem (derruba a sessao) e registra no log."""
    _require(actor, Permission.STAFF_DEACTIVATE)
    _check_target_manageable(actor, target)
    if target.is_active == active:
        return target
    if not active and target.role == StaffRole.SUPER_ADMIN and await _count_active_super_admins(db) <= 1:
        raise StaffError(400, "Precisa existir pelo menos um S.Adm ativo")
    target.is_active = active
    target.token_version += 1
    await log_action(
        db, action="activate" if active else "deactivate", entity_type="staff",
        entity_id=str(target.discord_id), diff={"username": target.username, "role": target.custom_role.name if target.custom_role else target.role.value},
        actor=actor, source=source,
    )
    return target


async def ensure_owner_account(db: AsyncSession, discord_id: int, username: str, avatar_url: str | None) -> User | None:
    """
    Garante que um DONO (SUPER_ADMIN_DISCORD_IDS) exista como S.Adm ativo.
    Chamado no login - e' assim que o primeiro S.Adm nasce sem mexer no
    banco na mao, e o que impede os donos de ficarem trancados pra' fora.
    Devolve None se o ID nao for de um dono.
    """
    if discord_id not in settings.super_admin_ids:
        return None
    user = await get_by_discord_id(db, discord_id)
    if user is None:
        user = User(discord_id=discord_id, username=username, avatar_url=avatar_url, role=StaffRole.SUPER_ADMIN)
        db.add(user)
        await db.flush()
        await log_action(db, action="bootstrap", entity_type="staff", entity_id=str(discord_id),
                         diff={"role": "super_admin", "username": username}, source="auth")
    elif user.role != StaffRole.SUPER_ADMIN or not user.is_active:
        user.role = StaffRole.SUPER_ADMIN
        user.custom_role_id = None
        user.is_active = True
        user.token_version += 1
        await log_action(db, action="bootstrap_restore", entity_type="staff", entity_id=str(discord_id),
                         diff={"username": user.username}, source="auth")
    return user
