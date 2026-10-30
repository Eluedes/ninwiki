"""Slug unico do projeto: minusculo, so' a-z 0-9 e hifen, sem hifen nas pontas."""
import re
import unicodedata


def slugify(text: str, max_length: int | None = None, fold_accents: bool = True) -> str:
    """
    'Patch Notes!' -> 'patch-notes'. Pode devolver '' (cada chamador decide o plano B).
    fold_accents=True tira os acentos (NFKD: 'Café' -> 'cafe'); False mantem o comportamento
    antigo do content_items, onde letra acentuada virava hifen ('Café' -> 'caf').
    max_length corta o slug e limpa o hifen que sobrar na ponta.
    """
    if fold_accents:
        text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if max_length is not None:
        slug = slug[:max_length].strip("-")
    return slug
