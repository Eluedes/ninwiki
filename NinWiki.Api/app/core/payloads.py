"""
Aplica os campos de um payload (schema Pydantic) num objeto do banco
(model SQLAlchemy) de forma SEGURA - usado nos endpoints de editar.

POR QUE ISSO EXISTE: antes, endpoints como update_mastery copiavam os
campos UM POR UM, escritos a mao (mastery.name = payload.name, ...).
Quando um campo novo era adicionado (ex: `gif`, 27/09) no model e no
schema mas alguem esquecia de somar a linha correspondente no
endpoint, o campo simplesmente NAO ERA SALVO - sem erro nenhum, o
formulario "funcionava" e o dado sumia. Bug silencioso, o pior tipo.

COMO FUNCIONA:
  - copia TODO campo do payload pro objeto automaticamente - campo
    novo no schema passa a ser salvo sem precisar lembrar de nada;
  - se o payload tiver um campo que NAO existe como coluna no model
    (schema e model fora de sincronia), levanta um erro CLARO na hora,
    em vez de guardar o valor num atributo solto que o banco ignora;
  - `exclude` lista os campos tratados a mao em outro lugar (ex: listas
    de relacionamento como attribute_ids/paths).
"""
from collections.abc import Iterable

from pydantic import BaseModel


def apply_scalar_fields(obj: object, payload: BaseModel, exclude: Iterable[str] = ()) -> None:
    """Copia os campos simples do payload para o modelo (falha alto se schema e modelo divergirem)."""
    columns = set(type(obj).__table__.columns.keys())  # type: ignore[attr-defined]
    for field, value in payload.model_dump(exclude=set(exclude)).items():
        if field not in columns:
            raise RuntimeError(
                f"O campo '{field}' existe no schema ({type(payload).__name__}) mas nao "
                f"existe como coluna em {type(obj).__name__} - model e schema estao fora "
                f"de sincronia. Adicione a coluna no model (e crie a migracao com "
                f"`alembic revision --autogenerate`) ou remova o campo do schema."
            )
        setattr(obj, field, value)
