"""
Helper do LOG GERAL: grava uma linha em audit_log toda vez que algo
importante acontece (conteudo criado/editado/apagado, login, mudanca de
equipe, tentativa negada...). Centralizado aqui pra' todo router chamar a
MESMA funcao em vez de reescrever a logica de log toda vez.

Cada linha guarda QUEM (usuario + cargo naquele momento), O QUE, DE ONDE
(painel/bot/auth) e o IP - o IP vem sozinho de client_ip_var, ver
app/core/security.py.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import client_ip_var
from app.models.users import AuditLogEntry, User


async def log_action(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: str,
    diff: dict | None = None,
    actor: User | None = None,
    source: str = "panel",
) -> None:
    """
    Adiciona uma linha de log a' sessao ATUAL - nao da' commit sozinho,
    porque isso deve acontecer na MESMA transacao da alteracao de
    verdade (assim, se a alteracao falhar e der rollback, o log falso
    tambem some, em vez de registrar uma acao que na verdade nao aconteceu).
    """
    db.add(AuditLogEntry(
        user_id=actor.id if actor else None,
        actor_name=actor.username if actor else None,
        actor_role=actor.role.value if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id)[:100],
        diff=diff,
        source=source,
        ip_address=client_ip_var.get(),
    ))
