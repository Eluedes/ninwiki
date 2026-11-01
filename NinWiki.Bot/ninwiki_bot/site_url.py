"""
Qual endereco do SITE o bot usa nos links (botoes "Abrir a pagina", /help, torneios...).

FONTE UNICA: o endereco vem da API (GET /bot/config -> `siteUrl`, que e' o FRONTEND_ORIGIN dela). Numa troca de dominio a API ja' precisa ser atualizada
(CORS/CSRF), entao o bot acompanha sozinho: ninguem precisa lembrar de mudar tambem o SITE_URL do bot. O SITE_URL do .env fica como RESERVA, usado so'
quando a API nao responde ou devolve um endereco invalido.
Este arquivo nao importa discord.py: e' funcao pura, facil de testar.
"""


def escolher_site_url(atual: str, da_api: str | None) -> str:
    """O endereco do site a usar agora: o da API quando for um http(s) valido (sem barra no fim); senao o `atual` (SITE_URL do .env ou o ultimo bom)."""
    novo = (da_api or "").strip().rstrip("/")
    if novo.startswith(("https://", "http://")) and len(novo) > 8 and not any(c.isspace() for c in novo):
        return novo
    return (atual or "").strip().rstrip("/")
