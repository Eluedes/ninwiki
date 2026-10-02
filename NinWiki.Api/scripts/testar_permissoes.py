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
import json
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
    """Registra e imprime o resultado de uma verificacao."""
    global PASS, FAIL
    if condicao:
        PASS += 1
        print(f"  [OK]   {nome}")
    else:
        FAIL += 1
        FALHAS.append(nome)
        print(f"  [FALHOU] {nome} {('-> ' + detalhe) if detalhe else ''}")


def secao(titulo: str) -> None:
    """Imprime o titulo de uma secao e zera o limite de tentativas."""
    limiter.reset()  # cada secao comeca com o limite de tentativas zerado
    print(f"\n== {titulo}")


BASE = random.randint(10**17, 9 * 10**17)  # IDs de teste no formato de um Discord ID real (18 digitos)
IDS = {"sadm": BASE + 1, "sadm2": BASE + 2, "adm": BASE + 3, "adm2": BASE + 4, "creator": BASE + 5, "creator2": BASE + 6, "inativo": BASE + 7}
TESTE_IDS_TEXTO = [str(v) for v in IDS.values()] + [str(BASE + n) for n in range(8, 30)]
SLUG = f"teste-perm-{BASE % 100000}"


def cookie(user: User, token: str | None = None) -> dict:
    """Cabecalho Cookie de sessao valida (ou do token informado) para o usuario."""
    return {"Cookie": f"{SESSION_COOKIE}={token or create_session_token(user)}"}


async def criar_user(chave: str, role: StaffRole, ativo: bool = True) -> User:
    """Cria um usuario de teste com o cargo informado."""
    async with AsyncSessionLocal() as db:
        u = User(discord_id=IDS[chave], username=f"TESTE_{chave}", role=role, is_active=ativo)
        db.add(u)
        await db.commit()
        await db.refresh(u)
        return u


async def recarregar(u: User) -> User:
    """Recarrega o usuario do banco (para pegar a nova versao de sessao)."""
    async with AsyncSessionLocal() as db:
        return await db.get(User, u.id)


def novo_conteudo(sufixo: str, status: str = "draft") -> dict:
    """Corpo valido para criar uma entry de teste."""
    return {"slug": f"{SLUG}-{sufixo}", "category": "guides", "name": f"TESTE {sufixo}", "level": 1,
            "icon": "📘", "rarity": "common", "description": "texto de teste", "status": status}



