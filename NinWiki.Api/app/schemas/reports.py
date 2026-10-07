"""Schemas dos reports de visitantes: envio (publico) e leitura (painel)."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.content import CamelModel

MAX_REPORT_CHARS = 1000
MIN_REPORT_CHARS = 10


class ReportCreate(CamelModel):
    """O que o visitante envia. Nome e endereco da pagina NAO vem do cliente: a API os busca pelo alvo (ninguem inventa link)."""
    target_type: Literal["content", "jutsu", "mastery"]
    target_id: str = Field(min_length=1, max_length=150)
    kind: Literal["outdated", "translation", "other"]
    message: str = Field(max_length=MAX_REPORT_CHARS * 2)   # folga: o limite exato e' conferido depois de limpar o texto
    locale: Literal["pt", "en"] | None = None
    website: str = ""   # "isca" anti-robo: campo escondido na tela; se vier preenchido, e' robo (o report e' descartado em silencio)


class ReportRead(CamelModel):
    """Um report como o painel ve' (sem o IP)."""
    id: uuid.UUID
    target_type: str
    target_id: str
    target_name: str
    target_path: str
    kind: str
    message: str
    locale: str | None
    status: str
    created_at: datetime
    handled_by: str | None
    handled_at: datetime | None


class ReportStatusUpdate(CamelModel):
    """Corpo do PATCH: novo status do report."""
    status: Literal["open", "resolved", "dismissed"]
