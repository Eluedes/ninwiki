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
  - Mudar o que um cargo pode: o S.Adm edita pelo painel (/admin/permissions); o padrao
    "de fabrica" fica em DEFAULT_ROLE_PERMISSIONS e os ajustes no banco (role_permissions).

REGRAS DE CARGO (hierarquia) ficam abaixo e em app/core/staff_service.py:
quem esta' embaixo nunca mexe em quem esta' em cima.
"""
from enum import Enum

from app.models.enums import StaffRole


class Permission(str, Enum):
    """Todas as permissoes que existem no sistema (nome = 'area.acao')."""
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
    MEDIA_UPLOAD = "media.upload"          # enviar imagens PELO BANCO DE IMAGENS (lote, arrastar e soltar). Padrao: so' S.Adm; o S.Adm pode liberar a Adm/Creator em /admin/permissions
    MEDIA_CLOSED = "media.closed"          # ver e usar a categoria "closed" do banco de imagens - so' S.Adm (SUPER_ONLY: os outros nem sabem que ela existe)
    MEDIA_RESET_IDS = "media.reset_ids"    # renumerar os IDs do banco de imagens (1, 2, 3...) - so' S.Adm (SUPER_ONLY)
    # --- Categorias do banco de imagens: "pode ver as imagens desta categoria". Padrao: todos veem (menos 'closed', so' S.Adm).
    #     O S.Adm TRANCA uma categoria para um cargo desmarcando a permissao em /admin/permissions: para quem nao tem, ela some da lista, da
    #     contagem e da busca, e tentar abrir uma imagem dela (ID chutado, img:12) da' o aviso de acesso negado - igual a 'closed'.
    MEDIA_CAT_WEAPON = "media.cat.weapon"
    MEDIA_CAT_CLOTHING = "media.cat.clothing"
    MEDIA_CAT_CONSUMABLE = "media.cat.consumable"
    MEDIA_CAT_CURRENCY = "media.cat.currency"
    MEDIA_CAT_MATERIAL = "media.cat.material"
    MEDIA_CAT_RING = "media.cat.ring"
    MEDIA_CAT_SCROLL = "media.cat.scroll"
    MEDIA_CAT_NPC = "media.cat.npc"
    MEDIA_CAT_MONSTER = "media.cat.monster"
    MEDIA_CAT_FURNITURE = "media.cat.furniture"
    MEDIA_CAT_HAIR_BEARD = "media.cat.hair_beard"
    MEDIA_CAT_OTHER = "media.cat.other"
    MEDIA_CAT_NONE = "media.cat.none"       # a categoria "Sem categoria"
    MEDIA_MANAGE = "media.manage"          # renomear, escolher categoria, apagar imagens do banco de imagens e sincronizar a pasta. Padrao: so' S.Adm (pode ser liberada em /admin/permissions)

    # --- Equipe ---
    STAFF_VIEW = "staff.view"
    STAFF_CREATE = "staff.create"
    STAFF_EDIT = "staff.edit"             # trocar cargo
    STAFF_DEACTIVATE = "staff.deactivate"  # desativar/reativar
    STAFF_DELETE = "staff.delete"          # REMOVER de vez da equipe (so' S.Adm; o historico no log continua)

    # --- Quadro de avisos (Visao Geral do painel) ---
    NOTICE_VIEW = "notices.view"          # ler avisos e baixar os arquivos anexados
    NOTICE_MANAGE = "notices.manage"      # postar/editar/apagar avisos e anexar arquivos

    # --- Anuncio da pagina inicial do site (aparece para todos os visitantes) ---
    ANNOUNCEMENT_MANAGE = "announcement.manage"

    # --- Cargos e permissoes (so' S.Adm: edita o que cada cargo pode) ---
    ROLES_MANAGE = "roles.manage"

    # --- Comentarios dos leitores no blog (esconder/apagar comentario, banir leitor) ---
    COMMENTS_MODERATE = "comments.moderate"

    # --- Reports dos visitantes (conteudo desatualizado / erro de traducao): ler, resolver, descartar e apagar ---
    REPORTS_MANAGE = "reports.manage"

    # --- Erros do wiki (traceback, IPs - so' o S.Adm) ---
    ERRORS_VIEW = "errors.view"

    # --- Acessos ao site (grafico e paises da Visao Geral) ---
    ANALYTICS_VIEW = "analytics.view"

    # --- Log ---
    AUDIT_VIEW = "audit.view"             # log de CONTEUDO
    AUDIT_VIEW_ALL = "audit.view_all"     # log COMPLETO (login, equipe, seguranca, IPs) - so' S.Adm
    AUDIT_CLEAR = "audit.clear"           # LIMPAR o log (apaga registros antigos) - so' S.Adm


# Permissoes que so' o S.Adm tem E que os outros cargos nem podem saber
# que existem (404 em vez de 403, fora da lista de /auth/me). Vai
# crescendo com o tempo, conforme o S.Adm ganhar poderes exclusivos.
SUPER_ONLY_PERMISSIONS: frozenset[Permission] = frozenset({
    Permission.AUDIT_VIEW_ALL,
    Permission.AUDIT_CLEAR,
    # A parte "Equipe" do painel e' so' do S.Adm.
    Permission.STAFF_VIEW,
    Permission.STAFF_CREATE,
    Permission.STAFF_EDIT,
    Permission.STAFF_DEACTIVATE,
    Permission.STAFF_DELETE,
    Permission.ROLES_MANAGE,
    Permission.ERRORS_VIEW,
    Permission.MEDIA_RESET_IDS,
    Permission.MEDIA_CLOSED,
})

_CREATOR: frozenset[Permission] = frozenset({
    Permission.CONTENT_CREATE,
    Permission.CONTENT_EDIT,          # so' em RASCUNHO - ver creator_can_touch_published()
    Permission.POST_CREATE,
    Permission.POST_EDIT,             # so' em RASCUNHO
    Permission.UPLOAD_CREATE,
    *(p for p in Permission if p.value.startswith("media.cat.")),   # ve todas as categorias do banco de imagens (o S.Adm pode trancar)
    Permission.TRANSLATION_RETRANSLATE,
    Permission.NOTICE_VIEW,
})

_ADMIN: frozenset[Permission] = _CREATOR | frozenset({
    Permission.CONTENT_PUBLISH,
    Permission.CONTENT_DELETE,
    Permission.CONTENT_IMPORT,
    Permission.POST_PUBLISH,
    Permission.POST_DELETE,
    Permission.LORE_EDIT,
    Permission.LORE_DELETE,
    Permission.NOTICE_MANAGE,
    Permission.ANNOUNCEMENT_MANAGE,
    Permission.COMMENTS_MODERATE,
    Permission.REPORTS_MANAGE,
    Permission.ANALYTICS_VIEW,
    Permission.AUDIT_VIEW,
})

# S.Adm: literalmente tudo que existe no catalogo (inclusive o que for
# adicionado depois - nao precisa lembrar de atualizar esta linha).
_SUPER_ADMIN: frozenset[Permission] = frozenset(Permission)

# Padrao "de fabrica" de cada cargo (o que vale quando ninguem editou nada).
DEFAULT_ROLE_PERMISSIONS: dict[StaffRole, frozenset[Permission]] = {
    StaffRole.CREATOR: _CREATOR,
    StaffRole.ADMIN: _ADMIN,
    StaffRole.SUPER_ADMIN: _SUPER_ADMIN,
}

# Permissoes EFETIVAS = padrao + ajustes que o S.Adm fez pelo painel (tabela
# role_permissions, carregada por app/core/role_config.py). E' este dict que
# has_permission() consulta. O S.Adm nunca e' ajustavel: sempre tem tudo.
ROLE_PERMISSIONS: dict[StaffRole, frozenset[Permission]] = dict(DEFAULT_ROLE_PERMISSIONS)

# Cargos cujas permissoes o S.Adm pode editar.
EDITABLE_ROLES: tuple[StaffRole, ...] = (StaffRole.ADMIN, StaffRole.CREATOR)


def category_permission(category: str) -> Permission:
    """A permissao que libera VER uma categoria do banco de imagens ('' = Sem categoria; 'closed' = so' S.Adm)."""
    if category == "closed":
        return Permission.MEDIA_CLOSED
    return Permission("media.cat." + (category or "none"))


def is_category_locked(user, category: str) -> bool:
    """True se `user` NAO pode ver as imagens da categoria (trancada para o cargo dele, ou 'closed' sem ser S.Adm)."""
    return not user_has_permission(user, category_permission(category))


def grantable_permissions() -> list[Permission]:
    """Permissoes que podem ser dadas a Adm/Creator (as exclusivas do S.Adm ficam de fora)."""
    return [p for p in Permission if p not in SUPER_ONLY_PERMISSIONS]


def apply_overrides(overrides: dict[StaffRole, dict[str, bool]]) -> None:
    """
    Recalcula ROLE_PERMISSIONS a partir do padrao + ajustes ({cargo: {permissao: liberada?}}).
    Ignora, por seguranca: cargo nao editavel, permissao desconhecida e permissao exclusiva do S.Adm.
    """
    valid = {p.value: p for p in grantable_permissions()}
    new = dict(DEFAULT_ROLE_PERMISSIONS)
    for role in EDITABLE_ROLES:
        perms = set(DEFAULT_ROLE_PERMISSIONS[role])
        for name, granted in overrides.get(role, {}).items():
            perm = valid.get(name)
            if perm is None:
                continue
            (perms.add if granted else perms.discard)(perm)
        new[role] = frozenset(perms - SUPER_ONLY_PERMISSIONS)
    ROLE_PERMISSIONS.update(new)

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
    """Permissoes efetivas de um cargo (padrao + ajustes feitos no painel)."""
    return ROLE_PERMISSIONS[role]


def has_permission(role: StaffRole, permission: Permission) -> bool:
    """True se o cargo tem a permissao (usa as permissoes efetivas)."""
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


# ---------------- cargos personalizados (criados pelo S.Adm no painel) ----------------
# Quem tem um cargo personalizado carrega `role = creator` + `custom_role`. As permissoes dele sao SO' as do cargo
# personalizado (nunca as do Creator, nunca uma exclusiva do S.Adm), por mais que o JSON do banco diga outra coisa.

def custom_permissions(names: list[str] | None) -> frozenset[Permission]:
    """Converte os nomes guardados no cargo personalizado em permissoes validas (ignora desconhecidas e exclusivas do S.Adm)."""
    valid = {p.value: p for p in grantable_permissions()}
    return frozenset(valid[n] for n in (names or []) if n in valid)


def user_permissions(user) -> frozenset[Permission]:
    """Permissoes EFETIVAS de um usuario: as do cargo personalizado (se tiver) ou as do cargo comum."""
    custom = getattr(user, "custom_role", None)
    if custom is not None and user.role == StaffRole.CREATOR:
        return custom_permissions(custom.permissions)
    return ROLE_PERMISSIONS[user.role]


def user_has_permission(user, permission: Permission) -> bool:
    """True se o usuario tem a permissao (considera o cargo personalizado)."""
    return permission in user_permissions(user)


def user_role_label(user) -> str:
    """Nome do cargo para mostrar: o do cargo personalizado, ou S.Adm/Adm/Creator."""
    custom = getattr(user, "custom_role", None)
    if custom is not None and user.role == StaffRole.CREATOR:
        return custom.name
    return ROLE_LABEL[user.role]


def visible_permissions_for(user) -> list[str]:
    """Permissoes que ESTE usuario recebe em /auth/me (ordenadas)."""
    return sorted(p.value for p in user_permissions(user))
