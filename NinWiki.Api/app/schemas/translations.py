"""Schemas da importacao de traducoes oficiais do jogo."""
from pydantic import Field

from app.schemas.content import CamelModel


class NewNamesRequest(CamelModel):
    """Arquivo em INGLES (as chaves sao os textos do jogo) e, opcionalmente, o de Portugues (para ja' trazer o nome oficial em PT)."""
    english: dict[str, str]
    portuguese: dict[str, str] | None = None


class NewName(CamelModel):
    """Um nome do jogo que o wiki ainda nao tem."""
    name: str
    name_pt: str | None = None
    hint: str | None = None       # 'jutsu' (parece jutsu) ou 'recipe' (parece receita); None = sem palpite


class NewNamesResult(CamelModel):
    """Resposta de /translations/new-names: contagens e a lista de nomes novos (ate' 5000, em ordem alfabetica)."""
    total_strings: int
    name_like: int
    already_in_wiki: int
    candidates: list[NewName]
    truncated: bool


class TranslationImportRequest(CamelModel):
    """O dicionario lido do arquivo (o navegador le o .json e manda so' o campo `translations`)."""
    translations: dict[str, str]
    language: str | None = None            # campo "language" do arquivo (ex.: "Brazilian Portuguese"); serve para barrar o arquivo errado
    overwrite: bool = False                # True = troca tambem o portugues que ja' existe (inclusive escrito a mao)


class TranslationSample(CamelModel):
    """Um exemplo de alteracao (para a pessoa conferir antes de aplicar)."""
    entity: str
    label: str
    field: str
    old: str | None
    new: str


class TranslationBreakdown(CamelModel):
    """Quantas alteracoes por tipo de registro, quantos registros existem e quantos nao tem traducao oficial no nome."""
    entity: str
    records: int
    changes: int
    unmatched: int
    unmatched_names: list[str] = Field(default_factory=list)   # alguns nomes (EN) sem acerto, para conferir grafia


class TranslationImportResult(CamelModel):
    """Resposta do preview/apply."""
    dictionary_entries: int          # pares uteis no arquivo
    total_changes: int
    applied: bool
    breakdown: list[TranslationBreakdown]
    samples: list[TranslationSample]
