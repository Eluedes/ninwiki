"""Schemas do registro de erros: leitura (painel e bot) e o relatorio de erro que o site envia."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.content import CamelModel


class ErrorEventRead(CamelModel):
    """Um problema como o painel (S.Adm) ve': com traceback mascarado e IP da ultima ocorrencia."""
    id: uuid.UUID
    source: str
    level: str
    title: str
    message: str
    location: str | None
    path: str | None
    method: str | None
    status: int | None
    trace: str | None
    ip_address: str | None
    count: int
    first_seen: datetime
    last_seen: datetime
    resolved: bool
    resolved_at: datetime | None
    resolved_by: str | None


class BotErrorEntry(CamelModel):
    """Um problema como o BOT recebe: resumo sem traceback e sem IP (vai para um canal do Discord)."""
    id: uuid.UUID
    fingerprint: str
    source: str
    level: str
    title: str
    message: str
    location: str | None
    path: str | None
    method: str | None
    status: int | None
    count: int
    first_seen: datetime
    last_seen: datetime
    resolved: bool


class ClientErrorReport(CamelModel):
    """Erro que o visitante viu no site (reportado pelo navegador). Tudo limitado em tamanho e limpo de caracteres de controle."""
    message: str = Field(min_length=1, max_length=500)
    path: str = Field(default="", max_length=300)
    kind: Literal["render", "runtime", "network"] = "render"
    digest: str | None = Field(default=None, max_length=64)

    @field_validator("message", "path", "digest")
    @classmethod
    def _clean(cls, v: str | None) -> str | None:
        """Tira caracteres de controle (nada de quebra de linha/escape no meio do que vai pro painel e pro Discord)."""
        return None if v is None else "".join(ch if ch.isprintable() else " " for ch in v).strip()
