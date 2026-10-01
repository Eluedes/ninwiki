"""
Permissoes e cargos da equipe (Fase 2) - A UNICA fonte de verdade sobre
"quem pode o que". Nenhuma outra parte do codigo compara cargo com
texto ("if role == 'admin'"): todo endpoint pergunta por uma PERMISSAO
(Depends(require_permission(Permission.X))) e este arquivo decide quais
cargos tem essa permissao.

COMO EVOLUIR "COM O TEMPO":
  - Criar uma permissao nova: adicione uma linha no enum Permission e
    coloque nos cargos certos em ROLE_PERMISSIONS. Pronto.
  - Permissao EXCLUSIVA do S.Adm que so' ele enxerga: coloque em
    SUPER_ONLY_PERMISSIONS. Quem nao e' S.Adm nem descobre que o endpoint
    existe (recebe 404, nao 403) e a permissao nunca aparece pra ele em
    /auth/me - o front nao mostra o botao, e a API nega mesmo assim.
  - Mudar o que um cargo pode: e' so' mexer na tabela ROLE_PERMISSIONS.

REGRAS DE CARGO (hierarquia) ficam abaixo e em app/core/staff_service.py:
quem esta' embaixo nunca mexe em quem esta' em cima.
"""
from enum import Enum

from app.models.enums import StaffRole


class Permission(str, Enum):
    # --- Conteudo (entries do catalogo: mobs, itens, armas, missoes, guias) ---
    CONTENT_CREATE = "content.create"
    CONTENT_EDIT = "content.edit"
    CONTENT_PUBLISH = "content.publish"   # colocar/tirar do ar (status published)
    CONTENT_DELETE = "content.delete"
    CONTENT_IMPORT = "content.import"     # importacao em massa (JSON)

    # --- Blog (posts de noticia/atualizacao - editorial, separado do catalogo) ---
    POST_CREATE = "posts.create"
    POST_EDIT = "posts.edit"              # so' em RASCUNHO para quem nao tem POST_PUBLISH
    POST_PUBLISH = "posts.publish"        # colocar/tirar do ar
    POST_DELETE = "posts.delete"

    # --- Lore (Masteries e Jutsus - dados estruturais do jogo; tambem Vilas, Clas e Organizacoes) ---
    LORE_EDIT = "lore.edit"
    LORE_DELETE = "lore.delete"

    # --- Ferramentas ---
    UPLOAD_CREATE = "uploads.create"
    TRANSLATION_RETRANSLATE = "translation.retranslate"

    # --- Equipe ---
    STAFF_VIEW = "staff.view"
    STAFF_CREATE = "staff.create"
    STAFF_EDIT = "staff.edit"             # trocar cargo
    STAFF_DEACTIVATE = "staff.deactivate"  # desativar/reativar

    # --- Log ---
    AUDIT_VIEW = "audit.view"             # log de CONTEUDO
    AUDIT_VIEW_ALL = "audit.view_all"     # log COMPLETO (login, equipe, seguranca, IPs) - so' S.Adm


# Permissoes que so' o S.Adm tem E que os outros cargos nem podem saber
# que existem (404 em vez de 403, fora da lista de /auth/me). Vai
# crescendo com o tempo, conforme o S.Adm ganhar poderes exclusivos.
SUPER_ONLY_PERMISSIONS: frozenset[Permission] = frozenset({
    Permission.AUDIT_VIEW_ALL,
})

_CREATOR: frozenset[Permission] = frozenset({
    Permission.CONTENT_CREATE,
    Permission.CONTENT_EDIT,          # so' em RASCUNHO - ver creator_can_touch_published()
    Permission.POST_CREATE,
    Permission.POST_EDIT,             # so' em RASCUNHO
    Permission.UPLOAD_CREATE,
    Permission.TRANSLATION_RETRANSLATE,
})

_ADMIN: frozenset[Permission] = _CREATOR | frozenset({
    Permission.CONTENT_PUBLISH,
    Permission.CONTENT_DELETE,
    Permission.CONTENT_IMPORT,
    Permission.POST_PUBLISH,
    Permission.POST_DELETE,
    Permission.LORE_EDIT,
    Permission.LORE_DELETE,
    Permission.STAFF_VIEW,
    Permission.STAFF_CREATE,          # so' cargos abaixo do dele (Creator)
    Permission.STAFF_EDIT,
    Permission.STAFF_DEACTIVATE,
    Permission.AUDIT_VIEW,
})

# S.Adm: literalmente tudo que existe no catalogo (inclusive o que for
# adicionado depois - nao precisa lembrar de atualizar esta linha).
_SUPER_ADMIN: frozenset[Permission] = frozenset(Permission)

ROLE_PERMISSIONS: dict[StaffRole, frozenset[Permission]] = {
    StaffRole.CREATOR: _CREATOR,
    StaffRole.ADMIN: _ADMIN,
    StaffRole.SUPER_ADMIN: _SUPER_ADMIN,
}

# Hierarquia: numero maior = cargo mais alto.
ROLE_RANK: dict[StaffRole, int] = {
    StaffRole.CREATOR: 1,
    StaffRole.ADMIN: 2,
    StaffRole.SUPER_ADMIN: 3,
}

# Nome curto mostrado na interface.
ROLE_LABEL: dict[StaffRole, str] = {
    StaffRole.SUPER_ADMIN: "S.Adm",
    StaffRole.ADMIN: "Adm",
    StaffRole.CREATOR: "Creator",
}


def permissions_of(role: StaffRole) -> frozenset[Permission]:
    return ROLE_PERMISSIONS[role]


def has_permission(role: StaffRole, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]


def visible_permissions_of(role: StaffRole) -> list[str]:
    """Permissoes que ESTE cargo pode ver/receber em /auth/me (ordenadas)."""
    return sorted(p.value for p in ROLE_PERMISSIONS[role])


def assignable_roles(actor_role: StaffRole) -> list[StaffRole]:
    """
    Cargos que `actor_role` pode DAR a alguem (cadastrar ou promover):
    S.Adm da' qualquer um; Adm so' Creator; Creator nenhum.
    """
    if actor_role == StaffRole.SUPER_ADMIN:
        return [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.CREATOR]
    return [r for r in StaffRole if ROLE_RANK[r] < ROLE_RANK[actor_role]]


def can_manage_role(actor_role: StaffRole, target_role: StaffRole) -> bool:
    """
    `actor_role` pode mexer (trocar cargo / desativar) em alguem que hoje
    tem `target_role`? S.Adm mexe em qualquer um; os demais so' em quem
    esta' ESTRITAMENTE abaixo (Adm mexe em Creator, nunca em outro Adm).
    """
    return actor_role == StaffRole.SUPER_ADMIN or ROLE_RANK[actor_role] > ROLE_RANK[target_role]


def creator_can_touch_published(role: StaffRole) -> bool:
    """
    Quem NAO tem CONTENT_PUBLISH (Creator) so' mexe em rascunho: uma entry
    ja' publicada e' a pagina AO VIVO do site, e so' Adm/S.Adm alteram.
    """
    return Permission.CONTENT_PUBLISH in ROLE_PERMISSIONS[role]
