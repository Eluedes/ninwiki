"""
Ponto de entrada da API do Nin Codex.

Este e' o arquivo que o Uvicorn carrega quando voce roda:
    python -m uvicorn app.main:app --reload

"app.main:app" significa: modulo app/main.py, objeto chamado `app`.
"""
import asyncio
import logging
import sys
from contextlib import asynccontextmanager

# CORRECAO PARA WINDOWS - PRECISA SER A PRIMEIRA COISA A RODAR NO ARQUIVO:
# o event loop PADRAO do asyncio no Windows (ProactorEventLoop) tem um
# bug conhecido e antigo de compatibilidade com o asyncpg - conexoes
# com o Postgres podem ser derrubadas ("ConnectionResetError" /
# "connection was closed in the middle of operation") mesmo com o
# banco 100% saudavel e acessivel por outras ferramentas (psql, DBeaver,
# Adminer) sem problema nenhum. A prova de que e' esse bug especifico
# (e nao rede/Docker/Postgres) e' exatamente isso: uma ferramenta que
# nao passa pelo asyncio do Python conecta sem erro, mas o FastAPI via
# asyncpg falha.
#
# WindowsSelectorEventLoopPolicy troca pro OUTRO event loop que o
# Windows oferece (baseado em select(), sem o bug), e nao afeta Linux/
# Mac em nada (sys.platform so' bate "win32" no Windows).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles

from app.api.analytics import router as analytics_router
from app.api.steam_news import router as steam_news_router
from app.api.media import router as media_router
from app.api.announcement import router as announcement_router
from app.api.audit_log import router as audit_log_router
from app.api.auth import router as auth_router
from app.api.bot import router as bot_router
from app.api.content_items import router as content_items_router
from app.api.engagement import moderation_router as comments_moderation_router, router as engagement_router
from app.api.reports import router as reports_router
from app.api.translations import router as translations_router
from app.api.errors import client_router as client_errors_router, router as errors_router
from app.api.guide import router as guide_router
from app.api.masteries import router as masteries_router
from app.api.notices import router as notices_router
from app.api.roles import router as roles_router
from app.api.posts import router as posts_router
from app.api.search import router as search_router
from app.api.site import router as site_router
from app.api.staff import router as staff_router
from app.api.tags import router as tags_router
from app.api.uploads import router as uploads_router
from app.api.villages import organizations_router, router as villages_router
from app.core.config import settings
from app.core import maintenance, steam_news
from app.core.database import AsyncSessionLocal
from app.core.hardening import BodyLimitMiddleware, ErrorCaptureMiddleware, PublicCacheMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware
from app.core.security import ClientIPMiddleware
from app.core.staff_service import StaffError

# Em produção, a documentação interativa fica desativada. Ela é útil no
# desenvolvimento, mas expor o schema completo da API publicamente facilita
# o reconhecimento de rotas por atacantes sem trazer benefício aos leitores.
docs_url = "/docs" if settings.environment == "development" else None
redoc_url = "/redoc" if settings.environment == "development" else None
openapi_url = "/openapi.json" if settings.environment == "development" else None

_steam_log = logging.getLogger("ninwiki.steam")


