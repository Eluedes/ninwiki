"""
Teste automatizado da Fase 2: cargos, permissoes, sessao, CSRF, bot e
login do Discord (com o Discord simulado).

COMO RODAR (na pasta NinWiki.Api, venv ativado, banco ligado e migrado):
    py scripts/testar_permissoes.py

NAO PRECISA de Discord, do bot nem de DEV_LOGIN. Cria os proprios
usuarios/entries de teste (nomes comecam com TESTE_ / teste-perm-) e APAGA
tudo no final, mesmo se algum teste falhar. Rode sempre que mexer em
permissoes, cargos ou login - foi feito pra' pegar exatamente o tipo de
erro que da' brecha de seguranca sem ninguem perceber.
"""
import asyncio
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
import jwt
from sqlalchemy import delete, select, text

from app.api.audit_log import CONTENT_ENTITY_TYPES
from app.core.config import Settings, settings
from app.core.rate_limit import limiter
from app.core.database import AsyncSessionLocal
from app.core.permissions import Permission
from app.core.auth import get_current_user, require_permission
from fastapi.routing import APIRoute
from app.core.security import SESSION_COOKIE, STATE_COOKIE, create_session_token
from app.main import app
from app.models.enums import StaffRole
from app.models.users import AuditLogEntry, User

PASS, FAIL = 0, 0
FALHAS: list[str] = []


def check(nome: str, condicao: bool, detalhe: str = "") -> None:
    global PASS, FAIL
    if condicao:
        PASS += 1
        print(f"  [OK]   {nome}")
    else:
        FAIL += 1
        FALHAS.append(nome)
        print(f"  [FALHOU] {nome} {('-> ' + detalhe) if detalhe else ''}")


def secao(titulo: str) -> None:
    limiter.reset()  # cada secao comeca com o limite de tentativas zerado
    print(f"\n== {titulo}")


BASE = random.randint(10**17, 9 * 10**17)  # IDs de teste no formato de um Discord ID real (18 digitos)
IDS = {"sadm": BASE + 1, "sadm2": BASE + 2, "adm": BASE + 3, "adm2": BASE + 4, "creator": BASE + 5, "creator2": BASE + 6, "inativo": BASE + 7}
TESTE_IDS_TEXTO = [str(v) for v in IDS.values()] + [str(BASE + n) for n in range(8, 30)]
SLUG = f"teste-perm-{BASE % 100000}"


def cookie(user: User, token: str | None = None) -> dict:
    return {"Cookie": f"{SESSION_COOKIE}={token or create_session_token(user)}"}


async def criar_user(chave: str, role: StaffRole, ativo: bool = True) -> User:
    async with AsyncSessionLocal() as db:
        u = User(discord_id=IDS[chave], username=f"TESTE_{chave}", role=role, is_active=ativo)
        db.add(u)
        await db.commit()
        await db.refresh(u)
        return u


async def recarregar(u: User) -> User:
    async with AsyncSessionLocal() as db:
        return await db.get(User, u.id)


def novo_conteudo(sufixo: str, status: str = "draft") -> dict:
    return {"slug": f"{SLUG}-{sufixo}", "category": "guides", "name": f"TESTE {sufixo}", "level": 1,
            "icon": "📘", "rarity": "common", "description": "texto de teste", "status": status}



# Leituras (GET) que sao PUBLICAS de proposito - o site publico precisa delas.
# Qualquer OUTRA rota que nao esteja aqui tem que exigir login. Ao criar uma
# rota publica nova, adicione o caminho aqui (e' uma decisao consciente).
ROTAS_PUBLICAS = {
    ("GET", "/health"), ("GET", "/auth/config"), ("GET", "/auth/discord/login"), ("GET", "/auth/discord/callback"),
    ("GET", "/content-items"), ("GET", "/content-items/{item_id}"), ("GET", "/content-items/slug/{slug}"),
    ("GET", "/attributes"), ("GET", "/masteries"), ("GET", "/masteries/{mastery_id}"),
    ("GET", "/jutsus"), ("GET", "/jutsus/{jutsu_id}"),
    ("GET", "/villages"), ("GET", "/villages/{village_id}"), ("GET", "/organizations"),
    ("GET", "/posts"), ("GET", "/posts/{post_id}"), ("GET", "/posts/slug/{slug}"),
    ("GET", "/professions"), ("GET", "/ninja-ranks"), ("GET", "/story-arcs"), ("GET", "/summons"),
    # escrita "publica" de proposito: cada uma tem a sua propria protecao
    ("POST", "/auth/dev-login"),   # so' funciona em development + confere a origem
    ("POST", "/auth/logout"),      # sem sessao so' limpa o cookie
}


def todas_as_rotas(rotas=None):
    """Percorre TODAS as rotas, inclusive as que vem dentro de include_router (aninhadas)."""
    for r in (app.routes if rotas is None else rotas):
        if isinstance(r, APIRoute):
            yield r
        inner = getattr(r, "original_router", None)
        if inner is not None:
            yield from todas_as_rotas(inner.routes)


def _chamadas_da_rota(dependant) -> list:
    achadas = []
    for dep in dependant.dependencies:
        achadas.append(dep.call)
        achadas.extend(_chamadas_da_rota(dep))
    return achadas


def rota_exige_login(route: APIRoute) -> bool:
    for call in _chamadas_da_rota(route.dependant):
        nome = getattr(call, "__qualname__", "")
        if call is get_current_user or nome.startswith("require_permission") or nome == "require_bot":
            return True
    return False


async def main() -> None:
    orig = {k: getattr(settings, k) for k in
            ("super_admin_discord_ids", "bot_api_token", "dev_login_enabled", "discord_client_id", "discord_client_secret")}
    inicio = datetime.now(timezone.utc)
    transport = httpx.ASGITransport(app=app, client=("203.0.113.9", 4242))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        try:
            await rodar_testes(c)
        finally:
            for k, v in orig.items():
                setattr(settings, k, v)
            await limpar(inicio)


async def limpar(inicio: datetime) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM content_items WHERE slug LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM jutsus WHERE id LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM posts WHERE slug LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM organizations WHERE id LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM villages WHERE id LIKE :p"), {"p": f"{SLUG}%"})
        # Apaga o log ANTES dos usuarios de teste. Por user_id (e nao so' pelo nome): o teste do login
        # do Discord RENOMEIA usuarios, e linhas de log de quem foi renomeado nao casam mais com "TESTE_%".
        ids_teste = select(User.id).where(User.discord_id.in_([int(x) for x in TESTE_IDS_TEXTO]))
        await db.execute(delete(AuditLogEntry).where(
            AuditLogEntry.user_id.in_(ids_teste) | (AuditLogEntry.actor_name.like("TESTE_%"))
            | (AuditLogEntry.entity_id.in_(TESTE_IDS_TEXTO)) | (AuditLogEntry.entity_id.like(f"{SLUG}%"))))
        await db.execute(delete(User).where(User.discord_id.in_([int(x) for x in TESTE_IDS_TEXTO])))
        await db.commit()
    print("\n(dados de teste apagados)")


