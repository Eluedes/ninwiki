"""
Base declarativa do SQLAlchemy.

Todo modelo (tabela) do NinWiki deve herdar de `Base`. E' aqui que o
SQLAlchemy registra o "catalogo" de tabelas que o Alembic usa para
gerar migrations automaticamente (`alembic revision --autogenerate`).

BUG CORRIGIDO: este arquivo estava com o conteudo duplicado de
`app/core/database.py` (engine/sessao), sem a classe Base de verdade.
Sem ela, nenhum modelo (Mob, Mastery, Jutsu, etc.) teria como ser criado
na Fase 1, porque toda classe de tabela precisa herdar de alguma coisa
que o SQLAlchemy reconheça como "declarative base".
"""
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """
    Classe base de que todo modelo (tabela) do NinWiki deve herdar.

    Exemplo de uso futuro (Fase 1):
        class Mob(Base):
            __tablename__ = "mobs"
            id: Mapped[int] = mapped_column(primary_key=True)
    """
    pass


class TimestampMixin:
    """
    Mixin (classe "de apoio") que adiciona created_at/updated_at.

    Um "mixin" e' uma classe que nao e' usada sozinha, e sim combinada
    com outra via heranca multipla, so' para emprestar campos/comportamento.

    Uso (Fase 1):
        class Mob(Base, TimestampMixin):
            __tablename__ = "mobs"
            ...
    Isso da' a toda tabela que usar o mixin as colunas created_at e
    updated_at automaticamente, sem repetir o codigo em cada modelo.
    """

    # created_at: preenchido automaticamente pelo PROPRIO POSTGRES no
    # momento do INSERT (server_default=func.now()), nao pelo Python.
    # Isso garante que o horario e' sempre o do servidor de banco,
    # mesmo que o servidor da API esteja com o relogio errado.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # updated_at: mesma ideia, mas tambem se atualiza sozinho a cada
    # UPDATE na linha (onupdate=func.now()), sem precisar de logica
    # manual em cada endpoint que edita um registro.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