# Leituras (GET) que sao PUBLICAS de proposito - o site publico precisa delas.
# Qualquer OUTRA rota que nao esteja aqui tem que exigir login. Ao criar uma
# rota publica nova, adicione o caminho aqui (e' uma decisao consciente).
ROTAS_PUBLICAS = {
    ("GET", "/health"), ("GET", "/health/ready"), ("GET", "/auth/config"), ("GET", "/auth/discord/login"), ("GET", "/auth/discord/callback"),
    ("GET", "/content-items"), ("GET", "/content-items/{item_id}"), ("GET", "/content-items/slug/{slug}"),
    ("GET", "/attributes"), ("GET", "/masteries"), ("GET", "/masteries/{mastery_id}"),
    ("GET", "/jutsus"), ("GET", "/jutsus/{jutsu_id}"),
    ("GET", "/villages"), ("GET", "/villages/{village_id}"), ("GET", "/organizations"),
    ("GET", "/posts"), ("GET", "/posts/{post_id}"), ("GET", "/posts/slug/{slug}"),
    ("GET", "/tags"),
    # engajamento: leitura publica; escrita exige LEITOR logado (cookie proprio, ver reader_auth.py)
    ("GET", "/posts/{slug}/engagement"), ("GET", "/posts/{slug}/comments"),
    ("PUT", "/posts/{slug}/like"), ("DELETE", "/posts/{slug}/like"),
    ("POST", "/posts/{slug}/comments"), ("DELETE", "/posts/{slug}/comments/{comment_id}"),
    ("GET", "/auth/reader/me"), ("POST", "/auth/reader/logout"), ("POST", "/auth/reader/dev-login"),
    ("GET", "/professions"), ("GET", "/ninja-ranks"), ("GET", "/story-arcs"), ("GET", "/summons"),
    # escrita "publica" de proposito: cada uma tem a sua propria protecao
    ("POST", "/auth/dev-login"),   # so' funciona em development + confere a origem
    ("POST", "/auth/logout"),      # sem sessao so' limpa o cookie
    ("POST", "/client-errors"),    # o navegador do visitante avisa que o site quebrou (origem + limite por IP + teto por hora)
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
    """Percorre as dependencias de uma rota (para achar a checagem de login)."""
    achadas = []
    for dep in dependant.dependencies:
        achadas.append(dep.call)
        achadas.extend(_chamadas_da_rota(dep))
    return achadas


def rota_exige_login(route: APIRoute) -> bool:
    """True se a rota exige login ou token do bot."""
    for call in _chamadas_da_rota(route.dependant):
        nome = getattr(call, "__qualname__", "")
        if call is get_current_user or nome.startswith("require_permission") or nome == "require_bot":
            return True
    return False


async def main() -> None:
    """Roda todos os testes de permissao e apaga os dados de teste no final."""
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
            from app.core import role_config
            role_config.invalidate()


async def limpar(inicio: datetime) -> None:
    """Apaga do banco tudo que o teste criou."""
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM content_items WHERE slug LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM jutsus WHERE id LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM posts WHERE slug LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM tags WHERE id LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM readers WHERE discord_id BETWEEN :a AND :b"), {"a": BASE + 30, "b": BASE + 40})
        await db.execute(text("DELETE FROM organizations WHERE id LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM villages WHERE id LIKE :p"), {"p": f"{SLUG}%"})
        await db.execute(text("DELETE FROM notices WHERE title LIKE :p"), {"p": f"{SLUG}%"})
        # problemas registrados DURANTE este teste (rotas __teste, falhas simuladas da DeepL, flood, site)
        await db.execute(text("DELETE FROM error_events WHERE first_seen >= :t"), {"t": inicio})
        await db.execute(text("DELETE FROM role_permissions"))
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
    """Todas as secoes de teste: login, cargos, permissoes, blog, vilas, avisos, endurecimento..."""
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
    secao("5) Equipe: so' o S.Adm (Adm e Creator recebem 404, como se a parte Equipe nao existisse)")
    r = await c.get("/staff", headers=C)
    check("Creator NAO lista equipe (404)", r.status_code == 404)
    r = await c.get("/staff", headers=A)
    check("Adm NAO lista equipe (404)", r.status_code == 404)
    r = await c.post("/staff", json={"discordId": str(BASE + 8), "role": "creator", "username": "TESTE_novo"}, headers=A)
    check("Adm NAO cadastra Creator (404)", r.status_code == 404)
    r = await c.post("/staff", json={"discordId": "123456789012345678", "role": "creator", "username": "x"}, headers=C)
    check("Creator NAO cadastra ninguem (404)", r.status_code == 404)
    r = await c.get("/staff", headers=S)
    check("S.Adm lista equipe (200)", r.status_code == 200)
    r = await c.post("/staff", json={"discordId": str(BASE + 8), "role": "creator", "username": "TESTE_novo"}, headers=S)
    check("S.Adm cadastra Creator (201)", r.status_code == 201, f"veio {r.status_code} {r.text[:100]}")
    novo_id = r.json().get("id")
    r = await c.post("/staff", json={"discordId": str(BASE + 8), "role": "creator"}, headers=S)
    check("Discord ID repetido (409)", r.status_code == 409)
    r = await c.post("/staff", json={"discordId": "abc", "role": "creator"}, headers=S)
    check("Discord ID invalido (422)", r.status_code == 422)
    r = await c.patch(f"/staff/{novo_id}/role", json={"role": "admin"}, headers=A)
    check("Adm NAO promove ninguem (404)", r.status_code == 404)
    r = await c.post(f"/staff/{adm2.id}/deactivate", headers=A)
    check("Adm NAO desativa outro Adm (404)", r.status_code == 404)
    r = await c.post(f"/staff/{sadm.id}/deactivate", headers=A)
    check("Adm NAO desativa S.Adm (404)", r.status_code == 404)
    r = await c.patch(f"/staff/{sadm.id}/role", json={"role": "creator"}, headers=S)
    check("Ninguem altera a si mesmo (400)", r.status_code == 400)

    # ------------------------------------------------------------------
    secao("6) Desativar/promover derruba a sessao NA HORA")
    C2 = cookie(creator2)
    r = await c.get("/auth/me", headers=C2)
    check("Creator2 esta logado (200)", r.status_code == 200)
    r = await c.post(f"/staff/{creator2.id}/deactivate", headers=S)
    check("S.Adm desativa Creator (200)", r.status_code == 200)
    r = await c.get("/auth/me", headers=C2)
    check("sessao do desativado morre imediatamente (401)", r.status_code == 401)
    r = await c.post(f"/staff/{creator2.id}/activate", headers=S)
    check("S.Adm reativa Creator (200)", r.status_code == 200)
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
    check("bot + invoker Adm NAO lista equipe (403) - Equipe e' so' do S.Adm", r.status_code == 403)
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['sadm']}", headers=B)
    check("bot + invoker S.Adm lista equipe (200)", r.status_code == 200)
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['creator']}", headers=B)
    check("bot + invoker Creator NAO lista (403)", r.status_code == 403)
    r = await c.get(f"/bot/staff?invokerDiscordId={BASE + 20}", headers=B)
    check("bot + invoker que nao e' da equipe (403)", r.status_code == 403)
    r = await c.get(f"/bot/staff?invokerDiscordId={IDS['inativo']}", headers=B)
    check("bot + invoker desativado (403)", r.status_code == 403)
    r = await c.post("/bot/staff", json={"invokerDiscordId": str(IDS["sadm"]), "discordId": str(BASE + 12), "role": "creator", "username": "TESTE_bot"}, headers=B)
    check("bot cadastra Creator pelo S.Adm (201)", r.status_code == 201, f"veio {r.status_code} {r.text[:100]}")
    r = await c.post("/bot/staff", json={"invokerDiscordId": str(IDS["adm"]), "discordId": str(BASE + 13), "role": "creator"}, headers=B)
    check("bot NAO deixa Adm cadastrar ninguem (403) - mesma regra do painel", r.status_code == 403)
    r = await c.post("/bot/staff", json={"invokerDiscordId": str(IDS["creator"]), "discordId": str(BASE + 13), "role": "creator"}, headers=B)
    check("bot NAO deixa Creator cadastrar ninguem (403)", r.status_code == 403)
    r = await c.post(f"/bot/staff/{BASE + 12}/deactivate", json={"invokerDiscordId": str(IDS["sadm"])}, headers=B)
    check("bot desativa Creator (200)", r.status_code == 200 and r.json()["isActive"] is False)
    r = await c.post(f"/bot/staff/{IDS['sadm']}/deactivate", json={"invokerDiscordId": str(IDS["adm"])}, headers=B)
    check("bot NAO deixa Adm desativar ninguem (403)", r.status_code == 403)
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
        """Corpo valido para criar uma vila de teste (com dois cla's)."""
        base = {"id": vid, "name": "TESTE Village", "namePt": "TESTE Vila", "element": "Fire", "motto": "lema", "description": "d",
                "longDescription": "texto", "emblem": "🔥", "image": None, "accentColor": "#112233", "climate": "quente",
                "leader": "Alguem", "mapX": 10, "mapY": 20,
                "clans": [{"id": f"{SLUG}-cla-a", "name": "Clan A", "description": "a"},
                          {"id": f"{SLUG}-cla-b", "name": "Clan B", "description": "b"}]}
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
                        ("dois clas com o mesmo id", {"clans": [{"id": "x-1", "name": "a"}, {"id": "x-1", "name": "b"}]}),
                        ("clan com imagem gigante (url > 500)", {"clans": [{"id": "x-2", "name": "a", "image": "x" * 600}]})]:
        r = await c.post("/villages", json=vila(**({"id": f"{SLUG}-v2"} | extra)), headers=A)
        check(f"validacao: {nome} (422)", r.status_code == 422, f"veio {r.status_code}")
    r = await c.put(f"/villages/{vid}", json=vila(name="TESTE Village 2", clans=[
        {"id": f"{SLUG}-cla-a", "name": "Clan A editado", "description": "a"},
        {"id": f"{SLUG}-cla-c", "name": "Clan C", "description": "c"}]), headers=C)
    check("Creator NAO edita vila (403)", r.status_code == 403)
    r = await c.put(f"/villages/{vid}", json=vila(name="TESTE Village 2", clans=[
        {"id": f"{SLUG}-cla-a", "name": "Clan A editado", "description": "a"},
        {"id": f"{SLUG}-cla-c", "name": "Clan C", "description": "c"}]), headers=A)
    nomes = {cl["id"].rsplit("-", 1)[1]: cl["name"] for cl in r.json().get("clans", [])}
    check("Adm edita a vila (200)", r.status_code == 200 and r.json()["name"] == "TESTE Village 2", r.text[:150])
    check("clas sincronizados: A editado, B removido, C novo", nomes == {"a": "Clan A editado", "c": "Clan C"}, str(nomes))
    r = await c.put(f"/villages/{vid}", json=vila(id=f"{SLUG}-outra"), headers=A)
    check("id da vila nao pode ser alterado (400)", r.status_code == 400)
    r = await c.put(f"/villages/{SLUG}-nao-existe", json=vila(id=f"{SLUG}-nao-existe"), headers=A)
    check("editar vila inexistente (404)", r.status_code == 404)
    r = await c.post("/villages", json=vila(id=f"{SLUG}-v3", clans=[{"id": f"{SLUG}-cla-a", "name": "roubado"}]), headers=A)
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
        """Corpo valido para criar um post de teste."""
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
        """Relogio falso para testar janelas de tempo sem esperar."""
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
            """Cliente HTTP que chega a' API como se viesse de um IP especifico."""
            return httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=(ip, 1234)), base_url="http://test")

        async def denied_rows() -> int:
            """Quantas linhas de 'login negado' existem para o ID de teste."""
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
            check("...e enquanto bloqueado nem um ID VALIDO entra (429 com Retry-After)", r.status_code == 429 and r.headers.get("retry-after", "").isdigit() and "Too many attempts" in r.json()["detail"], f"{r.status_code} {r.headers.get('retry-after')}")
        async with cliente("198.51.100.14") as y:
            r = await y.post("/auth/dev-login", json={"discordId": str(IDS["adm"])})
            check("outro IP entra normalmente", r.status_code == 200)
        settings.dev_login_enabled = False
        limiter.reset()

        # -- token do bot: forca bruta --
        settings.bot_api_token = "token-de-teste-do-bot-1234567890"
        certo = {"X-Bot-Token": settings.bot_api_token}
        consulta = f"/bot/staff?invokerDiscordId={IDS['sadm']}"
        async with cliente("198.51.100.15") as x:
            codigos = [(await x.get(consulta, headers={"X-Bot-Token": f"chute-{i}"})).status_code for i in range(10)]
            check("bot: 10 tokens errados dao 401", codigos == [401] * 10, str(codigos))
            r = await x.get(consulta, headers={"X-Bot-Token": "mais-um-chute"})
            check("o 11o ja' e' 429 (bloqueado)", r.status_code == 429 and "Too many attempts" in r.json()["detail"], f"{r.status_code}")
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

    secao("16) Cargos editaveis pelo painel (so' S.Adm) e imagem do cla'")
    from app.api import notices as notices_api
    from app.core import role_config
    for quem, h in (("Creator", C), ("Adm", A)):
        r = await c.get("/roles/permissions", headers=h)
        check(f"{quem} NAO enxerga a tela de cargos (404)", r.status_code == 404)
        r = await c.put("/roles/creator/permissions", json={"permissions": ["notices.manage"]}, headers=h)
        check(f"{quem} NAO edita permissoes (404)", r.status_code == 404)
    r = await c.get("/roles/permissions", headers=S)
    ok = r.status_code == 200
    check("S.Adm ve o catalogo de permissoes (200)", ok)
    visao = r.json() if ok else {"roles": [], "permissions": []}
    check("catalogo marca as permissoes exclusivas do S.Adm", {p["name"] for p in visao["permissions"] if p["superOnly"]} >= {"staff.view", "roles.manage", "audit.view_all"})
    check("S.Adm aparece como nao editavel", any(x["role"] == "super_admin" and not x["editable"] for x in visao["roles"]))
    r = await c.put("/roles/super_admin/permissions", json={"permissions": []}, headers=S)
    check("S.Adm NAO pode ser editado (400)", r.status_code == 400)
    r = await c.put("/roles/admin/permissions", json={"permissions": ["staff.view"]}, headers=S)
    check("nao da' pra dar permissao exclusiva do S.Adm a um Adm (400)", r.status_code == 400)
    r = await c.put("/roles/admin/permissions", json={"permissions": ["roles.manage"]}, headers=S)
    check("nem a de gerenciar cargos (400)", r.status_code == 400)
    r = await c.put("/roles/admin/permissions", json={"permissions": ["inventada.x"]}, headers=S)
    check("permissao desconhecida (422)", r.status_code == 422)
    r = await c.put("/roles/admin/permissions", json={"permissions": ["content.create"]}, headers=C)
    check("Creator NAO se da' permissao (404)", r.status_code == 404)

    # -- editar de verdade: tirar do Adm, dar ao Creator --
    me = (await c.get("/auth/me", headers=A)).json()["permissions"]
    check("antes: Adm tem content.delete", "content.delete" in me)
    sem_delete = [p for p in me if p != "content.delete"]
    r = await c.put("/roles/admin/permissions", json={"permissions": sem_delete}, headers=S)
    check("S.Adm tira content.delete do Adm (200)", r.status_code == 200, r.text[:100])
    me = (await c.get("/auth/me", headers=A)).json()["permissions"]
    check("na HORA: /auth/me do Adm nao lista mais content.delete", "content.delete" not in me)
    r = await c.post("/content-items/bulk-delete", json={"ids": []}, headers=A)
    check("na HORA: Adm leva 403 em rota que exige content.delete", r.status_code == 403, f"{r.status_code}")
    r = await c.post("/notices", json={"title": f"{SLUG}-x"}, headers=C)
    check("antes: Creator NAO posta aviso (403)", r.status_code == 403)
    me_c = (await c.get("/auth/me", headers=C)).json()["permissions"]
    r = await c.put("/roles/creator/permissions", json={"permissions": me_c + ["notices.manage"]}, headers=S)
    check("S.Adm da' notices.manage ao Creator (200)", r.status_code == 200)
    r = await c.post("/notices", json={"title": f"{SLUG}-do-creator"}, headers=C)
    check("depois: Creator posta aviso (201)", r.status_code == 201, f"{r.status_code}")
    r = await c.get("/audit-log?entityType=roles&limit=5", headers=S)
    check("a mudanca de permissoes fica no log (S.Adm ve)", r.status_code == 200 and len(r.json()) >= 2 and r.json()[0]["diff"] is not None)
    r = await c.get("/audit-log?entityType=roles&limit=5", headers=A)
    check("...e o Adm nao enxerga esse log", r.status_code == 200 and r.json() == [])
    for papel in ("admin", "creator"):
        r = await c.post(f"/roles/{papel}/permissions/reset", headers=S)
        check(f"reset de {papel} volta ao padrao (200)", r.status_code == 200)
    me = (await c.get("/auth/me", headers=A)).json()["permissions"]
    check("depois do reset o Adm volta a ter content.delete", "content.delete" in me)
    r = await c.post("/notices", json={"title": f"{SLUG}-y"}, headers=C)
    check("depois do reset o Creator NAO posta mais (403)", r.status_code == 403)
    # outra instancia da API (cache velho): relê o banco sozinha depois do TTL
    async with AsyncSessionLocal() as db:
        from app.models.roles import RolePermission
        db.add(RolePermission(role=StaffRole.CREATOR, permission="notices.manage", granted=True))
        await db.commit()
    role_config.invalidate()
    r = await c.post("/notices", json={"title": f"{SLUG}-z"}, headers=C)
    check("ajuste gravado direto no banco vale apos o cache expirar", r.status_code == 201, f"{r.status_code}")
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM role_permissions"))
        await db.commit()
    role_config.invalidate()

    # -- Quadro de avisos --
    r = await c.get("/notices")
    check("anonimo NAO le avisos (401)", r.status_code == 401)
    r = await c.get("/notices", headers=C)
    check("Creator le avisos (200)", r.status_code == 200)
    r = await c.post("/notices", json={"title": ""}, headers=A)
    check("aviso sem titulo (422)", r.status_code == 422)
    r = await c.post("/notices", json={"title": f"{SLUG}-aviso", "body": "linha1\nlinha2", "pinned": True}, headers=A)
    check("Adm posta aviso (201)", r.status_code == 201)
    nid = r.json().get("id")
    check("aviso guarda o nome de quem postou", r.json().get("authorName") == "TESTE_adm")
    r = await c.post("/notices", json={"title": f"{SLUG}-aviso-s"}, headers=S)
    check("S.Adm posta aviso (201)", r.status_code == 201)
    r = await c.put(f"/notices/{nid}", json={"title": f"{SLUG}-aviso2", "body": "novo", "pinned": False}, headers=C)
    check("Creator NAO edita aviso (403)", r.status_code == 403)
    r = await c.put(f"/notices/{nid}", json={"title": f"{SLUG}-aviso2", "body": "novo", "pinned": True}, headers=A)
    check("Adm edita aviso (200)", r.status_code == 200 and r.json()["title"].endswith("aviso2"))
    r = await c.post(f"/notices/{nid}/files", files={"file": ("regras.pdf", b"%PDF-1.4 teste", "application/pdf")}, headers=C)
    check("Creator NAO anexa arquivo (403)", r.status_code == 403)
    r = await c.post(f"/notices/{nid}/files", files={"file": ("regras.pdf", b"%PDF-1.4 teste", "application/pdf")}, headers=A)
    check("Adm anexa arquivo (201)", r.status_code == 201 and len(r.json()["files"]) == 1, r.text[:100])
    fid = r.json()["files"][0]["id"] if r.status_code == 201 else None
    r = await c.post(f"/notices/{nid}/files", files={"file": ("../../etc/passwd.txt", b"abc", "text/plain")}, headers=A)
    nomes = [f["filename"] for f in r.json().get("files", [])]
    check("nome com ../ vira so' o nome do arquivo", "passwd.txt" in nomes and not any("/" in n for n in nomes), str(nomes))
    # compactados: .zip/.rar/.7z aceitos se a assinatura bater com a extensao
    for nome, conteudo in (("pacote.zip", b"PK\x03\x04" + b"\x00" * 30), ("pacote.rar", b"Rar!\x1a\x07\x00" + b"\x00" * 30),
                           ("pacote.rar", b"Rar!\x1a\x07\x01\x00" + b"\x00" * 30), ("pacote.7z", b"7z\xbc\xaf\x27\x1c" + b"\x00" * 30)):
        r = await c.post(f"/notices/{nid}/files", files={"file": (nome, conteudo, "application/octet-stream")}, headers=A)
        check(f"anexo compactado {nome} valido e' aceito (201)", r.status_code == 201, f"{r.status_code} {r.text[:80]}")
    r = await c.post(f"/notices/{nid}/files", files={"file": ("falso.zip", b"MZ\x90\x00 isto e' um exe", "application/zip")}, headers=A)
    check(".zip falso (conteudo nao e' zip) e' recusado (415)", r.status_code == 415)
    r = await c.post(f"/notices/{nid}/files", files={"file": ("falso.rar", b"PK\x03\x04 zip com nome de rar", "application/x-rar")}, headers=A)
    check(".rar com conteudo de zip tambem e' recusado (415)", r.status_code == 415)
    for ruim in ("virus.exe", "pagina.html", "x.svg", "run.sh"):
        r = await c.post(f"/notices/{nid}/files", files={"file": (ruim, b"abc", "text/plain")}, headers=A)
        check(f"anexo {ruim} e' recusado (415)", r.status_code == 415)
    r = await c.post(f"/notices/{nid}/files", files={"file": ("vazio.txt", b"", "text/plain")}, headers=A)
    check("arquivo vazio (400)", r.status_code == 400)
    antigo = settings.max_notice_file_mb
    settings.max_notice_file_mb = 1
    r = await c.post(f"/notices/{nid}/files", files={"file": ("grande.bin", b"x" * (1024 * 1024 + 1), "application/octet-stream")}, headers=A)
    settings.max_notice_file_mb = antigo
    check("arquivo acima do limite (413)", r.status_code == 413)
    r = await c.get(f"/notices/files/{fid}")
    check("anonimo NAO baixa arquivo (401)", r.status_code == 401)
    r = await c.get(f"/notices/files/{fid}", headers=C)
    check("Creator baixa o arquivo (200, conteudo igual)", r.status_code == 200 and r.content == b"%PDF-1.4 teste")
    check("...sempre como download (attachment + octet-stream + nosniff)",
          "attachment" in r.headers.get("content-disposition", "") and "regras.pdf" in r.headers.get("content-disposition", "")
          and r.headers.get("content-type") == "application/octet-stream" and r.headers.get("x-content-type-options") == "nosniff")
    r = await c.get("/uploads/regras.pdf")
    check("arquivo da equipe NAO esta' na pasta publica", r.status_code == 404)
    r = await c.get("/notices", headers=C)
    lista = r.json()
    ours = [n for n in lista if n["title"].startswith(SLUG)]
    check("lista traz fixados primeiro", lista[0]["pinned"] is True or not any(n["pinned"] for n in lista))
    check("lista inclui os anexos", any(n["id"] == nid and len(n["files"]) >= 2 for n in ours))
    r = await c.delete(f"/notices/{nid}/files/{fid}", headers=C)
    check("Creator NAO remove anexo (403)", r.status_code == 403)
    r = await c.delete(f"/notices/{nid}/files/{fid}", headers=A)
    check("Adm remove anexo (200)", r.status_code == 200 and all(f["id"] != fid for f in r.json()["files"]))
    r = await c.get(f"/notices/files/{fid}", headers=C)
    check("anexo removido nao baixa mais (404)", r.status_code == 404)
    antes = set(p.name for p in notices_api.FILES_DIR.iterdir())
    r = await c.delete(f"/notices/{nid}", headers=C)
    check("Creator NAO apaga aviso (403)", r.status_code == 403)
    r = await c.delete(f"/notices/{nid}", headers=A)
    check("Adm apaga aviso (204)", r.status_code == 204)
    depois = set(p.name for p in notices_api.FILES_DIR.iterdir())
    check("apagar o aviso apaga os arquivos do disco", len(depois) < len(antes), f"{len(antes)} -> {len(depois)}")
    r = await c.get("/audit-log?entityType=notice&limit=20", headers=A)
    check("avisos aparecem no log de conteudo (Adm ve)", r.status_code == 200 and len(r.json()) >= 3)

    # -- imagem no cla' (no lugar de nivel/ryo) --
    vid16 = f"{SLUG}-v16"
    corpo = {"id": vid16, "name": "TESTE V16", "element": "Fire", "emblem": "🔥", "accentColor": "#112233",
             "clans": [{"id": f"{SLUG}-cla-img", "name": "Com imagem", "description": "d", "image": "http://x/y.png"},
                       {"id": f"{SLUG}-cla-sem", "name": "Sem imagem"}]}
    r = await c.post("/villages", json=corpo, headers=A)
    check("cla' com imagem e sem imagem salvam (201)", r.status_code == 201, r.text[:150])
    cl = {x["id"]: x for x in r.json().get("clans", [])}
    check("imagem do cla' volta na API", cl.get(f"{SLUG}-cla-img", {}).get("image") == "http://x/y.png")
    check("cla' nao tem mais nivel nem preco", all("levelRequirement" not in x and "priceRyo" not in x for x in cl.values()))
    check("cla' sem imagem fica com image = null", cl.get(f"{SLUG}-cla-sem", {}).get("image") is None)
    await c.delete(f"/villages/{vid16}", headers=A)

    secao("17) Endurecimento: cabecalhos, limite de corpo, rate limit geral, conteudo rico e IP real")
    from app.core.security import _resolve_client_ip
    from app.schemas.validators import validate_rich_content
    r = await c.get("/health")
    check("resposta traz nosniff + anti-iframe + sem referrer",
          r.headers.get("x-content-type-options") == "nosniff" and r.headers.get("x-frame-options") == "DENY"
          and r.headers.get("referrer-policy") == "no-referrer")
    r = await c.get("/auth/me", headers=S)
    check("rotas sensiveis nunca ficam em cache (no-store)", r.headers.get("cache-control") == "no-store")
    grande = {"slug": f"{SLUG}-gigante", "name": "x" * 600_000}
    r = await c.post("/content-items", content=json.dumps(grande), headers={**S, "Content-Type": "application/json"})
    check("corpo JSON gigante e' recusado (413) antes de processar", r.status_code == 413, f"{r.status_code}")
    r = await c.post("/content-items", content=b"{}", headers={**S, "Content-Type": "application/json", "Content-Length": "900000"})
    check("Content-Length declarado gigante tambem (413)", r.status_code == 413)

    antigo_limite = settings.public_requests_per_minute
    settings.public_requests_per_minute = 5
    limiter.reset()
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=("198.51.100.77", 1)), base_url="http://test") as x:
            codigos = [(await x.get("/villages")).status_code for _ in range(7)]
            check("flood de leitura: depois do limite vem 429", codigos[:5] == [200] * 5 and codigos[5:] == [429, 429], str(codigos))
            r = await x.get("/villages")
            check("429 traz Retry-After e mensagem em portugues", r.status_code == 429 and int(r.headers.get("retry-after", 0)) >= 1 and "Too many attempts" in r.json()["detail"])
            check("/health nunca e' limitado (monitoramento)", (await x.get("/health")).status_code == 200)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=("198.51.100.78", 1)), base_url="http://test") as y:
            check("outro IP nao e' afetado", (await y.get("/villages")).status_code == 200)
    finally:
        settings.public_requests_per_minute = antigo_limite
        limiter.reset()

    ok_doc = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"oi","marks":[{"type":"link","attrs":{"href":"https://x.com"}},{"type":"bold"}]}]}]}'
    check("documento Tiptap legitimo passa", validate_rich_content(ok_doc) == ok_doc)
    def recusa(doc: str) -> bool:
        """True se o validador de conteudo rico recusou o documento."""
        try:
            validate_rich_content(doc)
            return False
        except ValueError:
            return True
    check("link javascript: e' recusado", recusa(ok_doc.replace("https://x.com", "javascript:alert(1)")))
    check("link data: e' recusado", recusa(ok_doc.replace("https://x.com", "data:text/html,<b>")))
    check("link com maiusculas disfarcadas (JaVaScRiPt:) e' recusado", recusa(ok_doc.replace("https://x.com", "JaVaScRiPt:alert(1)")))
    check("tipo de bloco desconhecido e' recusado", recusa('{"type":"doc","content":[{"type":"iframe"}]}'))
    check("marca desconhecida e' recusada", recusa('{"type":"doc","content":[{"type":"text","text":"a","marks":[{"type":"evil"}]}]}'))
    fundo = '{"type":"paragraph"}'
    for _ in range(60):
        fundo = '{"type":"blockquote","content":[' + fundo + ']}'
    check("aninhamento profundo demais e' recusado", recusa('{"type":"doc","content":[' + fundo + ']}'))
    check("campo rico gigante e' recusado", recusa('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"' + "a" * 400_000 + '"}]}]}'))

    antigo_trust = settings.trust_proxy_headers
    escopo = {"headers": [(b"x-forwarded-for", b"6.6.6.6, 203.0.113.50"), (b"cf-connecting-ip", b"")], "client": ("10.0.0.1", 1)}
    settings.trust_proxy_headers = False
    check("sem TRUST_PROXY_HEADERS o X-Forwarded-For forjado e' ignorado", _resolve_client_ip(escopo) == "10.0.0.1")
    settings.trust_proxy_headers = True
    check("com TRUST_PROXY_HEADERS usa o ULTIMO X-Forwarded-For (o do proxy), nao o forjado", _resolve_client_ip(escopo) == "203.0.113.50")
    check("CF-Connecting-IP tem prioridade", _resolve_client_ip({"headers": [(b"cf-connecting-ip", b"198.51.100.9")], "client": ("10.0.0.1", 1)}) == "198.51.100.9")
    settings.trust_proxy_headers = antigo_trust
    check("FRONTEND_ORIGIN com '/' no fim e' normalizado", Settings(database_url="x", jwt_secret_key="x", frontend_origin="https://a.com/").frontend_origin == "https://a.com")

    secao("18) DeepL (simulada): ingles padrao + traducao PT em vilas, cla's, organizacoes e posts")
    async def deepl_falso(textos: list[str], reverse: bool = False) -> list[str]:
        """Simula a DeepL: EN->PT poe 'PT:' na frente; PT->EN poe 'EN:' na frente (sem chamar a internet)."""
        return [("EN:" if reverse else "PT:") + t for t in textos]

    vid18 = f"{SLUG}-v18"
    base18 = {"id": vid18, "name": "TESTE Village", "element": "Fire", "motto": "Motto here", "description": "A short text",
              "longDescription": "A long text", "emblem": "🔥", "accentColor": "#112233", "climate": "Hot",
              "clans": [{"id": f"{SLUG}-c18a", "name": "Clan Alpha", "description": "Alpha desc"},
                        {"id": f"{SLUG}-c18b", "name": "Clan Beta", "description": "Beta desc", "namePt": "Clã Beta Manual"}]}
    with patch("app.core.translation._deepl_translate_batch", new=deepl_falso):
        r = await c.post("/villages", json=base18, headers=A)
        check("vila criada em ingles (201)", r.status_code == 201, r.text[:150])
        v = r.json()
        check("DeepL preencheu motto/descricao/clima em PT", v.get("mottoPt") == "PT:Motto here" and v.get("descriptionPt") == "PT:A short text" and v.get("climatePt") == "PT:Hot", str({k: v.get(k) for k in ("mottoPt", "descriptionPt", "climatePt")}))
        check("DeepL preencheu a descricao longa em PT", v.get("longDescriptionPt") == "PT:A long text")
        cl = {x["id"]: x for x in v.get("clans", [])}
        check("DeepL traduziu nome e descricao do cla'", cl[f"{SLUG}-c18a"]["namePt"] == "PT:Clan Alpha" and cl[f"{SLUG}-c18a"]["descriptionPt"] == "PT:Alpha desc")
        check("traducao escrita a mao NAO e' sobrescrita", cl[f"{SLUG}-c18b"]["namePt"] == "Clã Beta Manual" and cl[f"{SLUG}-c18b"]["descriptionPt"] == "PT:Beta desc")
        corpo = {**base18, "description": "Changed text", "descriptionPt": "Texto corrigido a mao"}
        r = await c.put(f"/villages/{vid18}", json=corpo, headers=A)
        check("editar o ingles NAO apaga a correcao manual em PT", r.status_code == 200 and r.json()["descriptionPt"] == "Texto corrigido a mao", r.text[:120])
        r = await c.post(f"/villages/{vid18}/retranslate", headers=C)
        check("Creator NAO retraduz vila (403)", r.status_code == 403)
        r = await c.post(f"/villages/{vid18}/retranslate", headers=A)
        check("Retraduzir refaz o PT a partir do ingles atual", r.status_code == 200 and r.json()["descriptionPt"] == "PT:Changed text", r.text[:150])
        r = await c.get(f"/villages/{vid18}")
        check("o publico recebe os campos em PT (site escolhe pelo idioma)", r.json()["longDescriptionPt"] == "PT:A long text")
        rich = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"link","attrs":{"href":"javascript:1"}}]}]}]}'
        r = await c.put(f"/villages/{vid18}", json={**base18, "longDescriptionPt": rich}, headers=A)
        check("texto rico em PT tambem e' validado (link javascript: recusado)", r.status_code == 422)
        await c.delete(f"/villages/{vid18}", headers=A)

        oid = f"{SLUG}-o18"
        r = await c.post("/organizations", json={"id": oid, "name": "Hunters", "description": "They hunt", "villageIds": []}, headers=A)
        check("organizacao em ingles e' traduzida (nome e descricao)", r.status_code == 201 and r.json()["namePt"] == "PT:Hunters" and r.json()["descriptionPt"] == "PT:They hunt", r.text[:150])
        r = await c.post(f"/organizations/{oid}/retranslate", headers=C)
        check("Creator NAO retraduz organizacao (403)", r.status_code == 403)
        await c.delete(f"/organizations/{oid}", headers=A)

        doc = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello","marks":[{"type":"bold"}]}]}]}'
        r = await c.post("/posts", json={"slug": f"{SLUG}-p18", "title": "Big news", "excerpt": "Summary", "content": doc, "status": "draft"}, headers=A)
        pj = r.json() if r.status_code == 201 else {}
        check("post em ingles e' traduzido (titulo, resumo e texto)", r.status_code == 201 and pj.get("titlePt") == "PT:Big news" and pj.get("excerptPt") == "PT:Summary", r.text[:160])
        check("texto rico traduzido mantem a formatacao (negrito) e traduz so' o texto", '"bold"' in (pj.get("contentPt") or "") and "PT:Hello" in (pj.get("contentPt") or ""))
        r = await c.post(f"/posts/{pj.get('id')}/retranslate", headers=A)
        check("Adm retraduz o post (200)", r.status_code == 200)

    # script de conversao PT -> EN (conteudo antigo em portugues nos campos principais)
    from scripts import traduzir_para_ingles as conv
    check("detector: texto em portugues e' reconhecido", conv.parece_portugues("A vila é a maior de todas e tem uma história com os clãs"))
    check("detector: texto em ingles NAO e' convertido", not conv.parece_portugues("The village is the largest of all and has a history with the clans"))
    check("detector le' o texto dentro do JSON do editor", conv.parece_portugues('{"type":"doc","content":[{"type":"text","text":"Uma vila que protege a folha"}]}'))
    async with AsyncSessionLocal() as db:
        await db.execute(text("INSERT INTO organizations (id, name, description) VALUES (:i, 'Corpo de elite', 'Uma organização com missões de alto risco para a vila')"), {"i": f"{SLUG}-o18b"})
        await db.commit()
    with patch("app.core.translation._deepl_translate_batch", new=deepl_falso), patch.object(conv.settings, "deepl_api_key", "x"):
        n, falhas = await conv.processar("organizations", aplicar=False)
        check("simulacao NAO grava nada", n >= 1 and falhas == 0)
        async with AsyncSessionLocal() as db:
            antes = (await db.execute(text("SELECT name, name_pt FROM organizations WHERE id=:i"), {"i": f"{SLUG}-o18b"})).one()
        check("...o registro continua intacto apos a simulacao", antes == ("Corpo de elite", None))
        n, falhas = await conv.processar("organizations", aplicar=True)
        async with AsyncSessionLocal() as db:
            depois = (await db.execute(text("SELECT name, name_pt, description, description_pt FROM organizations WHERE id=:i"), {"i": f"{SLUG}-o18b"})).one()
        check("aplicar: ingles vai pro campo principal e o portugues antigo vai pro _pt",
              depois[0] == "EN:Corpo de elite" and depois[1] == "Corpo de elite" and depois[2].startswith("EN:Uma organização") and depois[3].startswith("Uma organização"), str(depois))
        n2, _ = await conv.processar("organizations", aplicar=True)
        async with AsyncSessionLocal() as db:
            de_novo = (await db.execute(text("SELECT name FROM organizations WHERE id=:i"), {"i": f"{SLUG}-o18b"})).scalar_one()
        check("rodar de novo nao converte duas vezes (idempotente)", de_novo == "EN:Corpo de elite")

    secao("19) Registro de erros: captura, mascara, reabre, painel so' S.Adm, DeepL, flood, site, bot, health")
    from app.core import error_log, hardening
    from app.main import app as fastapi_app

    # -- mascara de segredos --
    m = error_log.mask("conn postgresql+asyncpg://admin:Sup3rSenha@db.host:5432/x token=abc123XYZ Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl [parameters: ('a@b.com', 'senha')]")
    check("mascara senha de URL do banco", "Sup3rSenha" not in m and "postgresql+asyncpg://***@db.host" in m, m)
    check("mascara tokens, JWT e parametros de SQL", "abc123XYZ" not in m and "eyJhbGci" not in m and "a@b.com" not in m, m)
    segredo_antigo = settings.jwt_secret_key
    settings.jwt_secret_key = "valor-secreto-do-env-123456"
    check("mascara o VALOR real dos segredos do .env", "valor-secreto-do-env-123456" not in error_log.mask("falhou com valor-secreto-do-env-123456 no meio"))
    settings.jwt_secret_key = segredo_antigo
    check("mensagem gigante e' cortada", len(error_log.mask("x" * 5000)) <= error_log.MAX_MESSAGE)
    check("fingerprint nao muda com ids diferentes na rota",
          error_log.fingerprint_of("api", "E", "a.py:1", "/posts/3f2a1b4c-1111-2222-3333-444455556666") == error_log.fingerprint_of("api", "E", "a.py:1", "/posts/aaaaaaaa-1111-2222-3333-444455556666"))
    check("fingerprint muda quando o tipo do erro muda", error_log.fingerprint_of("api", "E1", None, "/x") != error_log.fingerprint_of("api", "E2", None, "/x"))

    # -- excecao nao tratada vira 500 generico + registro --
    async def boom():
        """Rota de teste que sempre quebra (para provar que o erro e' capturado e mascarado)."""
        raise RuntimeError(f"{SLUG} falhou ao falar com postgresql://usuario:senhaSecreta@host/db")
    fastapi_app.add_api_route("/__teste_boom/{item_id}", boom, methods=["GET"])
    error_log.reset_throttle()
    r = await c.get("/__teste_boom/123")
    check("rota que quebra responde 500 GENERICO (sem vazar nada)", r.status_code == 500 and r.json() == {"detail": "Internal server error"} and "senhaSecreta" not in r.text and SLUG not in r.text, r.text[:120])
    check("o 500 tambem leva cabecalhos de seguranca", r.headers.get("x-content-type-options") == "nosniff")
    r = await c.get("/errors?status=all", headers=S)
    eventos = [e for e in r.json() if e["path"] == "/__teste_boom/{item_id}" or (e["path"] or "").startswith("/__teste_boom")]
    check("S.Adm ve' o problema registrado", r.status_code == 200 and len(eventos) == 1, str(r.status_code))
    ev = eventos[0] if eventos else {}
    check("tipo e local do erro foram registrados", ev.get("title") == "RuntimeError" and "testar_permissoes.py" in (ev.get("location") or "") and ev.get("status") == 500, str(ev.get("location")))
    check("mensagem e traceback saem MASCARADOS", "senhaSecreta" not in (ev.get("message") or "") + (ev.get("trace") or "") and "***" in (ev.get("message") or ""), ev.get("message", ""))
    check("traceback fica guardado para o painel", "RuntimeError" in (ev.get("trace") or "") and "boom" in (ev.get("trace") or ""))
    # contador: freio de escrita junta as repeticoes
    error_log._PER_FINGERPRINT_SECONDS = 0
    for _ in range(3):
        await c.get("/__teste_boom/456")
    error_log._PER_FINGERPRINT_SECONDS = 20
    r = await c.get("/errors?status=all", headers=S)
    ev = [e for e in r.json() if (e["path"] or "").startswith("/__teste_boom")][0]
    check("mesmo problema em ids diferentes vira UMA linha com contador (1+3)", ev["count"] == 4, str(ev["count"]))
    # painel: so' S.Adm
    for quem, h in (("Adm", A), ("Creator", C)):
        r = await c.get("/errors", headers=h)
        check(f"{quem} NAO ve' o registro de erros (404)", r.status_code == 404)
    r = await c.get("/errors")
    check("anonimo NAO ve' o registro de erros (401)", r.status_code == 401)
    eid = ev["id"]
    r = await c.post(f"/errors/{eid}/resolve", headers=S)
    check("S.Adm marca como resolvido", r.status_code == 200 and r.json()["resolved"] is True and r.json()["resolvedBy"] == "TESTE_sadm")
    r = await c.get("/errors?status=open", headers=S)
    check("resolvido some da lista de abertos", all(e["id"] != eid for e in r.json()))
    error_log._PER_FINGERPRINT_SECONDS = 0
    await c.get("/__teste_boom/789")
    error_log._PER_FINGERPRINT_SECONDS = 20
    r = await c.get("/errors?status=open", headers=S)
    check("se o problema VOLTA a acontecer ele REABRE sozinho", any(e["id"] == eid and not e["resolved"] and e["resolvedBy"] is None for e in r.json()))
    r = await c.post(f"/errors/{eid}/resolve", headers=A)
    check("Adm NAO resolve erro (404)", r.status_code == 404)

    # -- resposta 5xx "normal" (HTTPException) tambem e' registrada --
    from fastapi import HTTPException as _HTTPException
    async def indisponivel():
        """Rota de teste que responde 503 de proposito."""
        raise _HTTPException(status_code=503, detail="manutencao")
    fastapi_app.add_api_route("/__teste_503", indisponivel, methods=["GET"])
    r = await c.get("/__teste_503")
    r2 = await c.get("/errors?status=all", headers=S)
    check("HTTPException 503 e' registrada como HTTP 503", r.status_code == 503 and any(e["title"] == "HTTP 503" and e["path"] == "/__teste_503" for e in r2.json()))

    # -- falha da DeepL --
    from app.core import translation as tr
    segredo_deepl = settings.deepl_api_key
    settings.deepl_api_key = "chave-de-teste-123456789:fx"
    async def post_cota(self, *a, **k):
        """Simula a DeepL respondendo 456 (cota do plano acabou)."""
        return httpx.Response(456, request=httpx.Request("POST", "http://deepl.test"))
    async def post_fora(self, *a, **k):
        """Simula a DeepL fora do ar (falha de rede)."""
        raise httpx.ConnectError("sem rede")
    try:
        with patch.object(httpx.AsyncClient, "post", post_cota):
            check("DeepL sem cota: a traducao devolve None (nao quebra)", await tr.translate_field("hello") is None)
        with patch.object(httpx.AsyncClient, "post", post_fora):
            check("DeepL fora do ar: devolve None (nao quebra)", await tr.translate_field("hello") is None)
    finally:
        settings.deepl_api_key = segredo_deepl
    r = await c.get("/errors?status=all&source=deepl", headers=S)
    titulos = {e["title"] for e in r.json()}
    check("falhas da DeepL aparecem no registro (cota e fora do ar)", {"DeepL quota exceeded", "DeepL request failed"} <= titulos, str(titulos))
    check("registro da DeepL nao contem a chave", all("chave-de-teste" not in (e["message"] + (e["trace"] or "")) for e in r.json()))

    # -- flood (rate limit) vira alerta de seguranca --
    settings.public_requests_per_minute = 3
    limiter.reset()
    hardening._flood_seen.clear()
    error_log.reset_throttle()
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=("198.51.100.99", 1)), base_url="http://test") as x:
            codigos = [(await x.get("/villages")).status_code for _ in range(6)]
    finally:
        settings.public_requests_per_minute = antigo_limite
        limiter.reset()
    r = await c.get("/errors?status=all&source=security", headers=S)
    flood = [e for e in r.json() if e["title"].startswith("Rate limit exceeded")]
    check("flood: 429 e UM alerta (nao um por requisicao)", codigos.count(429) >= 2 and len(flood) == 1, f"{codigos} {len(flood)}")
    check("alerta de flood guarda o IP so' para o S.Adm", flood and flood[0]["ipAddress"] == "198.51.100.99")

    # -- erros que o visitante viu no site (publico, com defesas) --
    limiter.reset()
    error_log.reset_throttle()
    corpo = {"message": f"{SLUG} Cannot read properties of undefined\nsecond line", "path": "/village/leaf", "kind": "render", "digest": "abc123"}
    r = await c.post("/client-errors", json=corpo, headers={"Origin": settings.frontend_origin})
    check("site reporta erro de tela (204, sem login)", r.status_code == 204)
    r = await c.get("/errors?status=all&source=web", headers=S)
    web = [e for e in r.json() if SLUG in e["title"]]
    check("erro do site registrado como origem 'web' com a pagina", len(web) == 1 and web[0]["path"] == "/village/leaf" and web[0]["location"].startswith("page (render)"), str(web)[:200])
    check("quebra de linha do relatorio nao entra no titulo", web and "\n" not in web[0]["title"])
    r = await c.post("/client-errors", json=corpo, headers={"Origin": "https://site-malicioso.example"})
    check("relatorio vindo de OUTRA origem e' recusado (403)", r.status_code == 403)
    r = await c.post("/client-errors", json={"message": "x" * 600})
    check("mensagem gigante e' recusada (422)", r.status_code == 422)
    r = await c.post("/client-errors", json={"message": "ok", "kind": "hack"})
    check("tipo invalido e' recusado (422)", r.status_code == 422)
    limiter.reset()
    codigos = [(await c.post("/client-errors", json={**corpo, "message": f"{SLUG} flood {i}"})).status_code for i in range(12)]
    check("limite por IP no relatorio do site (429 depois de 10/min)", codigos[:10] == [204] * 10 and 429 in codigos[10:], str(codigos))
    limiter.reset()
    antigo_teto = __import__("app.api.errors", fromlist=["x"]).MAX_NEW_WEB_ERRORS_PER_HOUR
    import app.api.errors as errors_api
    errors_api.MAX_NEW_WEB_ERRORS_PER_HOUR = 0
    try:
        r = await c.post("/client-errors", json={**corpo, "message": f"{SLUG} teto"})
        r2 = await c.get("/errors?status=all&source=web", headers=S)
    finally:
        errors_api.MAX_NEW_WEB_ERRORS_PER_HOUR = antigo_teto
    check("teto por hora: acima dele o relatorio e' ignorado em silencio", r.status_code == 204 and not any(e["title"].endswith("teto") for e in r2.json()))

    # -- bot: feed de erros e health --
    settings.bot_api_token = "token-de-teste-do-bot-1234567890"
    B = {"X-Bot-Token": settings.bot_api_token}
    desde = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    r = await c.get("/bot/errors", params={"since": desde}, headers=B)
    check("bot le' os problemas recentes (200)", r.status_code == 200 and len(r.json()) >= 3)
    check("feed do bot SEM traceback e SEM IP", all("trace" not in e and "ipAddress" not in e for e in r.json()))
    check("feed do bot em ordem cronologica", [e["lastSeen"] for e in r.json()] == sorted(e["lastSeen"] for e in r.json()))
    r = await c.get("/bot/errors", params={"since": desde})
    check("feed do bot sem token e' barrado (401)", r.status_code == 401)
    settings.bot_api_token = ""
    r = await c.get("/health/ready")
    check("/health/ready com banco ok (200)", r.status_code == 200 and r.json()["database"] == "ok")
    class BancoMorto:
        """Sessao de banco falsa que falha ao abrir (simula o Postgres fora do ar)."""
        async def __aenter__(self):
            raise ConnectionError("banco fora do ar")
        async def __aexit__(self, *a):
            return False
    import app.main as main_mod
    with patch.object(main_mod, "AsyncSessionLocal", lambda: BancoMorto()):
        r = await c.get("/health/ready")
    check("/health/ready com banco fora do ar responde 503", r.status_code == 503 and r.json()["status"] == "down")
    error_log.reset_throttle()

    secao("20) Blog: tags, agendamento, midia no texto, leitores, curtidas, comentarios e moderacao")
    from app.core.security import READER_COOKIE, safe_return_path
    from app.api.engagement import clean_comment
    from app.schemas.validators import validate_rich_content

    # --- tags ---
    r = await c.get("/tags")
    check("GET /tags e' publico e traz as tags iniciais", r.status_code == 200 and any(t["id"] == "update" for t in r.json()))
    tag_nome = f"{SLUG} tag"
    r = await c.post("/tags", json={"name": tag_nome}, headers=C)
    check("Creator cria uma tag (posts.create)", r.status_code == 201 and r.json()["id"] == f"{SLUG}-tag", r.text)
    check("tag repetida -> 409", (await c.post("/tags", json={"name": tag_nome}, headers=C)).status_code == 409)
    check("anonimo nao cria tag", (await c.post("/tags", json={"name": "abc def"})).status_code == 401)
    check("Creator nao apaga tag (posts.delete)", (await c.delete(f"/tags/{SLUG}-tag", headers=C)).status_code == 403)

    def corpo_post(sufixo, **extra):
        """Corpo valido de post de teste."""
        return {"slug": f"{SLUG}-b{sufixo}", "title": f"TESTE blog {sufixo}", "excerpt": "resumo", "content": "texto simples", **extra}

    r = await c.post("/posts", json=corpo_post("1", status="published", tags=[f"{SLUG}-tag", "update"]), headers=A)
    check("Adm cria post publicado com 2 tags", r.status_code == 201 and len(r.json()["tags"]) == 2 and r.json()["publishedAt"], r.text)
    check("post sem data: publishedAt nasce ao publicar", r.json()["isScheduled"] is False)
    r = await c.get(f"/posts?tag={SLUG}-tag")
    check("filtro ?tag= lista so' posts da tag", r.status_code == 200 and [p["slug"] for p in r.json()] == [f"{SLUG}-b1"], r.text)
    r = await c.get("/tags")
    check("contagem da tag so' conta posts no ar", next(t for t in r.json() if t["id"] == f"{SLUG}-tag")["postCount"] == 1)
    check("tag inexistente num post -> 422", (await c.post("/posts", json=corpo_post("x", tags=["nao-existe-xyz"]), headers=A)).status_code == 422)
    check("slug de tag invalido -> 422", (await c.post("/posts", json=corpo_post("y", tags=["Tag Ruim!"]), headers=A)).status_code == 422)
    check("mais de 8 tags -> 422", (await c.post("/posts", json=corpo_post("z", tags=[f"t{i}" for i in range(9)]), headers=A)).status_code == 422)

    # --- agendamento ---
    futuro = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    r = await c.post("/posts", json=corpo_post("2", status="published", publishedAt=futuro), headers=A)
    check("Adm agenda um post para o futuro", r.status_code == 201 and r.json()["isScheduled"] is True, r.text)
    check("post agendado: anonimo recebe 404 por slug", (await c.get(f"/posts/slug/{SLUG}-b2")).status_code == 404)
    check("post agendado: nao aparece na lista publica", all(p["slug"] != f"{SLUG}-b2" for p in (await c.get("/posts")).json()))
    r = await c.get(f"/posts/slug/{SLUG}-b2", headers=A)
    check("post agendado: a equipe ve (isScheduled)", r.status_code == 200 and r.json()["isScheduled"] is True)
    r = await c.post("/posts", json=corpo_post("3", status="published", publishedAt=futuro), headers=C)
    check("Creator nao agenda/publica (403)", r.status_code == 403)

    # --- conteudo rico novo ---
    def doc(*nodes):
        """Documento Tiptap com os nos informados."""
        return json.dumps({"type": "doc", "content": list(nodes)})
    ok_nodes = [
        {"type": "image", "attrs": {"src": "http://localhost:8000/uploads/a.png", "alt": "x"}},
        {"type": "video", "attrs": {"src": "https://www.youtube-nocookie.com/embed/abc123"}},
        {"type": "video", "attrs": {"src": "https://player.twitch.tv/?video=1&parent=x"}},
        {"type": "paragraph", "content": [{"type": "mention", "attrs": {"id": "item:x", "label": "Kunai"}}]},
        {"type": "details", "content": [{"type": "detailsSummary", "content": [{"type": "text", "text": "Spoiler"}]},
                                        {"type": "detailsContent", "content": [{"type": "paragraph"}]}]},
        {"type": "blockquote", "content": [{"type": "paragraph"}]},
        {"type": "codeBlock", "content": [{"type": "text", "text": "x = 1"}]},
    ]
    r = await c.post("/posts", json=corpo_post("4", content=doc(*ok_nodes)), headers=C)
    check("imagem, video, mencao, spoiler, citacao e codigo sao aceitos", r.status_code == 201, r.text)
    for rotulo, no in [("imagem javascript:", {"type": "image", "attrs": {"src": "javascript:alert(1)"}}),
                       ("imagem data:", {"type": "image", "attrs": {"src": "data:image/svg+xml,<svg/>"}}),
                       ("video de site qualquer", {"type": "video", "attrs": {"src": "https://evil.example/x"}}),
                       ("video youtube comum (fora do nocookie)", {"type": "video", "attrs": {"src": "https://www.youtube.com/embed/x"}})]:
        r = await c.post("/posts", json=corpo_post("5", content=doc(no)), headers=C)
        check(f"conteudo recusado: {rotulo}", r.status_code == 422, str(r.status_code))
    for rotulo, attrs in [("mencao gigante", {"id": "x" * 200, "label": "a"}),
                          ("mencao com link javascript:", {"id": "a", "label": "a", "href": "javascript:alert(1)"}),
                          ("mencao com link para outro site", {"id": "a", "label": "a", "href": "//evil.example"})]:
        try:
            validate_rich_content(doc({"type": "mention", "attrs": attrs}))
            check(f"{rotulo} recusada", False)
        except ValueError:
            check(f"{rotulo} recusada", True)

    # --- SEO ---
    r = await c.post("/posts", json=corpo_post("6", metaTitle="  Meu   titulo  ", metaDescription="d" * 201), headers=C)
    check("meta description > 200 -> 422", r.status_code == 422)
    r = await c.post("/posts", json=corpo_post("6", metaTitle="  Meu   titulo  ", metaDescription="curta"), headers=C)
    check("campos de SEO sao salvos e limpos", r.status_code == 201 and r.json()["metaTitle"] == "Meu titulo" and r.json()["metaDescription"] == "curta", r.text)

    # --- leitores: sessao separada da equipe ---
    settings.dev_login_enabled = True
    leitor_a, leitor_b = str(BASE + 30), str(BASE + 31)
    r = await c.post("/auth/reader/dev-login", json={"discordId": leitor_a})
    check("login de leitor (dev) funciona e grava cookie proprio", r.status_code == 200 and READER_COOKIE in r.headers.get("set-cookie", ""), r.text)
    RA = {"Cookie": f"{READER_COOKIE}={c.cookies.get(READER_COOKIE)}"}
    c.cookies.clear()
    r = await c.post("/auth/reader/dev-login", json={"discordId": leitor_b})
    RB = {"Cookie": f"{READER_COOKIE}={c.cookies.get(READER_COOKIE)}"}
    c.cookies.clear()
    r = await c.get("/auth/reader/me", headers=RA)
    check("/auth/reader/me devolve o leitor (sem Discord ID)", r.status_code == 200 and r.json()["username"].startswith("Reader") and "discordId" not in r.json())
    check("sem cookie /auth/reader/me devolve null", (await c.get("/auth/reader/me")).json() is None)
    tok_leitor = RA["Cookie"].split("=", 1)[1]
    check("token de LEITOR nao vale como sessao da equipe", (await c.get("/auth/me", headers={"Cookie": f"{SESSION_COOKIE}={tok_leitor}"})).status_code == 401)
    check("token da EQUIPE nao vale como leitor", (await c.get("/auth/reader/me", headers={"Cookie": f"{READER_COOKIE}={create_session_token(adm)}"})).json() is None)
    check("leitor nao acessa o painel", (await c.get("/staff", headers=RA)).status_code == 401)
    settings.dev_login_enabled = False
    check("dev-login de leitor desligado -> 404", (await c.post("/auth/reader/dev-login", json={"discordId": leitor_a})).status_code == 404)
    settings.dev_login_enabled = True
    check("safe_return_path barra open redirect",
          safe_return_path("//evil.com") == "/blog" and safe_return_path("https://evil.com") == "/blog"
          and safe_return_path("/\\evil.com") == "/blog" and safe_return_path("/blog/abc") == "/blog/abc")

    # --- curtidas ---
    post_slug = f"{SLUG}-b1"
    check("curtir sem login -> 401", (await c.put(f"/posts/{post_slug}/like")).status_code == 401)
    r = await c.put(f"/posts/{post_slug}/like", headers=RA)
    check("leitor curte", r.status_code == 200 and r.json()["likeCount"] == 1 and r.json()["likedByMe"] is True, r.text)
    r = await c.put(f"/posts/{post_slug}/like", headers=RA)
    check("curtir de novo nao duplica", r.json()["likeCount"] == 1)
    r = await c.put(f"/posts/{post_slug}/like", headers=RB)
    check("outro leitor soma", r.json()["likeCount"] == 2)
    r = await c.get(f"/posts/{post_slug}/engagement")
    check("anonimo ve a contagem mas likedByMe=false", r.json()["likeCount"] == 2 and r.json()["likedByMe"] is False)
    r = await c.delete(f"/posts/{post_slug}/like", headers=RB)
    check("descurtir", r.json()["likeCount"] == 1 and r.json()["likedByMe"] is False)
    check("curtir post agendado -> 404", (await c.put(f"/posts/{SLUG}-b2/like", headers=RA)).status_code == 404)
    check("curtir com Origin de outro site -> 403", (await c.put(f"/posts/{post_slug}/like", headers={**RA, "Origin": "https://evil.example"})).status_code == 403)

    # --- comentarios ---
    check("comentar sem login -> 401", (await c.post(f"/posts/{post_slug}/comments", json={"body": "oi"})).status_code == 401)
    r = await c.post(f"/posts/{post_slug}/comments", json={"body": "  Muito   bom!  "}, headers=RA)
    check("leitor comenta (texto limpo)", r.status_code == 201 and r.json()["body"] == "Muito bom!" and r.json()["mine"] is True, r.text)
    cid = r.json()["id"]
    r = await c.post(f"/posts/{post_slug}/comments", json={"body": "<script>alert(1)</script>"}, headers=RB)
    check("HTML vira texto puro (guardado como veio, o site escapa)", r.status_code == 201 and "<script>" in r.json()["body"])
    cid_b = r.json()["id"]
    r = await c.get(f"/posts/{post_slug}/comments", headers=RA)
    check("lista de comentarios: 2, 'mine' so' do proprio leitor", len(r.json()) == 2 and [x["mine"] for x in r.json()] == [True, False], r.text)
    check("comentario nao expoe o Discord ID", all(set(x["author"]) == {"username", "avatarUrl"} for x in r.json()))
    check("comentario vazio -> 422", (await c.post(f"/posts/{post_slug}/comments", json={"body": "   "}, headers=RA)).status_code == 422)
    check("comentario enorme -> 422", (await c.post(f"/posts/{post_slug}/comments", json={"body": "a" * 1500}, headers=RA)).status_code == 422)
    check("muitos links -> 422", (await c.post(f"/posts/{post_slug}/comments", json={"body": "http://a.com http://b.com http://c.com"}, headers=RA)).status_code == 422)
    check("clean_comment tira caracteres de controle", clean_comment("a\x00b\x07c") == "abc")
    check("comentar em post agendado -> 404", (await c.post(f"/posts/{SLUG}-b2/comments", json={"body": "oi"}, headers=RA)).status_code == 404)
    check("nao apaga comentario de outro (404)", (await c.delete(f"/posts/{post_slug}/comments/{cid_b}", headers=RA)).status_code == 404)

    # --- moderacao ---
    check("moderacao: anonimo 401", (await c.get("/comments/moderation")).status_code == 401)
    check("moderacao: Creator 403", (await c.get("/comments/moderation", headers=C)).status_code == 403)
    check("moderacao: leitor nao entra (401)", (await c.get("/comments/moderation", headers=RA)).status_code == 401)
    r2 = await c.get("/comments/moderation", headers=A)
    check("moderacao: Adm lista (com post e autor)", r2.status_code == 200 and any(x["id"] == cid_b and x["postSlug"] == post_slug for x in r2.json()), r2.text[:200])
    r = await c.patch(f"/comments/moderation/{cid_b}", json={"hidden": True}, headers=A)
    check("Adm esconde comentario", r.status_code == 200)
    r = await c.get(f"/posts/{post_slug}/comments")
    check("comentario escondido some do publico e do contador",
          len(r.json()) == 1 and (await c.get(f"/posts/{post_slug}/engagement")).json()["commentCount"] == 1)
    check("lista de posts traz likeCount/commentCount",
          next(p for p in (await c.get("/posts")).json() if p["slug"] == post_slug)["commentCount"] == 1)
    r = await c.get("/comments/moderation?only_hidden=true", headers=A)
    check("filtro de escondidos", all(x["hidden"] for x in r.json()) and any(x["id"] == cid_b for x in r.json()))
    check("Adm mostra de volta", (await c.patch(f"/comments/moderation/{cid_b}", json={"hidden": False}, headers=A)).status_code == 200)
    check("leitor apaga o proprio comentario", (await c.delete(f"/posts/{post_slug}/comments/{cid}", headers=RA)).status_code == 204)
    check("Adm apaga comentario", (await c.delete(f"/comments/moderation/{cid_b}", headers=A)).status_code == 204)

    # --- ban ---
    async with AsyncSessionLocal() as db:
        from app.models.readers import Reader
        rid = (await db.execute(select(Reader.id).where(Reader.discord_id == int(leitor_a)))).scalar_one()
    check("Creator nao bane (403)", (await c.patch(f"/comments/moderation/readers/{rid}", json={"banned": True}, headers=C)).status_code == 403)
    check("Adm bane leitor", (await c.patch(f"/comments/moderation/readers/{rid}", json={"banned": True}, headers=A)).status_code == 200)
    check("banido perde a sessao na hora", (await c.get("/auth/reader/me", headers=RA)).json() is None)
    check("banido nao comenta nem curte", (await c.post(f"/posts/{post_slug}/comments", json={"body": "oi"}, headers=RA)).status_code == 401
          and (await c.put(f"/posts/{post_slug}/like", headers=RA)).status_code == 401)
    check("banido nao consegue entrar de novo", (await c.post("/auth/reader/dev-login", json={"discordId": leitor_a})).status_code == 403)
    check("Adm desbane", (await c.patch(f"/comments/moderation/readers/{rid}", json={"banned": False}, headers=A)).status_code == 200)
    check("desbanido volta", (await c.get("/auth/reader/me", headers=RA)).json() is not None)

    # --- limite de comentarios ---
    limiter.reset()
    codigos = [(await c.post(f"/posts/{post_slug}/comments", json={"body": f"spam {i}"}, headers=RB)).status_code for i in range(7)]
    check("spam de comentarios: 5 passam, o resto 429", codigos[:5] == [201] * 5 and codigos[5:] == [429, 429], str(codigos))

    # --- mencoes ---
    check("busca de mencoes: anonimo 401", (await c.get("/search/mentions?q=a")).status_code == 401)
    r = await c.get("/search/mentions?q=%25_%25", headers=C)
    check("busca de mencoes: curinga LIKE e' escapado (nada encontrado)", r.status_code == 200 and r.json() == [], r.text)
    check("busca de mencoes: texto vazio -> lista vazia", (await c.get("/search/mentions?q=", headers=C)).json() == [])
    check("busca de mencoes: Creator pode buscar", (await c.get("/search/mentions?q=a", headers=C)).status_code == 200)

    # --- apagar tag desfaz as ligacoes ---
    check("Adm apaga a tag", (await c.delete(f"/tags/{SLUG}-tag", headers=A)).status_code == 204)
    r = await c.get(f"/posts/slug/{post_slug}")
    check("post continua, sem a tag apagada", r.status_code == 200 and [t["id"] for t in r.json()["tags"]] == ["update"])

    secao("21) Conexao segura com o banco (certificados do SquareCloud): app/core/db_ssl.py")
    from app.core import db_ssl
    check("sem certificados configurados o SSL fica desligado", db_ssl.is_enabled("", "", "") is False)
    check("com os 3 caminhos o SSL liga", db_ssl.is_enabled("certs/ca.crt", "certs/client.pem", "certs/client.key") is True)
    check("configuracao PARCIAL tambem liga o SSL (a falta de arquivo erra alto em vez de conectar sem seguranca)", db_ssl.is_enabled("certs/ca.crt", "", "") is True)
    import tempfile
    from pathlib import Path as _P
    with tempfile.TemporaryDirectory() as tmp:  # arquivos de mentira so' para o caminho existir
        paths = []
        for nome in ("ca.crt", "client.pem", "client.key"):
            f = _P(tmp) / nome
            f.write_text("x")
            paths.append(str(f))
        args = db_ssl.libpq_args(*paths, verify_hostname=False)
        check("libpq: verify-ca por padrao e caminhos absolutos",
              args["sslmode"] == "verify-ca" and all(args[k].startswith("/") for k in ("sslrootcert", "sslcert", "sslkey")), str(args))
        check("libpq: verify-full quando pedir verificacao do nome do servidor",
              db_ssl.libpq_args(*paths, verify_hostname=True)["sslmode"] == "verify-full")
    with tempfile.TemporaryDirectory() as tmp:  # chave com permissao aberta (0644) vira copia 0600 para o libpq
        chave = _P(tmp) / "k.key"
        chave.write_text("x")
        chave.chmod(0o644)
        usada = db_ssl.private_key_for_libpq(str(chave))
        check("chave 0644 vira copia privada 0600 (o libpq recusaria a original)",
              usada != str(chave) and (_P(usada).stat().st_mode & 0o077) == 0)
    try:
        db_ssl.libpq_args("nao/existe.crt", "nao/existe.pem", "nao/existe.key")
        check("certificado inexistente erra alto", False)
    except FileNotFoundError:
        check("certificado inexistente erra alto (nunca conecta sem seguranca em silencio)", True)

    secao("22) Editar o nome (nick) da equipe: so' S.Adm, e o login do Discord nao desfaz")
    alvo = creator2
    r = await c.patch(f"/staff/{alvo.id}/name", json={"username": "Nick Novo"}, headers=S)
    check("S.Adm troca o nome de um membro", r.status_code == 200 and r.json()["username"] == "Nick Novo", r.text)
    r = await c.patch(f"/staff/{sadm.id}/name", json={"username": "  Meu   Nome  S.Adm "}, headers=S)
    check("S.Adm troca o PROPRIO nome (espacos extras limpos)", r.status_code == 200 and r.json()["username"] == "Meu Nome S.Adm", r.text)
    check("/auth/me ja' mostra o nome novo", (await c.get("/auth/me", headers=S)).json()["username"] == "Meu Nome S.Adm")
    check("nome vazio -> 422", (await c.patch(f"/staff/{alvo.id}/name", json={"username": "   "}, headers=S)).status_code == 422)
    check("nome com mais de 100 caracteres -> 422", (await c.patch(f"/staff/{alvo.id}/name", json={"username": "a" * 101}, headers=S)).status_code == 422)
    check("Adm nao troca nome (rota exclusiva do S.Adm = 404)", (await c.patch(f"/staff/{alvo.id}/name", json={"username": "x"}, headers=A)).status_code == 404)
    check("Creator nao troca nome", (await c.patch(f"/staff/{alvo.id}/name", json={"username": "x"}, headers=C)).status_code == 404)
    check("anonimo nao troca nome", (await c.patch(f"/staff/{alvo.id}/name", json={"username": "x"})).status_code == 401)
    check("membro inexistente -> 404", (await c.patch("/staff/00000000-0000-0000-0000-000000000000/name", json={"username": "x"}, headers=S)).status_code == 404)
    settings.discord_client_id, settings.discord_client_secret = "id-teste", "segredo-teste"
    r = await c.get("/auth/discord/login")
    st = r.headers["location"].split("state=")[1].split("&")[0]
    perfil_novo = {"id": IDS["creator2"], "username": "Nome do Discord", "avatar_url": None}
    with patch("app.core.discord.exchange_code", return_value="tok"), patch("app.core.discord.fetch_profile", return_value=perfil_novo):
        await c.get(f"/auth/discord/callback?code=abc&state={st}", headers={"Cookie": f"{STATE_COOKIE}={st}"})
    check("login do Discord NAO sobrescreve o nome editado a mao", (await recarregar(alvo)).username == "Nick Novo")
    async with AsyncSessionLocal() as db:
        ok = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.action == "rename", AuditLogEntry.entity_id == str(IDS["creator2"])))).scalars().first()
    check("a troca de nome fica no log de auditoria", ok is not None and ok.diff.get("after") == "Nick Novo")

    secao("23) Jutsu: ficha completa (tier maximo 4) e limpar o log (so' S.Adm)")
    base_j = {"id": f"{SLUG}-jf", "name": "TESTE Jutsu Ficha", "masteryId": "fire", "tier": 2, "chakraCost": 25,
              "description": "d", "longDescription": "l", "icon": "flame"}
    r = await c.post("/jutsus", json={**base_j, "tier": 5}, headers=A)
    check("tier 5 e' recusado (maximo 4)", r.status_code == 422)
    r = await c.post("/jutsus", json={**base_j, "tier": 0}, headers=A)
    check("tier 0 e' recusado", r.status_code == 422)
    ficha = {**base_j, "tier": 4, "requiredLevel": "20+", "requiredStat": "35 Intellect", "scrollType": "Sealable Scroll",
             "shop": "Any", "maxLevel": 3, "damageByLevel": ["6", "6", "8"], "cooldownByLevel": ["16s", "14s", "14s"],
             "castTime": "1 Second", "castType": "Walk cast", "effect": "Burn", "jutsuClass": "Trap",
             "range": "3 Tiles in front of caster", "debuff": "Burn III"}
    r = await c.post("/jutsus", json=ficha, headers=A)
    check("Adm cria jutsu com a ficha completa (tier 4)", r.status_code == 201, r.text[:160])
    j = r.json()
    check("campos da ficha voltam certinhos", j["requiredLevel"] == "20+" and j["maxLevel"] == 3 and j["damageByLevel"] == ["6", "6", "8"]
          and j["cooldownByLevel"] == ["16s", "14s", "14s"] and j["jutsuClass"] == "Trap" and j["debuff"] == "Burn III", str(j)[:200])
    r = await c.get(f"/jutsus/{SLUG}-jf")
    check("a ficha tambem vem na leitura publica", r.status_code == 200 and r.json()["castType"] == "Walk cast")
    r = await c.post("/jutsus", json={**base_j, "id": f"{SLUG}-jg"}, headers=A)
    check("jutsu simples (sem a ficha) continua valido, com padroes vazios", r.status_code == 201 and r.json()["maxLevel"] == 1 and r.json()["damageByLevel"] == [], r.text[:120])
    r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "tier": 3, "maxLevel": 11}, headers=A)
    check("nivel maximo acima de 10 e' recusado", r.status_code == 422)
    r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "damageByLevel": ["x" * 41]}, headers=A)
    check("valor por nivel acima de 40 caracteres e' recusado", r.status_code == 422)
    r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "debuff": "Burn IV"}, headers=A)
    check("editar a ficha salva", r.status_code == 200 and r.json()["debuff"] == "Burn IV")
    await c.delete(f"/jutsus/{SLUG}-jf", headers=A)
    await c.delete(f"/jutsus/{SLUG}-jg", headers=A)

    # limpar o log
    async with AsyncSessionLocal() as db:
        db.add(AuditLogEntry(action="create", entity_type="content_item", entity_id=f"{SLUG}-velho", actor_name="TESTE_velho",
                             source="panel", created_at=datetime.now(timezone.utc) - timedelta(days=4000)))
        await db.commit()
    check("Adm nao limpa o log (rota exclusiva do S.Adm = 404)", (await c.delete("/audit-log?olderThanDays=3650", headers=A)).status_code == 404)
    check("Creator nao limpa o log", (await c.delete("/audit-log?olderThanDays=3650", headers=C)).status_code == 404)
    c.cookies.clear()  # o cliente de teste guarda cookies de logins anteriores
    check("anonimo nao limpa o log", (await c.delete("/audit-log?olderThanDays=3650")).status_code == 401)
    check("dias invalidos -> 422", (await c.delete("/audit-log?olderThanDays=0", headers=S)).status_code == 422)
    r = await c.delete("/audit-log?olderThanDays=3650", headers=S)
    check("S.Adm limpa o log mais antigo que N dias", r.status_code == 200 and r.json()["deleted"] >= 1, r.text)
    async with AsyncSessionLocal() as db:
        velho = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.entity_id == f"{SLUG}-velho"))).scalars().first()
        marca = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.action == "clear_log").order_by(AuditLogEntry.created_at.desc()))).scalars().first()
    check("o registro antigo sumiu e a limpeza ficou registrada no log", velho is None and marca is not None and marca.diff.get("older_than_days") == 3650)

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
