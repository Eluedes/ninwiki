"""Utilitarios de texto compartilhados."""


def escape_like(q: str) -> str:
    """Escapa \\, % e _ digitados pela pessoa (use com ilike(..., escape="\\\\")); sem isso "%" casaria com tudo."""
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
