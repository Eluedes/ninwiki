"""
Importa todos os modelos num lugar so'. Isso e' o que faz o Alembic
"enxergar" as tabelas na hora de gerar uma migration automaticamente
(`alembic revision --autogenerate`) - ele olha pra Base.metadata, e
uma classe so' entra em Base.metadata se o Python chegou a IMPORTAR o
arquivo dela pelo menos uma vez. Sem este arquivo reunindo os imports,
seria facil esquecer de importar um modelo novo e o Alembic
simplesmente nao gerar a tabela dele, silenciosamente.

Ao criar um modelo novo: sempre adicionar o import aqui tambem.
"""
from app.models.base import Base, TimestampMixin  # noqa: F401
from app.models.content import ContentItem, ContentItemAttribute, ContentItemDrop  # noqa: F401
from app.models.masteries import Attribute, Jutsu, Mastery, MasteryAttribute, MasteryPath, MasteryPathAttribute  # noqa: F401
from app.models.villages import Clan, Organization, OrganizationVillage, Village  # noqa: F401
from app.models.guide import NinjaRank, Profession, StoryArc, Summon  # noqa: F401
from app.models.users import AuditLogEntry, User  # noqa: F401
from app.models.posts import Post  # noqa: F401
from app.models.roles import CustomRole, RolePermission  # noqa: F401
from app.models.notices import Notice, NoticeFile  # noqa: F401
from app.models.errors import ErrorEvent  # noqa: F401
from app.models.posts import Tag, post_tag_links  # noqa: F401
from app.models.readers import PostComment, PostLike, Reader  # noqa: F401
from app.models.traffic import TrafficDaily, TrafficPage, TrafficPlace, TrafficVisitor  # noqa: F401
from app.models.announcement import SiteAnnouncement  # noqa: F401
from app.models.media import MediaImage  # noqa: F401
from app.models.reports import ContentReport  # noqa: F401
