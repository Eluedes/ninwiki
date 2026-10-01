"""
Ponto de entrada da API do NinWiki.

Este e' o arquivo que o Uvicorn carrega quando voce roda:
    python -m uvicorn app.main:app --reload

"app.main:app" significa: modulo app/main.py, objeto chamado `app`.
"""
import asyncio
import sys

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
from fastapi.staticfiles import StaticFiles

from app.api.audit_log import router as audit_log_router
from app.api.auth import router as auth_router
from app.api.bot import router as bot_router
from app.api.content_items import router as content_items_router
from app.api.guide import router as guide_router
from app.api.masteries import router as masteries_router
from app.api.posts import router as posts_router
from app.api.staff import router as staff_router
from app.api.uploads import router as uploads_router
from app.api.villages import organizations_router, router as villages_router
from app.core.config import settings
from app.core.security import ClientIPMiddleware
from app.core.staff_service import StaffError

# Em produção, a documentação interativa fica desativada. Ela é útil no
# desenvolvimento, mas expor o schema completo da API publicamente facilita
# o reconhecimento de rotas por atacantes sem trazer benefício aos leitores.
docs_url = "/docs" if settings.environment == "development" else None
redoc_url = "/redoc" if settings.environment == "development" else None
openapi_url = "/openapi.json" if settings.environment == "development" else None

# Instância principal do FastAPI. Em desenvolvimento, title/version aparecem
# automaticamente na documentação interativa gerada em /docs.
app = FastAPI(
    title="NinWiki API",
    version="0.1.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)

# CORS (Cross-Origin Resource Sharing): por padrao, o navegador BLOQUEIA
# um site (ex: localhost:3000) de chamar uma API em outro endereco
# (ex: localhost:8000), a nao ser que a API diga explicitamente que
# permite. Esse middleware e' o que autoriza o front-end a nos chamar.
app.add_middleware(
    CORSMiddleware,
    # so' aceita requisicoes vindas exatamente desta origem (nunca "*"
    # em conjunto com allow_credentials=True - o navegador nem deixaria).
    allow_origins=[settings.frontend_origin],
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
app.include_router(audit_log_router)
app.include_router(masteries_router)
app.include_router(uploads_router)
app.include_router(villages_router)
app.include_router(posts_router)
app.include_router(organizations_router)
app.include_router(guide_router)
app.include_router(auth_router)
app.include_router(staff_router)
app.include_router(bot_router)

# Serve os arquivos da pasta uploads/ diretamente (ex: uma imagem salva
# em uploads/abc123.png fica acessivel em http://localhost:8000/uploads/abc123.png).
# O path fisico e' resolvido a partir DESTE arquivo (app/main.py), subindo
# um nivel ate' a raiz do NinWiki.Api - o mesmo calculo que app/api/uploads.py
# usa pra' saber onde SALVAR os arquivos, entao os dois sempre apontam
# pra' pasta certa mesmo se o projeto for movido de lugar.
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/health")
async def health_check():
    """
    Endpoint de verificacao rapida ("health check").

    Usado para confirmar que a API esta' de pe' e conectada ao ambiente
    certo, sem precisar testar nenhuma logica de negocio. E' o primeiro
    endpoint que testamos ao configurar o ambiente local.
    """
    return {"status": "ok", "environment": settings.environment}