async def rodar_testes(c: httpx.AsyncClient) -> None:
    sadm = await criar_user("sadm", StaffRole.SUPER_ADMIN)
    adm = await criar_user("adm", StaffRole.ADMIN)
    adm2 = await criar_user("adm2", StaffRole.ADMIN)
    creator = await criar_user("creator", StaffRole.CREATOR)
    creator2 = await criar_user("creator2", StaffRole.CREATOR)
    inativo = await criar_user("inativo", StaffRole.ADMIN, ativo=False)
    S, A, C = cookie(sadm), cookie(adm), cookie(creator)

    # ------------------------------------------------------------------
    secao("1) Sem login (anonimo) nao consegue nada")
    for metodo, url in [("POST", "/content-items"), ("PUT", "/content-items/00000000-0000-0000-0000-000000000000"),
                        ("DELETE", "/content-items/00000000-0000-0000-0000-000000000000"),
                        ("PATCH", "/content-items/bulk-status"), ("POST", "/content-items/bulk-delete"),
                        ("POST", "/content-items/bulk-import"), ("POST", "/uploads/image"),
                        ("PUT", "/masteries/fire"), ("POST", "/jutsus"), ("GET", "/audit-log"),
                        ("GET", "/staff"), ("POST", "/staff"), ("GET", "/auth/me")]:
        r = await c.request(metodo, url, json={} if metodo != "GET" else None)
        check(f"{metodo} {url} -> 401", r.status_code == 401, f"veio {r.status_code}")

    # ------------------------------------------------------------------
    secao("2) Rascunho invisivel pro publico; Creator so' cria rascunho")
    r = await c.post("/content-items", json=novo_conteudo("rasc"), headers=C)
    check("Creator cria rascunho (201)", r.status_code == 201, r.text[:120])
    rasc_id = r.json().get("id")
    r = await c.post("/content-items", json=novo_conteudo("pub-creator", "published"), headers=C)
    check("criar SEMPRE gera rascunho, mesmo se pedirem 'published'",
          r.status_code == 201 and r.json().get("status") == "draft", f"veio {r.status_code} {r.text[:80]}")
    r = await c.get(f"/content-items/{rasc_id}")
    check("anonimo NAO ve rascunho por id (404)", r.status_code == 404)
    r = await c.get(f"/content-items/slug/{SLUG}-rasc")
    check("anonimo NAO ve rascunho por slug (404)", r.status_code == 404)
    r = await c.get("/content-items?status=draft")
    check("anonimo pedindo ?status=draft nao recebe rascunho", all(i["slug"] != f"{SLUG}-rasc" for i in r.json()))
    r = await c.get("/content-items")
    check("listagem anonima sem filtro nao vaza rascunho", all(i["slug"] != f"{SLUG}-rasc" for i in r.json()))
    r = await c.get(f"/content-items/{rasc_id}", headers=C)
    check("staff logada ve o rascunho (200)", r.status_code == 200)
    r = await c.put(f"/content-items/{rasc_id}", json={**novo_conteudo("rasc"), "name": "TESTE editado"}, headers=C)
    check("Creator edita o proprio rascunho (200)", r.status_code == 200, f"veio {r.status_code} {r.text[:100]}")
    r = await c.put(f"/content-items/{rasc_id}", json=novo_conteudo("rasc", "published"), headers=C)
    check("Creator NAO publica editando (403)", r.status_code == 403)

    # ------------------------------------------------------------------
    secao("3) Adm publica; depois Creator nao mexe mais na pagina ao vivo")
    r = await c.patch("/content-items/bulk-status", json={"ids": [rasc_id], "status": "published"}, headers=C)
    check("Creator NAO usa bulk-status (403)", r.status_code == 403)
    r = await c.patch("/content-items/bulk-status", json={"ids": [rasc_id], "status": "published"}, headers=A)
    check("Adm publica (200)", r.status_code == 200, f"veio {r.status_code}")
    r = await c.get(f"/content-items/{rasc_id}")
    check("anonimo agora ve a entry publicada (200)", r.status_code == 200)
    r = await c.put(f"/content-items/{rasc_id}", json=novo_conteudo("rasc", "published"), headers=C)
    check("Creator NAO edita entry publicada (403)", r.status_code == 403)
    r = await c.post(f"/content-items/{rasc_id}/retranslate", headers=C)
    check("Creator NAO retraduz entry publicada (403)", r.status_code == 403)
    r = await c.delete(f"/content-items/{rasc_id}", headers=C)
    check("Creator NAO apaga (403)", r.status_code == 403)
    r = await c.post("/content-items/bulk-import", json={"entries": [{"name": "x", "category": "guides"}]}, headers=C)
    check("Creator NAO faz importacao em massa (403)", r.status_code == 403)
    r = await c.put(f"/content-items/{rasc_id}", json={**novo_conteudo("rasc", "published"), "name": "TESTE adm"}, headers=A)
    check("Adm edita entry publicada (200)", r.status_code == 200, f"veio {r.status_code}")

    # ------------------------------------------------------------------
    secao("4) Lore (Masteries/Jutsus): Creator nao, Adm sim")
    jutsu = {"id": f"{SLUG}-j", "name": "TESTE Jutsu", "namePt": None, "masteryId": "fire", "pathId": None, "tier": 1,
             "chakraCost": 1, "description": "d", "longDescription": "l", "descriptionPt": None, "longDescriptionPt": None,
             "effect": "e", "range": "r", "castTime": "c", "cooldown": "c", "icon": "flame", "gif": None}
    r = await c.post("/jutsus", json=jutsu, headers=C)
    check("Creator NAO cria jutsu (403)", r.status_code == 403)
    r = await c.put("/masteries/fire", json={}, headers=C)
    check("Creator NAO edita mastery (403)", r.status_code == 403)
    r = await c.post("/jutsus", json=jutsu, headers=A)
    check("Adm cria jutsu (201)", r.status_code == 201, f"veio {r.status_code} {r.text[:120]}")
    r = await c.delete(f"/jutsus/{SLUG}-j", headers=C)
    check("Creator NAO apaga jutsu (403)", r.status_code == 403)
    r = await c.delete(f"/jutsus/{SLUG}-j", headers=A)
    check("Adm apaga jutsu (204)", r.status_code == 204)
    r = await c.post("/uploads/image", files={"file": ("x.png", b"nao e imagem", "image/png")}, headers=C)
    check("Creator passa da checagem de permissao do upload (415/400, nao 401/403)", r.status_code in (400, 415), f"veio {r.status_code}")

    # ------------------------------------------------------------------
    secao("5) Equipe: hierarquia (Adm so' mexe em Creator)")
    r = await c.get("/staff", headers=C)
    check("Creator NAO lista equipe (403)", r.status_code == 403)
    r = await c.get("/staff", headers=A)
    check("Adm lista equipe (200)", r.status_code == 200)
    r = await c.post("/staff", json={"discordId": str(BASE + 8), "role": "creator", "username": "TESTE_novo"}, headers=A)
    check("Adm cadastra Creator (201)", r.status_code == 201, f"veio {r.status_code} {r.text[:100]}")
    novo_id = r.json().get("id")
    r = await c.post("/staff", json={"discordId": str(BASE + 9), "role": "admin"}, headers=A)
    check("Adm NAO cadastra Adm (403)", r.status_code == 403)
    r = await c.post("/staff", json={"discordId": str(BASE + 9), "role": "super_admin"}, headers=A)
    check("Adm NAO cadastra S.Adm (403)", r.status_code == 403)
    r = await c.post("/staff", json={"discordId": str(BASE + 8), "role": "creator"}, headers=A)
    check("Discord ID repetido (409)", r.status_code == 409)
    r = await c.post("/staff", json={"discordId": "abc", "role": "creator"}, headers=A)
    check("Discord ID invalido (422)", r.status_code == 422)
    r = await c.post("/staff", json={"discordId": "123456789012345678", "role": "creator", "username": "x"}, headers=C)
    check("Creator NAO cadastra ninguem (403)", r.status_code == 403)
    r = await c.patch(f"/staff/{novo_id}/role", json={"role": "admin"}, headers=A)
    check("Adm NAO promove Creator a Adm (403)", r.status_code == 403)
    r = await c.patch(f"/staff/{adm2.id}/role", json={"role": "creator"}, headers=A)
    check("Adm NAO rebaixa outro Adm (403)", r.status_code == 403)
    r = await c.post(f"/staff/{adm2.id}/deactivate", headers=A)
    check("Adm NAO desativa outro Adm (403)", r.status_code == 403)
    r = await c.post(f"/staff/{sadm.id}/deactivate", headers=A)
    check("Adm NAO desativa S.Adm (403)", r.status_code == 403)
    r = await c.patch(f"/staff/{adm.id}/role", json={"role": "creator"}, headers=A)
    check("Ninguem altera a si mesmo (400)", r.status_code == 400)

    # ------------------------------------------------------------------
    secao("6) Desativar/promover derruba a sessao NA HORA")
    C2 = cookie(creator2)
    r = await c.get("/auth/me", headers=C2)
    check("Creator2 esta logado (200)", r.status_code == 200)
    r = await c.post(f"/staff/{creator2.id}/deactivate", headers=A)
    check("Adm desativa Creator (200)", r.status_code == 200)
    r = await c.get("/auth/me", headers=C2)
    check("sessao do desativado morre imediatamente (401)", r.status_code == 401)
    r = await c.post(f"/staff/{creator2.id}/activate", headers=A)
    check("Adm reativa Creator (200)", r.status_code == 200)
    r = await c.get("/auth/me", headers=C2)
    check("token ANTIGO continua invalido apos reativar (401)", r.status_code == 401)
    r = await c.get("/auth/me", headers=cookie(await recarregar(creator2)))
    check("login NOVO depois de reativar funciona (200)", r.status_code == 200)

    r = await c.patch(f"/staff/{creator.id}/role", json={"role": "admin"}, headers=S)
    check("S.Adm promove Creator a Adm (200)", r.status_code == 200)
    r = await c.get("/auth/me", headers=C)
    check("token antigo do promovido deixa de valer (401)", r.status_code == 401)
    C = cookie(await recarregar(creator))
    r = await c.get("/auth/me", headers=C)
    check("depois de novo login, cargo novo aparece (adm)", r.json().get("role") == "admin")
    r = await c.patch(f"/staff/{creator.id}/role", json={"role": "creator"}, headers=S)
    check("S.Adm devolve o cargo (200)", r.status_code == 200)
    C = cookie(await recarregar(creator))

    # ------------------------------------------------------------------
    secao("7) S.Adm e donos")
    r = await c.post("/staff", json={"discordId": str(BASE + 10), "role": "admin", "username": "TESTE_x"}, headers=S)
    check("S.Adm cadastra Adm (201)", r.status_code == 201)
    settings.super_admin_discord_ids = str(IDS["sadm"])
    r = await c.post("/staff", json={"discordId": str(BASE + 11), "role": "super_admin", "username": "TESTE_y"}, headers=S)
    check("S.Adm cadastra outro S.Adm (201)", r.status_code == 201)
    sadm2 = await criar_user("sadm2", StaffRole.SUPER_ADMIN)
    r = await c.patch(f"/staff/{sadm.id}/role", json={"role": "admin"}, headers=cookie(sadm2))
    check("DONO (.env) NAO pode ser rebaixado nem por outro S.Adm (403)", r.status_code == 403)
    r = await c.post(f"/staff/{sadm.id}/deactivate", headers=cookie(sadm2))
    check("DONO (.env) NAO pode ser desativado (403)", r.status_code == 403)
    settings.super_admin_discord_ids = ""
    r = await c.post(f"/staff/{sadm2.id}/deactivate", headers=S)
    check("S.Adm comum pode ser desativado por outro S.Adm (200)", r.status_code == 200)

    # ------------------------------------------------------------------
    secao("8) Permissao EXCLUSIVA do S.Adm fica invisivel (404) pros outros")
    app.add_api_route("/__teste_super_only", lambda: {"ok": True}, methods=["GET"],
                      dependencies=[__import__("fastapi").Depends(require_permission(Permission.AUDIT_VIEW_ALL))])
    r = await c.get("/__teste_super_only", headers=A)
    check("Adm em rota so' de S.Adm recebe 404 (nao 403)", r.status_code == 404)
    r = await c.get("/__teste_super_only", headers=C)
    check("Creator em rota so' de S.Adm recebe 404", r.status_code == 404)
    r = await c.get("/__teste_super_only", headers=S)
    check("S.Adm acessa (200)", r.status_code == 200)
    me_a = (await c.get("/auth/me", headers=A)).json()
    me_s = (await c.get("/auth/me", headers=S)).json()
    check("/auth/me do Adm NAO lista permissao exclusiva do S.Adm", "audit.view_all" not in me_a["permissions"])
    check("/auth/me do S.Adm lista a permissao exclusiva", "audit.view_all" in me_s["permissions"])
    check("Discord ID volta como TEXTO (sem perder digitos)", me_s["discordId"] == str(IDS["sadm"]))

    # ------------------------------------------------------------------
    secao("9) Log geral: quem, o que, de onde - e quem pode ver")
    r = await c.get("/audit-log", headers=C)
    check("Creator NAO ve o feed geral (403)", r.status_code == 403)
    r = await c.get(f"/audit-log?entityType=content_item&entityId={rasc_id}", headers=C)
    check("Creator ve o HISTORICO de uma entry (200)", r.status_code == 200 and len(r.json()) >= 2)
    r = await c.get("/audit-log?limit=200", headers=A)
    tipos_adm = {e["entityType"] for e in r.json()}
    # A lista vem do proprio sistema (CONTENT_ENTITY_TYPES) - assim o teste nao fica velho quando entra um tipo novo.
    check("Adm ve so' log de CONTEUDO", r.status_code == 200 and tipos_adm <= CONTENT_ENTITY_TYPES, str(tipos_adm))
    check("...e NUNCA login, equipe ou seguranca", not (tipos_adm & {"auth", "staff", "security"}), str(tipos_adm))
    check("IP some do log pro Adm", all(e["ipAddress"] is None for e in r.json()))
    r = await c.get("/audit-log?limit=200", headers=S)
    tipos_s = {e["entityType"] for e in r.json()}
    check("S.Adm ve tambem staff/security", {"staff", "security"} <= tipos_s, str(tipos_s))
    check("S.Adm ve o IP", any(e["ipAddress"] == "203.0.113.9" for e in r.json()))
    check("log guarda QUEM (nome e cargo)", any(e["actorName"] == "TESTE_adm" and e["actorRole"] == "admin" for e in r.json()))
    r = await c.get("/audit-log?entityType=security&limit=50", headers=S)
    check("tentativa negada ficou registrada (permission_denied)", any(e["action"] == "permission_denied" for e in r.json()))
    r = await c.get("/audit-log?entityType=staff&limit=50", headers=A)
    check("Adm nao enxerga log de equipe (vazio)", r.json() == [])

    # ------------------------------------------------------------------
    secao("10) Sessao: forjada, expirada, alg=none, CSRF")
    forjado = jwt.encode({"sub": str(sadm.id), "ver": 0, "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, "outra-chave-qualquer-com-32-caracteres!!", algorithm="HS256")
    r = await c.get("/auth/me", headers=cookie(sadm, forjado))
    check("token assinado com a chave errada (401)", r.status_code == 401)
    expirado = jwt.encode({"sub": str(sadm.id), "ver": 0, "exp": datetime.now(timezone.utc) - timedelta(seconds=5)}, settings.jwt_secret_key, algorithm="HS256")
    r = await c.get("/auth/me", headers=cookie(sadm, expirado))
    check("token expirado (401)", r.status_code == 401)
    sem_alg = jwt.encode({"sub": str(sadm.id), "ver": 0, "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, key=None, algorithm="none")
    r = await c.get("/auth/me", headers=cookie(sadm, sem_alg))
    check("token com alg=none (401)", r.status_code == 401)
    r = await c.get("/auth/me", headers=cookie(sadm, "lixo.qualquer.coisa"))
    check("token lixo (401)", r.status_code == 401)
    r = await c.get("/auth/me", headers=cookie(inativo))
    check("usuario desativado com token valido (401)", r.status_code == 401)
    r = await c.post("/content-items", json=novo_conteudo("csrf"), headers={**C, "Origin": "http://site-malicioso.example"})
    check("POST vindo de OUTRA origem e' barrado (403 CSRF)", r.status_code == 403)
    r = await c.post("/content-items", json=novo_conteudo("csrf-ok"), headers={**C, "Origin": settings.frontend_origin})
    check("POST da origem certa passa (201)", r.status_code == 201, f"veio {r.status_code}")

    # ------------------------------------------------------------------
    secao("11) API do Bot: mesmas regras do painel")
    settings.bot_api_token = ""
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['adm']}")
    check("sem BOT_API_TOKEN configurado a rota nem existe (404)", r.status_code == 404)
    settings.bot_api_token = "token-de-teste-do-bot"
    B = {"X-Bot-Token": settings.bot_api_token}
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['adm']}")
    check("sem header X-Bot-Token (401)", r.status_code == 401)
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['adm']}", headers={"X-Bot-Token": "errado"})
    check("token do bot errado (401)", r.status_code == 401)
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['adm']}", headers=B)
    check("bot + invoker Adm lista equipe (200)", r.status_code == 200)
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['creator']}", headers=B)
    check("bot + invoker Creator NAO lista (403)", r.status_code == 403)
    r = await c.get(f"/bot/staff?invokerDiscordId={BASE + 20}", headers=B)
    check("bot + invoker que nao e' da equipe (403)", r.status_code == 403)
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['inativo']}", headers=B)
    check("bot + invoker desativado (403)", r.status_code == 403)
    r = await c.post("/bot/staff", json={"invokerDiscordId": str(IDS["adm"]), "discordId": str(BASE + 12), "role": "creator", "username": "TESTE_bot"}, headers=B)
    check("bot cadastra Creator pelo Adm (201)", r.status_code == 201, f"veio {r.status_code} {r.text[:100]}")
    r = await c.post("/bot/staff", json={"invokerDiscordId": str(IDS["adm"]), "discordId": str(BASE + 13), "role": "admin"}, headers=B)
    check("bot NAO deixa Adm cadastrar Adm (403) - mesma regra do painel", r.status_code == 403)
    r = await c.post("/bot/staff", json={"invokerDiscordId": str(IDS["creator"]), "discordId": str(BASE + 13), "role": "creator"}, headers=B)
    check("bot NAO deixa Creator cadastrar ninguem (403)", r.status_code == 403)
    r = await c.post(f"/bot/staff/{BASE + 12}/deactivate", json={"invokerDiscordId": str(IDS["adm"])}, headers=B)
    check("bot desativa Creator (200)", r.status_code == 200 and r.json()["isActive"] is False)
    r = await c.post(f"/bot/staff/{IDS['sadm']}/deactivate", json={"invokerDiscordId": str(IDS["adm"])}, headers=B)
    check("bot NAO deixa Adm desativar S.Adm (403)", r.status_code == 403)
    r = await c.get("/audit-log?source=bot&limit=50", headers=S)
    check("acoes do bot ficam marcadas source=bot no log", len(r.json()) >= 2 and all(e["source"] == "bot" for e in r.json()))

    # ------------------------------------------------------------------
    secao("12) Login do Discord (Discord simulado)")
    settings.discord_client_id, settings.discord_client_secret = "id-teste", "segredo-teste"
    r = await c.get("/auth/discord/login")
    loc = r.headers.get("location", "")
    check("login redireciona pro Discord com state", r.status_code == 302 and "discord.com/oauth2/authorize" in loc and "state=" in loc)
    state = loc.split("state=")[1].split("&")[0]
    sc = r.headers.get("set-cookie", "").lower()
    check("cookie de state e' httpOnly + SameSite=Lax", "httponly" in sc and "samesite=lax" in sc)
    perfil = {"id": IDS["creator"], "username": "Nome Real No Discord", "avatar_url": "https://cdn.discordapp.com/avatars/1/x.png"}
    with patch("app.core.discord.exchange_code", return_value="tok"), patch("app.core.discord.fetch_profile", return_value=perfil):
        r = await c.get(f"/auth/discord/callback?code=abc&state={state}", headers={"Cookie": f"{STATE_COOKIE}={state}"})
        check("callback com state certo + staff cadastrada: entra (302 -> /admin)", r.status_code == 302 and r.headers["location"].endswith("/admin"), r.headers.get("location", ""))
        sc = r.headers.get("set-cookie", "").lower()
        check("cookie de sessao criado httpOnly + SameSite=Lax", SESSION_COOKIE in sc and "httponly" in sc and "samesite=lax" in sc)
        r = await c.get(f"/auth/discord/callback?code=abc&state=OUTRO", headers={"Cookie": f"{STATE_COOKIE}={state}"})
        check("state diferente do cookie e' recusado (invalid_state)", "error=invalid_state" in r.headers["location"])
        r = await c.get("/auth/discord/callback?code=abc&state=x")
        check("callback sem cookie de state e' recusado", "error=invalid_state" in r.headers["location"])
        r = await c.get("/auth/discord/callback?error=access_denied&state=x")
        check("usuario cancelou no Discord (discord_denied)", "error=discord_denied" in r.headers["location"])
    perfil_estranho = {"id": BASE + 21, "username": "Qualquer Pessoa", "avatar_url": None}
    with patch("app.core.discord.exchange_code", return_value="tok"), patch("app.core.discord.fetch_profile", return_value=perfil_estranho):
        r = await c.get(f"/auth/discord/callback?code=abc&state={state}", headers={"Cookie": f"{STATE_COOKIE}={state}"})
        check("conta do Discord que NAO e' da equipe nao entra (not_staff)", "error=not_staff" in r.headers["location"] and SESSION_COOKIE not in r.headers.get("set-cookie", ""))
    perfil_inativo = {"id": IDS["inativo"], "username": "Inativo", "avatar_url": None}
    with patch("app.core.discord.exchange_code", return_value="tok"), patch("app.core.discord.fetch_profile", return_value=perfil_inativo):
        r = await c.get(f"/auth/discord/callback?code=abc&state={state}", headers={"Cookie": f"{STATE_COOKIE}={state}"})
        check("staff desativada nao entra (inactive)", "error=inactive" in r.headers["location"])
    settings.super_admin_discord_ids = str(BASE + 22)
    dono = {"id": BASE + 22, "username": "Dono Novo", "avatar_url": None}
    with patch("app.core.discord.exchange_code", return_value="tok"), patch("app.core.discord.fetch_profile", return_value=dono):
        r = await c.get(f"/auth/discord/callback?code=abc&state={state}", headers={"Cookie": f"{STATE_COOKIE}={state}"})
        check("DONO do .env entra e vira S.Adm sozinho (bootstrap)", r.status_code == 302 and r.headers["location"].endswith("/admin"))
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.discord_id == BASE + 22))).scalar_one_or_none()
    check("dono foi criado como S.Adm ativo", u is not None and u.role == StaffRole.SUPER_ADMIN and u.is_active)
    settings.super_admin_discord_ids = ""
    settings.discord_client_id = settings.discord_client_secret = ""
    r = await c.get("/auth/discord/login")
    check("sem credenciais do Discord: volta pro login com aviso", "error=discord_not_configured" in r.headers["location"])

    # ------------------------------------------------------------------
    secao("13) Login de desenvolvimento e configuracao segura")
    settings.dev_login_enabled = False
    r = await c.post("/auth/dev-login", json={"discordId": str(IDS["adm"])})
    check("dev-login DESLIGADO por padrao (404)", r.status_code == 404)
    settings.dev_login_enabled = True
    r = await c.post("/auth/dev-login", json={"discordId": str(IDS["adm"])})
    check("dev-login ligado: staff cadastrada entra (200 + cookie)", r.status_code == 200 and SESSION_COOKIE in r.headers.get("set-cookie", ""))
    r = await c.post("/auth/dev-login", json={"discordId": str(BASE + 23)})
    check("dev-login de ID nao cadastrado (403)", r.status_code == 403)
    r = await c.post("/auth/dev-login", json={"discordId": str(IDS["adm"])}, headers={"Origin": "http://evil.example"})
    check("dev-login vindo de outra origem (403)", r.status_code == 403)
    settings.dev_login_enabled = False
    base_env = dict(database_url="postgresql+asyncpg://x:y@localhost/db", jwt_secret_key="k" * 40)
    try:
        Settings(environment="production", dev_login_enabled=True, **base_env)
        check("aplicacao RECUSA iniciar com dev-login em producao", False)
    except ValueError:
        check("aplicacao RECUSA iniciar com dev-login em producao", True)
    try:
        Settings(environment="production", jwt_secret_key="curta", database_url=base_env["database_url"])
        check("aplicacao RECUSA iniciar em producao com JWT_SECRET_KEY fraca", False)
    except ValueError:
        check("aplicacao RECUSA iniciar em producao com JWT_SECRET_KEY fraca", True)
    try:
        Settings(environment="development", super_admin_discord_ids="123,abc", **base_env)
        check("SUPER_ADMIN_DISCORD_IDS invalido e' recusado", False)
    except ValueError:
        check("SUPER_ADMIN_DISCORD_IDS invalido e' recusado", True)

    secao("14a) Vilas, Clas e Organizacoes: edicao pelo painel (Lore)")
    c.cookies.clear()  # o cliente guarda cookies das secoes anteriores (login dev/Discord) - aqui o 'anonimo' precisa ser anonimo de verdade
    vid = f"{SLUG}-vila"
    def vila(**extra) -> dict:
        base = {"id": vid, "name": "TESTE Village", "namePt": "TESTE Vila", "element": "Fire", "motto": "lema", "description": "d",
                "longDescription": "texto", "emblem": "🔥", "image": None, "accentColor": "#112233", "climate": "quente",
                "leader": "Alguem", "mapX": 10, "mapY": 20,
                "clans": [{"id": f"{SLUG}-cla-a", "name": "Clan A", "levelRequirement": 5, "priceRyo": 100, "description": "a"},
                          {"id": f"{SLUG}-cla-b", "name": "Clan B", "levelRequirement": 6, "priceRyo": 200, "description": "b"}]}
        return {**base, **extra}
    r = await c.post("/villages", json=vila())
    check("anonimo NAO cria vila (401)", r.status_code == 401)
    r = await c.post("/villages", json=vila(), headers=C)
    check("Creator NAO cria vila (403)", r.status_code == 403)
    r = await c.post("/villages", json=vila(), headers=A)
    check("Adm cria vila com 2 clas (201)", r.status_code == 201 and len(r.json()["clans"]) == 2, r.text[:150])
    check("nome em ingles + traducao salvos", r.json()["name"] == "TESTE Village" and r.json()["namePt"] == "TESTE Vila")
    r = await c.post("/villages", json=vila(), headers=A)
    check("id repetido (409)", r.status_code == 409)
    for nome, extra in [("cor invalida (so' hex)", {"accentColor": "red"}), ("id de vila fora do formato slug", {"id": "Vila Ruim"}),
                        ("longDescription com <script", {"longDescription": "<script>alert(1)</script>"}),
                        ("mapX fora de 0-100", {"mapX": 500}),
                        ("dois clas com o mesmo id", {"clans": [{"id": "x-1", "name": "a", "levelRequirement": 1, "priceRyo": 1}, {"id": "x-1", "name": "b", "levelRequirement": 1, "priceRyo": 1}]}),
                        ("clan com preco negativo", {"clans": [{"id": "x-2", "name": "a", "levelRequirement": 1, "priceRyo": -5}]})]:
        r = await c.post("/villages", json=vila(**({"id": f"{SLUG}-v2"} | extra)), headers=A)
        check(f"validacao: {nome} (422)", r.status_code == 422, f"veio {r.status_code}")
    r = await c.put(f"/villages/{vid}", json=vila(name="TESTE Village 2", clans=[
        {"id": f"{SLUG}-cla-a", "name": "Clan A editado", "levelRequirement": 7, "priceRyo": 150, "description": "a"},
        {"id": f"{SLUG}-cla-c", "name": "Clan C", "levelRequirement": 1, "priceRyo": 1, "description": "c"}]), headers=C)
    check("Creator NAO edita vila (403)", r.status_code == 403)
    r = await c.put(f"/villages/{vid}", json=vila(name="TESTE Village 2", clans=[
        {"id": f"{SLUG}-cla-a", "name": "Clan A editado", "levelRequirement": 7, "priceRyo": 150, "description": "a"},
        {"id": f"{SLUG}-cla-c", "name": "Clan C", "levelRequirement": 1, "priceRyo": 1, "description": "c"}]), headers=A)
    nomes = {cl["id"].rsplit("-", 1)[1]: cl["name"] for cl in r.json().get("clans", [])}
    check("Adm edita a vila (200)", r.status_code == 200 and r.json()["name"] == "TESTE Village 2", r.text[:150])
    check("clas sincronizados: A editado, B removido, C novo", nomes == {"a": "Clan A editado", "c": "Clan C"}, str(nomes))
    r = await c.put(f"/villages/{vid}", json=vila(id=f"{SLUG}-outra"), headers=A)
    check("id da vila nao pode ser alterado (400)", r.status_code == 400)
    r = await c.put(f"/villages/{SLUG}-nao-existe", json=vila(id=f"{SLUG}-nao-existe"), headers=A)
    check("editar vila inexistente (404)", r.status_code == 404)
    r = await c.post("/villages", json=vila(id=f"{SLUG}-v3", clans=[{"id": f"{SLUG}-cla-a", "name": "roubado", "levelRequirement": 1, "priceRyo": 1}]), headers=A)
    check("clan que ja' pertence a OUTRA vila e' recusado (409)", r.status_code == 409)
    check("...e essa vila nao ficou criada pela metade", (await c.get(f"/villages/{SLUG}-v3")).status_code == 404)

    oid = f"{SLUG}-org"
    org = {"id": oid, "name": "TESTE Org", "description": "d", "villageIds": [vid]}
    r = await c.post("/organizations", json=org, headers=C)
    check("Creator NAO cria organizacao (403)", r.status_code == 403)
    r = await c.post("/organizations", json=org, headers=A)
    check("Adm cria organizacao ligada a' vila (201)", r.status_code == 201 and r.json()["villageIds"] == [vid], r.text[:150])
    r = await c.post("/organizations", json={**org, "id": f"{SLUG}-org2", "villageIds": ["vila-que-nao-existe"]}, headers=A)
    check("organizacao com vila inexistente (400)", r.status_code == 400)
    r = await c.get("/organizations")
    check("GET /organizations e' publico e traz villageIds", r.status_code == 200 and any(o["id"] == oid and o["villageIds"] == [vid] for o in r.json()))
    r = await c.get(f"/villages/{vid}")
    check("a vila mostra a organizacao ligada", any(o["id"] == oid for o in r.json()["organizations"]))
    r = await c.put(f"/organizations/{oid}", json={**org, "villageIds": []}, headers=A)
    check("Adm desliga a organizacao da vila (200)", r.status_code == 200 and r.json()["villageIds"] == [])
    r = await c.get(f"/villages/{vid}")
    check("...e a vila deixa de mostrar a organizacao", all(o["id"] != oid for o in r.json()["organizations"]))
    r = await c.put(f"/organizations/{oid}", json={**org, "villageIds": [vid]}, headers=A)
    r = await c.delete(f"/organizations/{oid}", headers=C)
    check("Creator NAO apaga organizacao (403)", r.status_code == 403)
    r = await c.delete(f"/organizations/{oid}", headers=A)
    check("Adm apaga organizacao (204)", r.status_code == 204)
    r = await c.delete(f"/villages/{vid}", headers=C)
    check("Creator NAO apaga vila (403)", r.status_code == 403)
    r = await c.delete(f"/villages/{vid}", headers=A)
    check("Adm apaga vila (204)", r.status_code == 204)
    async with AsyncSessionLocal() as db:
        sobrou = (await db.execute(text("SELECT count(*) FROM clans WHERE id LIKE :p"), {"p": f"{SLUG}%"})).scalar_one()
    check("os clas foram apagados junto com a vila", sobrou == 0, f"sobraram {sobrou}")
    r = await c.get("/audit-log?limit=200", headers=A)
    tipos = {(e["entityType"], e["action"]) for e in r.json()}
    check("criar/editar/apagar vila e organizacao ficam no log do Adm",
          {("village", "create"), ("village", "update"), ("village", "delete"), ("organization", "create"), ("organization", "delete")} <= tipos, str(tipos))

    secao("14b) Blog (posts): mesma regra de Conteudo")
    c.cookies.clear()
    def post(**extra) -> dict:
        return {"slug": f"{SLUG}-post", "title": "TESTE post", "excerpt": "resumo", "content": "texto do post", "coverImage": None,
                "status": "draft"} | extra
    r = await c.post("/posts", json=post())
    check("anonimo NAO cria post (401)", r.status_code == 401)
    r = await c.post("/posts", json=post(), headers=C)
    check("Creator cria post em rascunho (201)", r.status_code == 201, r.text[:150])
    pid = r.json().get("id")
    nome_atual = (await recarregar(creator)).username  # o login do Discord (secao 12) renomeou o Creator
    check("o autor do post e' quem criou", r.json().get("authorName") == nome_atual, f"{r.json().get('authorName')} != {nome_atual}")
    r = await c.post("/posts", json=post(slug=f"{SLUG}-post-pub", status="published"), headers=C)
    check("Creator NAO cria post ja' publicado (403)", r.status_code == 403)
    r = await c.post("/posts", json=post(), headers=A)
    check("slug repetido (409)", r.status_code == 409)
    for nome, extra in [("slug fora do formato", {"slug": "Post Ruim"}), ("titulo vazio", {"title": ""}),
                        ("conteudo com <script", {"content": "<script>alert(1)</script>"}),
                        ("status inventado", {"status": "arquivado"})]:
        r = await c.post("/posts", json=post(**({"slug": f"{SLUG}-x"} | extra)), headers=A)
        check(f"validacao: {nome} (422)", r.status_code == 422, f"veio {r.status_code}")
    r = await c.get(f"/posts/{pid}")
    check("anonimo NAO ve rascunho por id (404)", r.status_code == 404)
    r = await c.get(f"/posts/slug/{SLUG}-post")
    check("anonimo NAO ve rascunho por slug (404)", r.status_code == 404)
    r = await c.get("/posts")
    check("lista anonima nao traz rascunho", all(p["slug"] != f"{SLUG}-post" for p in r.json()))
    r = await c.get("/posts", headers=C)
    check("lista da equipe traz o rascunho", any(p["slug"] == f"{SLUG}-post" for p in r.json()))
    r = await c.put(f"/posts/{pid}", json=post(title="TESTE editado"), headers=C)
    check("Creator edita o proprio rascunho (200)", r.status_code == 200 and r.json()["title"] == "TESTE editado", r.text[:120])
    r = await c.put(f"/posts/{pid}", json=post(status="published"), headers=C)
    check("Creator NAO publica editando (403)", r.status_code == 403)
    r = await c.put(f"/posts/{pid}", json=post(status="published", title="TESTE publicado"), headers=A)
    check("Adm publica (200)", r.status_code == 200 and r.json()["status"] == "published", r.text[:120])
    r = await c.get(f"/posts/slug/{SLUG}-post")
    check("anonimo agora ve o post publicado por slug (200)", r.status_code == 200 and r.json()["title"] == "TESTE publicado")
    r = await c.get("/posts")
    check("lista anonima agora traz o post", any(p["slug"] == f"{SLUG}-post" for p in r.json()))
    r = await c.put(f"/posts/{pid}", json=post(title="TESTE creator mexeu"), headers=C)
    check("Creator NAO edita post ja' publicado (403)", r.status_code == 403)
    r = await c.delete(f"/posts/{pid}", headers=C)
    check("Creator NAO apaga post (403)", r.status_code == 403)
    r = await c.put(f"/posts/{pid}", json=post(status="draft", title="TESTE voltou"), headers=A)
    r2 = await c.get(f"/posts/{pid}")
    check("Adm tira do ar (volta pra rascunho) e o publico deixa de ver", r.status_code == 200 and r2.status_code == 404)
    r = await c.get("/audit-log?limit=200", headers=A)
    acoes = {e["action"] for e in r.json() if e["entityType"] == "post"}
    check("criar/editar post ficam no log do Adm", {"create", "update"} <= acoes, str(acoes))
    r = await c.delete(f"/posts/{pid}", headers=A)
    check("Adm apaga o post (204)", r.status_code == 204)
    r = await c.get(f"/posts/{pid}", headers=A)
    check("post apagado some (404)", r.status_code == 404)

    secao("15) Limite de tentativas (rate limit)")
    class Relogio:
        def __init__(self) -> None:
            self.t = 1000.0
        def __call__(self) -> float:
            return self.t
    relogio = Relogio()
    limiter._time = relogio
    try:
        # -- o limitador em si (janela deslizante) --
        check("permite ate' o limite", all(limiter.hit("x", "a", 3, 60) is None for _ in range(3)))
        espera = limiter.hit("x", "a", 3, 60)
        check("passou do limite: bloqueia e diz quantos segundos esperar", isinstance(espera, int) and 1 <= espera <= 61, str(espera))
        check("outro IP nao e' afetado", limiter.hit("x", "b", 3, 60) is None)
        relogio.t += 61
        check("depois da janela volta a permitir", limiter.hit("x", "a", 3, 60) is None)
        for _ in range(5):
            limiter.fail("f", "a", 900)
        check("falhas demais bloqueiam (consulta nao registra nada)", limiter.blocked("f", "a", 5, 900) is not None and limiter.blocked("f", "b", 5, 900) is None)
        relogio.t += 901
        check("a janela de falhas anda e libera", limiter.blocked("f", "a", 5, 900) is None)
        limiter.reset()

        def cliente(ip: str) -> httpx.AsyncClient:
            return httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=(ip, 1234)), base_url="http://test")

        async def denied_rows() -> int:
            async with AsyncSessionLocal() as db:
                return (await db.execute(text("SELECT count(*) FROM audit_log WHERE action='login_denied' AND entity_id = :i"), {"i": str(BASE + 24)})).scalar_one()

        # -- callback do Discord: quem erra demais nem chega no Discord nem no log --
        settings.discord_client_id, settings.discord_client_secret = "id-teste", "segredo-teste"
        estranho = {"id": BASE + 24, "username": "Qualquer", "avatar_url": None}
        hdr = {"Cookie": f"{STATE_COOKIE}=s"}
        with patch("app.core.discord.exchange_code", return_value="tok") as troca, patch("app.core.discord.fetch_profile", return_value=estranho):
            async with cliente("198.51.100.10") as x:
                destinos = [(await x.get("/auth/discord/callback?code=abc&state=s", headers=hdr)).headers["location"] for _ in range(6)]
                check("as 5 primeiras tentativas negadas passam pelo fluxo normal (not_staff)", all("error=not_staff" in d for d in destinos[:5]), str(destinos[:5]))
                check("a 6a e' BLOQUEADA (rate_limited)", "error=rate_limited" in destinos[5], destinos[5])
                check("...sem ter chamado o Discord de novo", troca.call_count == 5, f"chamou {troca.call_count}x")
                check("...e sem gravar mais uma linha no log (so' 5 negacoes registradas)", await denied_rows() == 5, str(await denied_rows()))
                r = await x.get("/auth/discord/callback?code=abc&state=s", headers=hdr)
                check("continua bloqueado nas tentativas seguintes", "error=rate_limited" in r.headers["location"])
            async with cliente("198.51.100.11") as y:
                r = await y.get("/auth/discord/callback?code=abc&state=s", headers=hdr)
                check("OUTRO IP nao e' afetado pelo bloqueio", "error=not_staff" in r.headers["location"], r.headers["location"])
            relogio.t += 16 * 60
            async with cliente("198.51.100.10") as x:
                r = await x.get("/auth/discord/callback?code=abc&state=s", headers=hdr)
                check("passada a janela (15 min) o IP e' liberado de novo", "error=not_staff" in r.headers["location"], r.headers["location"])
        limiter.reset()

        # -- state forjado tambem conta como falha --
        async with cliente("198.51.100.20") as x:
            destinos = [(await x.get("/auth/discord/callback?code=abc&state=forjado", headers=hdr)).headers["location"] for _ in range(6)]
            check("state forjado repetido tambem e' bloqueado", "error=invalid_state" in destinos[0] and "error=rate_limited" in destinos[5], str(destinos))
        limiter.reset()

        # -- limite de chamadas por minuto no inicio do login --
        async with cliente("198.51.100.12") as x:
            destinos = [(await x.get("/auth/discord/login")).headers["location"] for _ in range(35)]
            check("ate' 30 chamadas por minuto passam", all("discord.com" in d for d in destinos[:30]))
            check("acima disso: rate_limited", all("error=rate_limited" in d for d in destinos[30:]), str(destinos[30:32]))
            relogio.t += 61
            r = await x.get("/auth/discord/login")
            check("depois de 1 minuto libera", "discord.com" in r.headers["location"])
        limiter.reset()

        # -- login de desenvolvimento: tentativa de adivinhar Discord ID --
        settings.dev_login_enabled = True
        async with cliente("198.51.100.13") as x:
            codigos = [(await x.post("/auth/dev-login", json={"discordId": str(BASE + 25 + i)})).status_code for i in range(6)]
            check("dev-login: 5 IDs desconhecidos dao 403 e o 6o ja' e' 429", codigos[:5] == [403] * 5 and codigos[5] == 429, str(codigos))
            r = await x.post("/auth/dev-login", json={"discordId": str(IDS["adm"])})
            check("...e enquanto bloqueado nem um ID VALIDO entra (429 com Retry-After)", r.status_code == 429 and r.headers.get("retry-after", "").isdigit() and "Muitas tentativas" in r.json()["detail"], f"{r.status_code} {r.headers.get('retry-after')}")
        async with cliente("198.51.100.14") as y:
            r = await y.post("/auth/dev-login", json={"discordId": str(IDS["adm"])})
            check("outro IP entra normalmente", r.status_code == 200)
        settings.dev_login_enabled = False
        limiter.reset()

        # -- token do bot: forca bruta --
        settings.bot_api_token = "token-de-teste-do-bot-1234567890"
        certo = {"X-Bot-Token": settings.bot_api_token}
        consulta = f"/bot/staff?invokerDiscordId={IDS['adm']}"
        async with cliente("198.51.100.15") as x:
            codigos = [(await x.get(consulta, headers={"X-Bot-Token": f"chute-{i}"})).status_code for i in range(10)]
            check("bot: 10 tokens errados dao 401", codigos == [401] * 10, str(codigos))
            r = await x.get(consulta, headers={"X-Bot-Token": "mais-um-chute"})
            check("o 11o ja' e' 429 (bloqueado)", r.status_code == 429 and "Muitas tentativas" in r.json()["detail"], f"{r.status_code}")
            r = await x.get(consulta, headers=certo)
            check("...e enquanto bloqueado nem o token CERTO passa (429)", r.status_code == 429)
            relogio.t += 11 * 60
            r = await x.get(consulta, headers=certo)
            check("passada a janela (10 min) o token certo volta a funcionar", r.status_code == 200, f"{r.status_code}")
        async with cliente("198.51.100.16") as y:
            r = await y.get(consulta, headers=certo)
            check("o bot em OUTRO IP nunca e' afetado", r.status_code == 200)
        settings.bot_api_token = ""
        settings.discord_client_id = settings.discord_client_secret = ""
    finally:
        limiter._time = time.monotonic
        limiter.reset()

    secao("14) NENHUMA rota escapa: tudo que nao e' publico de proposito exige login")
    sem_protecao = []
    total = 0
    for route in todas_as_rotas():
        if route.path.startswith("/__teste") or route.path in ("/docs", "/redoc", "/openapi.json"):
            continue
        for metodo in route.methods - {"HEAD", "OPTIONS"}:
            total += 1
            if (metodo, route.path) in ROTAS_PUBLICAS or rota_exige_login(route):
                continue
            sem_protecao.append(f"{metodo} {route.path}")
    check(f"o verificador enxergou as rotas da API ({total}; minimo esperado 30)", total >= 30,
          "poucas rotas encontradas - o verificador nao esta percorrendo tudo")
    check(f"as {total} rotas da API estao protegidas ou na lista de publicas", not sem_protecao,
          "SEM PROTECAO: " + ", ".join(sem_protecao) + " -> proteja com require_permission(...) ou, se for publica de proposito, adicione em ROTAS_PUBLICAS")

    r = await c.post("/auth/logout", headers=cookie(adm))
    check("logout funciona e limpa o cookie", r.status_code == 200 and "max-age=0" in r.headers.get("set-cookie", "").lower())


if __name__ == "__main__":
    t0 = time.time()
    print("Teste de permissoes - Fase 2")
    asyncio.run(main())
    print("\n" + "=" * 62)
    print(f" {PASS} verificacoes OK, {FAIL} falharam  ({time.time() - t0:.1f}s)")
    if FAIL:
        print(" FALHARAM:")
        for f in FALHAS:
            print("   -", f)
        sys.exit(1)
    print(" TUDO CERTO - permissoes e sessoes funcionando como esperado.")