async def _steam_news_loop() -> None:
    """Tarefa de fundo: de STEAM_NEWS_INTERVAL_MINUTES em minutos, importa os posts de atualizacao novos da Steam (so' roda se STEAM_NEWS_APP_ID estiver preenchido)."""
    await asyncio.sleep(60)   # nao disputa recursos com a subida da API
    while True:
        try:
            async with AsyncSessionLocal() as db:
                run = await steam_news.import_news(db)
            if run["imported"] or run["errors"]:
                _steam_log.info("Steam news: %s novo(s), erros: %s", run["imported"], run["errors"])
        except Exception:  # noqa: BLE001 - a tarefa nunca morre por causa de um ciclo ruim
            _steam_log.exception("Steam news: falha inesperada no ciclo")
        await asyncio.sleep(max(10, settings.steam_news_interval_minutes) * 60)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Liga a tarefa de fundo do importador da Steam (se configurado) e a desliga ao encerrar a API."""
    task = asyncio.create_task(_steam_news_loop()) if settings.steam_news_app_id else None
    maint = asyncio.create_task(maintenance.loop()) if settings.maintenance_interval_hours > 0 else None   # limpeza automatica (app/core/maintenance.py)
    try:
        yield
    finally:
        for t in (task, maint):
            if t:
                t.cancel()


# Instância principal do FastAPI. Em desenvolvimento, title/version aparecem
# automaticamente na documentação interativa gerada em /docs.
app = FastAPI(
    title="Nin Codex API",
    version="0.1.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
    lifespan=lifespan,
)

# CORS (Cross-Origin Resource Sharing): por padrao, o navegador BLOQUEIA
# um site (ex: localhost:3000) de chamar uma API em outro endereco
# (ex: localhost:8000), a nao ser que a API diga explicitamente que
# permite. Esse middleware e' o que autoriza o front-end a nos chamar.
# ORDEM DAS CAMADAS (a ultima adicionada e' a mais externa; a requisicao entra de fora pra dentro):
#   ClientIP -> CORS -> SecurityHeaders -> PublicCache -> ErrorCapture -> RateLimit -> BodyLimit -> rotas.
# O CORS fica por fora do limite de taxa para o navegador conseguir ler tambem as respostas 429/413.
app.add_middleware(BodyLimitMiddleware)       # corpo gigante -> 413
app.add_middleware(RateLimitMiddleware)       # flood / scraping -> 429
app.add_middleware(ErrorCaptureMiddleware)    # excecao nao tratada / 5xx -> registro de erros + 500 generico
app.add_middleware(PublicCacheMiddleware)     # ETag + cache curto nas leituras publicas anonimas (304 sem corpo)
app.add_middleware(SecurityHeadersMiddleware) # cabecalhos de seguranca em toda resposta

app.add_middleware(
    CORSMiddleware,
    # so' aceita requisicoes vindas exatamente desta origem (nunca "*"
    # em conjunto com allow_credentials=True - o navegador nem deixaria).
    allow_origins=settings.allowed_origins,
    # permite enviar cookies/credenciais (necessario para o fluxo de
    # login com cookie httpOnly que a Fase 2 vai implementar).
    allow_credentials=True,
    # ATUALIZADO: o painel admin agora GRAVA dado de verdade
    # (content_items), entao POST/PUT/DELETE/PATCH precisam estar
    # liberados aqui - antes so' GET era permitido, porque so' existia
    # leitura. PATCH e' usado pelo bulk-status (marcar varias entries
    # como publicadas/rascunho de uma vez).
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Accept", "Content-Type"],
)

# Captura o IP de quem chama (vai pro log geral - ver app/core/security.py).
app.add_middleware(ClientIPMiddleware)


@app.exception_handler(StaffError)
async def staff_error_handler(request: Request, exc: StaffError):
    """Regra de equipe violada (hierarquia, dono, ultimo S.Adm...) -> resposta HTTP limpa."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# Registra as rotas de /content-items (ver app/api/content_items.py).
# Conforme mais tipos de conteudo ganharem API (masteries, villages,
# etc.), cada um ganha seu proprio router aqui, do mesmo jeito.
app.include_router(content_items_router)
app.include_router(steam_news_router)
app.include_router(audit_log_router)
app.include_router(masteries_router)
app.include_router(uploads_router)
app.include_router(villages_router)
app.include_router(posts_router)
app.include_router(engagement_router)
app.include_router(comments_moderation_router)
app.include_router(tags_router)
app.include_router(analytics_router)
app.include_router(media_router)
app.include_router(announcement_router)
app.include_router(search_router)
app.include_router(organizations_router)
app.include_router(guide_router)
app.include_router(auth_router)
app.include_router(staff_router)
app.include_router(bot_router)
app.include_router(roles_router)
app.include_router(notices_router)
app.include_router(errors_router)
app.include_router(client_errors_router)
app.include_router(reports_router)
app.include_router(site_router)
app.include_router(translations_router)

# Serve os arquivos da pasta uploads/ diretamente (ex: uma imagem salva
# em uploads/abc123.png fica acessivel em http://localhost:8000/uploads/abc123.png).
# O path fisico e' resolvido a partir DESTE arquivo (app/main.py), subindo
# um nivel ate' a raiz do NinWiki.Api - o mesmo calculo que app/api/uploads.py
# usa pra' saber onde SALVAR os arquivos, entao os dois sempre apontam
# pra' pasta certa mesmo se o projeto for movido de lugar.
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


def _read_version() -> str:
    """Versao publicada (7 primeiros caracteres do commit): o workflow de deploy grava o arquivo VERSION; local = 'dev'."""
    try:
        return (uploads_dir.parent / "VERSION").read_text(encoding="utf-8").strip()[:7] or "dev"
    except OSError:
        return "dev"


APP_VERSION = _read_version()


@app.get("/health")
async def health_check():
    """
    Endpoint de verificacao rapida ("health check").

    Usado para confirmar que a API esta' de pe' e conectada ao ambiente
    certo, sem precisar testar nenhuma logica de negocio. E' o primeiro
    endpoint que testamos ao configurar o ambiente local.
    """
    return {"status": "ok", "environment": settings.environment, "version": APP_VERSION}


@app.get("/health/ready")
async def health_ready():
    """
    Verificacao PROFUNDA: alem de a API estar de pe', confere se o banco responde (SELECT 1). Responde 503 se o banco cair.
    O bot consulta isto de tempos em tempos e avisa a equipe no Discord quando a API ou o banco ficam fora do ar.
    """
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - qualquer falha = "banco fora do ar"
        return JSONResponse(status_code=503, content={"status": "down", "database": "unreachable"})
    return {"status": "ok", "database": "ok"}
