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
import re
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
from scripts._guarda_banco import exigir_banco_local
from app.models.enums import StaffRole
from app.models.users import AuditLogEntry, User

exigir_banco_local(settings.database_url)   # nunca roda contra o banco da SquareCloud (o teste apaga dados)
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


UA_NAVEGADOR = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def _hash_visitante_teste() -> str:
    """Hash do visitante usado nos testes de acessos (para apagar no final)."""
    from app.api.analytics import _visitor_hash
    return _visitor_hash(datetime.now(timezone.utc).date(), "203.0.113.9", UA_NAVEGADOR)


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


async def recarregar_por_id(user_id) -> User:
    """Le um usuario do banco pelo id."""
    async with AsyncSessionLocal() as db:
        return await db.get(User, user_id)


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
    ("GET", "/tags"), ("GET", "/announcement"),   # anuncio da Home: leitura publica; escrever exige announcement.manage
    ("POST", "/analytics/hit"),    # a visita avisa o site (origem + limite por IP + ignora robos; guarda so' contagens)
    # engajamento: leitura publica; escrita exige LEITOR logado (cookie proprio, ver reader_auth.py)
    ("GET", "/posts/{slug}/engagement"), ("GET", "/posts/{slug}/comments"),
    ("PUT", "/posts/{slug}/like"), ("DELETE", "/posts/{slug}/like"),
    ("POST", "/posts/{slug}/comments"), ("DELETE", "/posts/{slug}/comments/{comment_id}"),
    ("GET", "/auth/reader/me"), ("POST", "/auth/reader/logout"), ("POST", "/auth/reader/dev-login"),
    ("GET", "/professions"), ("GET", "/ninja-ranks"), ("GET", "/story-arcs"), ("GET", "/summons"),
    # escrita "publica" de proposito: cada uma tem a sua propria protecao
    ("POST", "/auth/dev-login"),   # so' funciona em development + confere a origem
    ("POST", "/auth/logout"),      # sem sessao so' limpa o cookie
    ("POST", "/reports"),           # visitante avisa conteudo desatualizado / erro de traducao (origem + limites + isca + alvo conferido)
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
        await db.execute(text("DELETE FROM traffic_daily WHERE country = 'QQ'"))
        await db.execute(text("DELETE FROM traffic_places WHERE country = 'QR'"))   # lugares do teste (estado/cidade)
        await db.execute(text("DELETE FROM traffic_daily WHERE country = 'QR'"))
        await db.execute(text("DELETE FROM traffic_pages WHERE path LIKE :p"), {"p": f"/{SLUG}%"})
        await db.execute(text("DELETE FROM traffic_visitors WHERE visitor_hash = :h"), {"h": _hash_visitante_teste()})
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
            | (AuditLogEntry.entity_id.in_(TESTE_IDS_TEXTO)) | (AuditLogEntry.entity_id.like(f"{SLUG}%")) | (AuditLogEntry.entity_id.like("TESTE%"))))
        await db.execute(delete(User).where(User.discord_id.in_([int(x) for x in TESTE_IDS_TEXTO])))
        await db.execute(text("DELETE FROM custom_roles WHERE name LIKE 'TESTE%'"))
        await db.execute(text("DELETE FROM media_images WHERE uploaded_by LIKE 'TESTE_%' OR filename LIKE :p"), {"p": f"{SLUG}%"})
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
    r = await c.post("/content-items", json={**novo_conteudo("auth"), "category": "items", "itemType": "authority", "rarity": "enchanted", "maxStack": 500}, headers=C)
    check("item tipo Authority com raridade Enchanted e stack 500 e' criado", r.status_code == 201 and r.json()["itemType"] == "authority" and r.json()["rarity"] == "enchanted" and r.json()["maxStack"] == 500, r.text[:200])
    r = await c.post("/content-items", json={**novo_conteudo("acess"), "category": "items", "itemType": "accessory", "level": 12}, headers=C)
    check("item tipo Accessory (junto com os Rings) e' criado", r.status_code == 201 and r.json()["itemType"] == "accessory", r.text[:200])
    for i, roupa in enumerate(["shirt", "vest", "pant", "hat", "mask", "shoe"]):
        r = await c.post("/content-items", json={**novo_conteudo(f"roupa{i}"), "category": "items", "itemType": roupa, "level": 5}, headers=C)
        check(f"item tipo {roupa} (pecas de roupa, junto com os Rings) e' criado", r.status_code == 201 and r.json()["itemType"] == roupa, r.text[:160])
    r = await c.post("/content-items", json={**novo_conteudo("drop-item"), "category": "items", "rarity": "epic"}, headers=C)
    drop_item_id = r.json()["id"]
    r = await c.post("/content-items", json={**novo_conteudo("drop-mob"), "category": "mobs", "drops": [
        {"itemName": "Ligado", "chance": 10, "droppedItemId": drop_item_id, "rarity": "common"},
        {"itemName": "So texto", "chance": 5}]}, headers=C)
    check("drop sem raridade e' aceito; com item ligado vale a raridade DO ITEM (epic), mesmo se mandarem outra", r.status_code == 201
          and r.json()["drops"][0]["rarity"] == "epic", r.text[:240])
    check("drop so' texto (sem item ligado) fica Common", r.json()["drops"][1]["rarity"] == "common")
    mob_id = r.json()["id"]
    r = await c.put(f"/content-items/{drop_item_id}", json={**novo_conteudo("drop-item"), "category": "items", "rarity": "rare", "attributes": [], "drops": []}, headers=A)
    r = await c.get(f"/content-items/{mob_id}", headers=C)
    check("mudou a raridade do item: o drop acompanha (rare) sem editar o mob", r.status_code == 200 and r.json()["drops"][0]["rarity"] == "rare", r.text[:200])
    # Historico de versoes: cada edicao guarda o estado anterior; restaurar volta a versao (e tambem entra no historico)
    r = await c.get(f"/content-items/{drop_item_id}", headers=A)
    nome_original = r.json()["name"]
    corpo_hist = {**novo_conteudo("drop-item"), "category": "items", "rarity": "rare", "attributes": [], "drops": []}
    await c.put(f"/content-items/{drop_item_id}", json={**corpo_hist, "name": "Nome Novo Do Historico"}, headers=A)
    r = await c.get(f"/content-items/{drop_item_id}/versions", headers=A)
    versoes = r.json() if r.status_code == 200 else []
    check("edicao guarda a versao anterior no historico (nome antigo, quem editou)", len(versoes) >= 1 and versoes[0]["name"] == nome_original and versoes[0]["savedBy"], r.text[:240])
    r = await c.get(f"/content-items/{drop_item_id}/versions")
    check("anonimo NAO ve o historico (401)", r.status_code == 401)
    r = await c.post(f"/content-items/{drop_item_id}/versions/{versoes[0]['id']}/restore", headers=A)
    check("restaurar volta o nome antigo", r.status_code == 200 and r.json()["name"] == nome_original, r.text[:200])
    r = await c.get(f"/content-items/{drop_item_id}/versions", headers=A)
    check("restaurar tambem entra no historico (da' para desfazer)", len(r.json()) == len(versoes) + 1 and r.json()[0]["name"] == "Nome Novo Do Historico", r.text[:240])
    r = await c.post(f"/content-items/{drop_item_id}/versions/00000000-0000-0000-0000-000000000000/restore", headers=A)
    check("versao inexistente (404)", r.status_code == 404)
    # "Dropado por": automatico - o item lista os mobs PUBLICADOS que o ligam (ou citam pelo nome) nos drops
    r = await c.get(f"/content-items/{drop_item_id}", headers=C)
    check("item NAO lista mob em rascunho como 'dropado por'", r.status_code == 200 and r.json()["droppedBy"] == [], r.text[:200])
    item_nome = r.json()["name"]
    r = await c.put(f"/content-items/{mob_id}", json={**novo_conteudo("drop-mob"), "category": "mobs", "status": "published", "drops": [
        {"itemName": "Ligado", "chance": 10, "droppedItemId": drop_item_id}]}, headers=A)
    check("admin publica o mob com drop ligado", r.status_code == 200, r.text[:160])
    await c.put(f"/content-items/{drop_item_id}", json={**novo_conteudo("drop-item"), "category": "items", "rarity": "rare", "status": "published", "attributes": [], "drops": []}, headers=A)   # o item tambem precisa estar publicado para o anonimo ve-lo
    r = await c.get(f"/content-items/{drop_item_id}")
    db_mobs = r.json().get("droppedBy", [])
    check("item mostra o mob publicado que o dropa (automatico, chance 10)", len(db_mobs) == 1 and db_mobs[0]["slug"] == f"{SLUG}-drop-mob" and db_mobs[0]["chance"] == 10, r.text[:240])
    r = await c.post("/content-items", json={**novo_conteudo("drop-mob2"), "category": "mobs", "drops": [
        {"itemName": item_nome, "chance": 3}]}, headers=C)
    mob2_id = r.json()["id"]
    await c.put(f"/content-items/{mob2_id}", json={**novo_conteudo("drop-mob2"), "category": "mobs", "status": "published", "drops": [
        {"itemName": item_nome, "chance": 3}]}, headers=A)
    r = await c.get(f"/content-items/slug/{SLUG}-drop-item")
    check("drop so' com o NOME do item (sem ligacao) tambem conta como 'dropado por'", len(r.json().get("droppedBy", [])) == 2, r.text[:240])
    r = await c.post("/content-items", json={**novo_conteudo("pack"), "category": "items", "itemType": "pack"}, headers=C)
    check("item tipo Pack (catalogo Pack) e' criado", r.status_code == 201 and r.json()["itemType"] == "pack", r.text[:160])
    r = await c.post("/content-items", json={**novo_conteudo("unico"), "category": "weapons", "rarity": "unique"}, headers=C)
    check("raridade Unique e' aceita (arma com etiqueta vermelha Unique)", r.status_code == 201 and r.json()["rarity"] == "unique", r.text[:160])
    r = await c.post("/content-items", json={**novo_conteudo("req3"), "category": "weapons", "weaponRequirement": " 60 Agility \n\n 20   Chakra\n30 Strength "}, headers=C)
    check("arma com 3 requisitos (um por linha): salva limpo, sem linhas vazias nem espacos extras", r.status_code == 201 and r.json()["weaponRequirement"] == "60 Agility\n20 Chakra\n30 Strength", r.text[:200])
    r = await c.post("/content-items", json={**novo_conteudo("req4"), "category": "weapons", "weaponRequirement": "a\nb\nc\nd"}, headers=C)
    check("mais de 3 requisitos e' recusado (422)", r.status_code == 422)
    r = await c.post("/content-items", json={**novo_conteudo("req0"), "category": "weapons", "weaponRequirement": "  \n "}, headers=C)
    check("so' linhas vazias = sem requisito (null)", r.status_code == 201 and r.json()["weaponRequirement"] is None, r.text[:160])
    r = await c.post("/content-items", json={**novo_conteudo("evento"), "category": "items", "rarity": "event"}, headers=C)
    check("raridade Event (itens de evento) e' aceita", r.status_code == 201 and r.json()["rarity"] == "event", r.text[:160])
    r = await c.post("/content-items", json={**novo_conteudo("rar-ruim"), "rarity": "mitico"}, headers=C)
    check("raridade inexistente continua recusada (422)", r.status_code == 422)
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
    secao("11) API do Bot: so' leitura/backup, token obrigatorio e NENHUMA rota de gestao da equipe")
    DESDE_BOT = "2000-01-01T00:00:00+00:00"
    settings.bot_api_token = ""
    r = await c.get("/bot/errors", params={"since": DESDE_BOT})
    check("sem BOT_API_TOKEN configurado a rota nem existe (404)", r.status_code == 404)
    settings.bot_api_token = "token-de-teste-do-bot"
    B = {"X-Bot-Token": settings.bot_api_token}
    r = await c.get("/bot/errors", params={"since": DESDE_BOT})
    check("sem header X-Bot-Token (401)", r.status_code == 401)
    r = await c.get("/bot/errors", params={"since": DESDE_BOT}, headers={"X-Bot-Token": "errado"})
    check("token do bot errado (401)", r.status_code == 401)
    r = await c.get("/bot/errors", params={"since": DESDE_BOT}, headers=B)
    check("token certo le a lista de erros (200)", r.status_code == 200)
    for metodo, rota in (("GET", f"/bot/me?invokerDiscordId={IDS['sadm']}"), ("GET", f"/bot/staff?invokerDiscordId={IDS['sadm']}"),
                         ("POST", "/bot/staff"), ("POST", "/bot/audit-log/clear"),
                         ("PATCH", f"/bot/staff/{BASE + 12}/role"), ("POST", f"/bot/staff/{BASE + 12}/deactivate")):
        r = await c.request(metodo, rota, headers=B, json={} if metodo != "GET" else None)
        check(f"{metodo} {rota.split('?')[0]}: gestao da equipe pelo Discord foi REMOVIDA (404/405)", r.status_code in (404, 405), f"veio {r.status_code}")

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
        consulta = "/bot/errors"
        async with cliente("198.51.100.15") as x:
            codigos = [(await x.get(consulta, params={"since": DESDE_BOT}, headers={"X-Bot-Token": f"chute-{i}"})).status_code for i in range(10)]
            check("bot: 10 tokens errados dao 401", codigos == [401] * 10, str(codigos))
            r = await x.get(consulta, params={"since": DESDE_BOT}, headers={"X-Bot-Token": "mais-um-chute"})
            check("o 11o ja' e' 429 (bloqueado)", r.status_code == 429 and "Too many attempts" in r.json()["detail"], f"{r.status_code}")
            r = await x.get(consulta, params={"since": DESDE_BOT}, headers=certo)
            check("...e enquanto bloqueado nem o token CERTO passa (429)", r.status_code == 429)
            relogio.t += 11 * 60
            r = await x.get(consulta, params={"since": DESDE_BOT}, headers=certo)
            check("passada a janela (10 min) o token certo volta a funcionar", r.status_code == 200, f"{r.status_code}")
        async with cliente("198.51.100.16") as y:
            r = await y.get(consulta, params={"since": DESDE_BOT}, headers=certo)
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

    secao("23) Jutsu: ficha completa (tier maximo 5) e limpar o log (so' S.Adm)")
    base_j = {"id": f"{SLUG}-jf", "name": "TESTE Jutsu Ficha", "masteryId": "fire", "tier": 2, "chakraCost": 25,
              "description": "d", "longDescription": "l", "icon": "flame"}
    r = await c.post("/jutsus", json={**base_j, "id": f"{SLUG}-t5", "tier": 5}, headers=A)
    check("tier 5 e' aceito (maximo 5)", r.status_code == 201 and r.json()["tier"] == 5, r.text[:120])
    r = await c.post("/jutsus", json={**base_j, "tier": 6}, headers=A)
    check("tier 6 e' recusado (maximo 5)", r.status_code == 422)
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
    r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "nameByLevel": ["", "  ", "", "Great   Fireball"]}, headers=A)
    check("nome por nivel (ex.: muda no nivel 4) e' salvo, com espacos limpos", r.status_code == 200 and r.json()["nameByLevel"] == ["", "", "", "Great Fireball"], r.text[:200])
    r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "nameByLevel": ["", " "]}, headers=A)
    check("so' nomes vazios viram lista vazia (o nome nao muda)", r.status_code == 200 and r.json()["nameByLevel"] == [])
    r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "nameByLevel": ["x" * 101]}, headers=A)
    check("nome por nivel acima de 100 caracteres e' recusado", r.status_code == 422)
    check("jutsu sem nome por nivel volta lista vazia", (await c.get(f"/jutsus/{SLUG}-jg")).json()["nameByLevel"] == [])

    async def deepl_nivel(textos: list[str], reverse: bool = False) -> list[str]:
        """DeepL de mentira: poe 'PT:' na frente."""
        return [("EN:" if reverse else "PT:") + t for t in textos]

    with patch("app.core.translation._deepl_translate_batch", new=deepl_nivel):
        r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "nameByLevel": ["", "", "", "Triple Phoenix Fireball Technique"]}, headers=A)
        check("nome por nivel e' traduzido pela DeepL ao salvar", r.status_code == 200 and r.json()["nameByLevelPt"] == ["", "", "", "PT:Triple Phoenix Fireball Technique"], r.text[:240])
        r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "nameByLevel": ["", "", "", "Triple Phoenix Fireball Technique"], "nameByLevelPt": ["", "", "", "Tecnica Manual"]}, headers=A)
        check("traducao digitada a mao vale", r.json()["nameByLevelPt"][3] == "Tecnica Manual", r.text[:240])
        r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "nameByLevel": ["", "", "", "Triple Phoenix Fireball Technique"]}, headers=A)
        check("salvar de novo SEM mexer no nome mantem a traducao que ja' existe", r.json()["nameByLevelPt"][3] == "Tecnica Manual", r.text[:240])
        r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "nameByLevel": ["", "", "", "Great Fireball"]}, headers=A)
        check("trocar o nome em ingles retraduz", r.json()["nameByLevelPt"][3] == "PT:Great Fireball", r.text[:240])
        r = await c.post(f"/jutsus/{SLUG}-jf/retranslate", headers=A)
        check("Retraduzir tambem refaz o nome por nivel", r.status_code == 200 and r.json()["nameByLevelPt"][3] == "PT:Great Fireball", r.text[:200])

    # categoria Utility: jutsu SEM mastery (qualquer pessoa pode usar)
    util = {**base_j, "id": f"{SLUG}-util", "name": "TESTE Utility", "masteryId": None}
    r = await c.post("/jutsus", json=util, headers=A)
    check("jutsu de Utilidade (sem mastery) e' criado", r.status_code == 201 and r.json()["masteryId"] is None, r.text[:200])
    r = await c.post("/jutsus", json={**util, "id": f"{SLUG}-util2", "pathId": "qualquer"}, headers=A)
    check("jutsu de Utilidade nao pode ter caminho (400)", r.status_code == 400, r.text[:160])
    sem_campo = {k: v for k, v in util.items() if k != "masteryId"}
    r = await c.post("/jutsus", json={**sem_campo, "id": f"{SLUG}-util3"}, headers=A)
    check("esquecer o masteryId no corpo continua sendo erro (422): so' null explicito vira Utilidade", r.status_code == 422)
    lista = (await c.get("/jutsus", params={"utility": "true"})).json()
    check("filtro ?utility=true lista so' os jutsus sem mastery", any(j["id"] == f"{SLUG}-util" for j in lista) and all(j["masteryId"] is None for j in lista), str(lista)[:160])
    todos_fire = (await c.get("/jutsus", params={"masteryId": "fire"})).json()
    check("o filtro por mastery nao traz os de Utilidade", not any(j["id"] == f"{SLUG}-util" for j in todos_fire))
    r = await c.put(f"/jutsus/{SLUG}-util", json={**util, "name": "TESTE Utility 2"}, headers=A)
    check("editar jutsu de Utilidade funciona", r.status_code == 200 and r.json()["masteryId"] is None, r.text[:160])

    # Jutsu NPC: versao do jutsu usada por NPC (secao propria)
    npc_j = {**base_j, "id": f"{SLUG}-npc", "name": "TESTE Jutsu NPC", "isNpc": True, "allowedWeapons": " Blunt "}
    r = await c.post("/jutsus", json=npc_j, headers=A)
    check("Jutsu NPC e' criado, com 'armas permitidas' limpas", r.status_code == 201 and r.json()["isNpc"] is True and r.json()["allowedWeapons"] == "Blunt", r.text[:200])
    check("jutsu comum nasce com isNpc=false e sem armas permitidas", (await c.get(f"/jutsus/{SLUG}-jf")).json()["isNpc"] is False)
    so_npc = (await c.get("/jutsus", params={"npc": "true"})).json()
    sem_npc = (await c.get("/jutsus", params={"npc": "false"})).json()
    check("?npc=true lista so' os de NPC e ?npc=false tira eles da lista", any(j["id"] == f"{SLUG}-npc" for j in so_npc) and all(j["isNpc"] for j in so_npc)
          and not any(j["id"] == f"{SLUG}-npc" for j in sem_npc) and any(j["id"] == f"{SLUG}-jf" for j in sem_npc))

    # ataques do mob ligados a um jutsu do catalogo
    jf = (await c.get(f"/jutsus/{SLUG}-jf")).json()
    r = await c.post("/content-items", json={**novo_conteudo("mob-atk"), "category": "mobs", "attacks": [
        {"jutsuId": f"{SLUG}-jf"}, {"name": "  Golpe   livre "}]}, headers=C)
    check("mob com ataque ligado a um jutsu (sem digitar nome) e ataque so' texto: criado", r.status_code == 201, r.text[:200])
    atk = r.json()["attacks"]
    check("ataque ligado: o nome vem do jutsu e traz a mastery para o link", atk[0]["name"] == jf["name"] and atk[0]["jutsuId"] == f"{SLUG}-jf" and atk[0]["masteryId"] == jf["masteryId"], str(atk[0]))
    check("ataque so' texto continua igual (nome limpo, sem jutsu)", atk[1]["name"] == "Golpe livre" and atk[1]["jutsuId"] is None, str(atk[1]))
    mob_atk_id = r.json()["id"]
    r = await c.post("/content-items", json={**novo_conteudo("mob-atk2"), "category": "mobs", "attacks": [{"name": "  "}]}, headers=C)
    check("ataque sem nome e sem jutsu e' recusado (422)", r.status_code == 422)
    r = await c.post("/content-items", json={**novo_conteudo("mob-atk3"), "category": "mobs", "attacks": [{"jutsuId": "nao-existe-xyz"}]}, headers=C)
    check("ataque ligado a jutsu que nao existe e' recusado (400)", r.status_code == 400, r.text[:160])
    r = await c.put(f"/jutsus/{SLUG}-jf", json={**ficha, "name": "Renomeado Ao Vivo"}, headers=A)
    r = await c.get(f"/content-items/{mob_atk_id}", headers=C)
    check("renomeou o jutsu: o ataque do mob acompanha (ao vivo)", r.json()["attacks"][0]["name"] == "Renomeado Ao Vivo", r.text[:200])
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

    secao("26) Cargos personalizados: criar, dar, editar, apagar - e nunca mais poder do que foi liberado")
    rn = f"TESTE{BASE % 100000}"
    r = await c.post("/roles/custom", json={"name": rn + "a", "color": "#22c55e", "description": "so' publica conteudo", "permissions": ["content.create", "content.edit", "content.publish"]}, headers=A)
    check("Adm NAO cria cargo (404, como se nao existisse)", r.status_code == 404)
    r = await c.post("/roles/custom", json={"name": rn + "a", "color": "#22c55e", "description": "so' publica conteudo", "permissions": ["content.create", "content.edit", "content.publish"]}, headers=S)
    check("S.Adm cria cargo personalizado", r.status_code == 201 and any(x["name"] == rn + "a" and x["members"] == 0 for x in r.json()["customRoles"]), r.text[:200])
    papel_a = next(x for x in r.json()["customRoles"] if x["name"] == rn + "a")["id"]
    for corpo, esperado, nome in [
        ({"name": rn + "b", "permissions": ["staff.view"]}, 400, "permissao exclusiva do S.Adm e' recusada"),
        ({"name": rn + "b", "permissions": ["nao.existe"]}, 422, "permissao desconhecida e' recusada"),
        ({"name": rn + "b", "color": "red;position:fixed"}, 422, "cor fora do formato #rrggbb e' recusada (injecao de CSS)"),
        ({"name": "Adm", "permissions": []}, 409, "nome igual ao de um cargo de fabrica e' recusado"),
        ({"name": (rn + "A").lower(), "permissions": []}, 409, "nome repetido (sem diferenciar maiusculas) e' recusado"),
        ({"name": "   ", "permissions": []}, 422, "nome vazio e' recusado"),
    ]:
        r = await c.post("/roles/custom", json=corpo, headers=S)
        check(nome, r.status_code == esperado, f"{r.status_code} {r.text[:120]}")

    novo = await c.post("/staff", json={"discordId": str(BASE + 26), "role": "creator", "username": "TESTE_cr", "customRoleId": papel_a}, headers=S)
    check("S.Adm cadastra alguem JA' com o cargo personalizado", novo.status_code == 201 and novo.json()["roleLabel"] == rn + "a" and novo.json()["customRole"]["name"] == rn + "a", novo.text[:200])
    r = await c.post("/staff", json={"discordId": str(BASE + 27), "role": "admin", "username": "x", "customRoleId": papel_a}, headers=S)
    check("cargo personalizado so' combina com o Creator base (Adm + personalizado = 422)", r.status_code == 422, r.text[:120])
    r = await c.post("/staff", json={"discordId": str(BASE + 27), "role": "creator", "username": "x", "customRoleId": "00000000-0000-0000-0000-000000000000"}, headers=S)
    check("cargo personalizado que nao existe e' recusado", r.status_code == 422)

    r = await c.patch(f"/staff/{creator2.id}/role", json={"role": "creator", "customRoleId": papel_a}, headers=S)
    check("S.Adm troca alguem para o cargo personalizado", r.status_code == 200 and r.json()["roleLabel"] == rn + "a", r.text[:160])
    C2 = cookie(await recarregar(creator2))
    me = (await c.get("/auth/me", headers=C2)).json()
    check("/auth/me mostra o nome do cargo e SO' as permissoes dele (nao as do Creator)",
          me["roleLabel"] == rn + "a" and sorted(me["permissions"]) == ["content.create", "content.edit", "content.publish"] and me["customRole"]["color"] == "#22c55e", str(me))
    r = await c.post("/content-items", json=novo_conteudo("cargo1"), headers=C2)
    check("o cargo com content.create cria rascunho", r.status_code == 201, r.text[:160])
    cargo_id = r.json()["id"]
    r = await c.put(f"/content-items/{cargo_id}", json=novo_conteudo("cargo1", "published"), headers=C2)
    check("o cargo com content.publish PUBLICA", r.status_code == 200 and r.json()["status"] == "published", f"{r.status_code} {r.text[:160]}")
    await c.post("/roles/creator/permissions/reset", headers=S)  # testes anteriores podem ter ajustado o Creator
    Cc = cookie(await recarregar(creator))
    r = await c.post("/content-items", json=novo_conteudo("cargo2"), headers=Cc)
    rasc2 = r.json()["id"]
    r = await c.put(f"/content-items/{rasc2}", json=novo_conteudo("cargo2", "published"), headers=Cc)
    check("Creator comum continua sem publicar (403)", r.status_code == 403, f"{r.status_code} {r.text[:100]}")
    r = await c.post("/uploads/image", files={"file": ("a.png", b"x", "image/png")}, headers=C2)
    check("o cargo NAO ganha o que nao foi liberado (sem uploads.create = 403)", r.status_code == 403, str(r.status_code))
    check("cargo personalizado nunca enxerga a area da equipe (404)", (await c.get("/staff", headers=C2)).status_code == 404 and (await c.get("/roles/permissions", headers=C2)).status_code == 404)

    r = await c.put(f"/roles/custom/{papel_a}", json={"name": rn + "a", "color": "#22c55e", "description": "so' escreve", "permissions": ["posts.create"]}, headers=S)
    check("S.Adm edita as permissoes do cargo", r.status_code == 200, r.text[:160])
    me = (await c.get("/auth/me", headers=C2)).json()
    check("a edicao vale na hora para quem tem o cargo", me["permissions"] == ["posts.create"], str(me["permissions"]))
    r = await c.post("/content-items", json=novo_conteudo("cargo3"), headers=C2)
    check("sem content.create o cargo editado nao cria entry", r.status_code == 403)

    # defesa em profundidade: mesmo se alguem escrever uma permissao exclusiva do S.Adm direto no banco, ela nao vale
    async with AsyncSessionLocal() as db:
        await db.execute(text("UPDATE custom_roles SET permissions = '[\"staff.view\", \"audit.clear\", \"posts.create\"]'::jsonb WHERE id = :i"), {"i": papel_a})
        await db.commit()
    me = (await c.get("/auth/me", headers=C2)).json()
    check("permissao exclusiva do S.Adm gravada 'por fora' no banco e' ignorada", me["permissions"] == ["posts.create"] and (await c.get("/staff", headers=C2)).status_code == 404, str(me["permissions"]))

    r = await c.delete(f"/roles/custom/{papel_a}", headers=S)
    check("nao apaga cargo que ainda tem gente (409)", r.status_code == 409 and "Move them" in r.json()["detail"], r.text[:160])
    r = await c.patch(f"/staff/{creator2.id}/role", json={"role": "creator"}, headers=S)
    check("tirar o cargo personalizado volta para o Creator comum", r.status_code == 200 and r.json()["roleLabel"] == "Creator" and r.json()["customRole"] is None, r.text[:160])
    novo_id = novo.json()["id"]
    await c.patch(f"/staff/{novo_id}/role", json={"role": "creator"}, headers=S)
    r = await c.delete(f"/roles/custom/{papel_a}", headers=S)
    check("sem ninguem usando, o cargo e' apagado", r.status_code == 200 and all(x["name"] != rn + "a" for x in r.json()["customRoles"]), r.text[:160])
    check("Adm nao edita nem apaga cargos (404)", (await c.delete(f"/roles/custom/{papel_a}", headers=A)).status_code == 404)
    async with AsyncSessionLocal() as db:
        logs = (await db.execute(select(AuditLogEntry.action).where(AuditLogEntry.entity_type == "roles", AuditLogEntry.entity_id == rn + "a"))).scalars().all()
    check("criar/editar/apagar cargo ficam no log", {"create", "update", "delete"} <= set(logs), str(logs))

    secao("27) Anuncio da Home: publico le, so' quem tem announcement.manage escreve")
    await c.delete("/announcement", headers=S)
    r = await c.get("/announcement")
    check("sem anuncio: publico recebe active=false (a Home fica sem nada)", r.status_code == 200 and r.json() == {"active": False, "message": "", "messagePt": None, "linkUrl": "", "linkLabel": "", "level": "info", "updatedAt": None, "updatedBy": None}, r.text)
    corpo = {"message": f"  {SLUG}   manutencao\n hoje  ", "linkUrl": "https://exemplo.com/aviso", "linkLabel": "Saiba mais", "level": "warning"}
    r = await c.put("/announcement", json=corpo)
    check("anonimo NAO publica anuncio (401)", r.status_code == 401)
    Cc2 = cookie(await recarregar(creator))
    r = await c.put("/announcement", json=corpo, headers=Cc2)
    check("Creator NAO publica anuncio (403)", r.status_code == 403)
    r = await c.put("/announcement", json=corpo, headers=A)
    check("Adm publica anuncio (texto normalizado em uma linha)", r.status_code == 200 and r.json()["active"] and r.json()["message"] == f"{SLUG} manutencao hoje" and r.json()["level"] == "warning", r.text[:200])
    pub = (await c.get("/announcement")).json()
    check("o publico ve o anuncio, o link e quem publicou", pub["active"] and pub["linkUrl"] == "https://exemplo.com/aviso" and pub["updatedBy"] == "TESTE_adm", str(pub))
    for link, nome in [("javascript:alert(1)", "link javascript: e' recusado"), ("//evil.com", "link //outro-site e' recusado"), ("data:text/html,x", "link data: e' recusado"), ("http://sem-https.com", "link http (sem s) e' recusado"), ("/a b", "link com espaco e' recusado")]:
        r = await c.put("/announcement", json={**corpo, "linkUrl": link}, headers=A)
        check(nome, r.status_code == 422, f"{r.status_code} {r.text[:100]}")
    r = await c.put("/announcement", json={**corpo, "linkUrl": "/blog"}, headers=A)
    check("link para uma pagina do proprio site (/blog) e' aceito", r.status_code == 200 and r.json()["linkUrl"] == "/blog")
    r = await c.put("/announcement", json={**corpo, "level": "hacker"}, headers=A)
    check("nivel desconhecido e' recusado", r.status_code == 422)
    r = await c.put("/announcement", json={**corpo, "message": "x" * 700}, headers=A)
    check("mensagem acima de 600 caracteres e' recusada", r.status_code == 422)
    r = await c.put("/announcement", json={**corpo, "messagePt": "Manutencao hoje (PT)"}, headers=A)
    check("traducao digitada a mao vale", r.status_code == 200 and r.json()["messagePt"] == "Manutencao hoje (PT)", r.text[:200])
    async def _fake(v, reverse=False):
        """DeepL de mentira para provar que a traducao automatica roda quando o texto muda."""
        return f"PT: {v}" if v else None
    with patch("app.api.announcement.translate_field", _fake):
        r = await c.put("/announcement", json={"message": f"{SLUG} novo texto", "level": "info"}, headers=A)
    check("texto novo sem traducao manual e' traduzido automaticamente", r.status_code == 200 and r.json()["messagePt"] == f"PT: {SLUG} novo texto", r.text[:200])
    r = await c.put("/announcement", json={"message": "   ", "level": "info"}, headers=A)
    check("mensagem vazia remove o anuncio", r.status_code == 200 and r.json()["active"] is False and (await c.get("/announcement")).json()["active"] is False)
    await c.put("/announcement", json={"message": f"{SLUG} de novo", "level": "success"}, headers=A)
    r = await c.delete("/announcement", headers=Cc2)
    check("Creator NAO remove anuncio (403)", r.status_code == 403)
    r = await c.delete("/announcement", headers=A)
    check("Adm remove o anuncio e a Home volta a ficar sem nada", r.status_code == 200 and (await c.get("/announcement")).json()["active"] is False)
    async with AsyncSessionLocal() as db:
        logs = (await db.execute(select(AuditLogEntry.action).where(AuditLogEntry.entity_type == "announcement"))).scalars().all()
    check("publicar e remover anuncio ficam no log", {"update", "clear"} <= set(logs), str(logs))
    await c.post("/roles/creator/permissions/reset", headers=S)

    secao("28) Banco de imagens: IDs, busca, uso nos campos de imagem, apagar e sincronizar a pasta")
    import io
    from PIL import Image as _Img
    from app.api.uploads import UPLOAD_DIR as _UPLOADS

    def _png(cor: tuple[int, int, int]) -> bytes:
        """PNG pequeno e valido (cor diferente = arquivo diferente)."""
        b = io.BytesIO()
        _Img.new("RGB", (40, 30), cor).save(b, "PNG")
        return b.getvalue()

    r = await c.get("/media")
    check("anonimo NAO ve o banco de imagens (401)", r.status_code == 401)
    Cm = cookie(await recarregar(creator))

    async def dar_envio_ao_creator() -> None:
        """Libera media.upload (envio pelo banco de imagens) ao Creator: por padrao so' o S.Adm envia."""
        atuais = (await c.get("/auth/me", headers=C)).json()["permissions"]
        await c.put("/roles/creator/permissions", json={"permissions": sorted(set(atuais) | {"media.upload"})}, headers=S)

    r = await c.post("/media", files={"file": ("x.png", _png((9, 9, 9)), "image/png")}, headers=Cm)
    check("Creator NAO envia pelo banco de imagens por padrao (403)", r.status_code == 403)
    r = await c.post("/media", files={"file": ("x.png", _png((9, 9, 9)), "image/png")}, headers=A)
    check("Adm NAO envia pelo banco de imagens por padrao (403)", r.status_code == 403)
    r = await c.post("/media", files={"file": ("sadm.png", _png((9, 9, 9)), "image/png")}, headers=S)
    check("S.Adm envia pelo banco de imagens (201)", r.status_code == 201)
    if r.status_code == 201:
        await c.delete(f"/media/{r.json()['id']}", params={"force": "true"}, headers=S)
    r = await c.post("/uploads/image", files={"file": ("campo.png", _png((8, 8, 8)), "image/png")}, headers=Cm)
    check("o envio pelos CAMPOS de imagem (uploads.create) continua liberado ao Creator", r.status_code == 200, r.text[:120])
    await dar_envio_ao_creator()
    check("S.Adm libera media.upload ao Creator e ele passa a enviar", (await c.post("/media", files={"file": ("y.png", _png((7, 7, 7)), "image/png")}, headers=Cm)).status_code == 201)
    r = await c.post("/media", files={"file": ("minha foto.png", _png((200, 10, 10)), "image/png")}, data={"name": f"{SLUG} vermelha"}, headers=Cm)
    check("Creator envia imagem e recebe um ID", r.status_code == 201 and isinstance(r.json()["id"], int) and r.json()["url"].endswith(".png") and r.json()["width"] == 40, r.text[:200])
    img = r.json()
    r = await c.post("/uploads/image", files={"file": ("b.png", _png((10, 200, 10)), "image/png")}, headers=Cm)
    check("o upload antigo (/uploads/image) tambem entra no banco e devolve o ID", r.status_code == 200 and isinstance(r.json().get("id"), int), r.text[:200])
    img2 = r.json()
    r = await c.post("/media", files={"file": ("x.png", b"nao e imagem", "image/png")}, headers=Cm)
    check("arquivo que nao e' imagem e' recusado", r.status_code == 415)
    r = await c.get(f"/media/{img['id']}", headers=Cm)
    check("GET /media/{id} devolve a imagem", r.status_code == 200 and r.json()["name"] == f"{SLUG} vermelha")
    check("ID inexistente = 404", (await c.get("/media/99999999", headers=Cm)).status_code == 404)
    for q, nome in [(f"{SLUG} verm", "busca por parte do nome"), (f"#{img['id']}", "busca por #ID"), (f"img:{img['id']}", "busca por img:ID"), (str(img["id"]), "busca pelo numero do ID")]:
        r = await c.get("/media", params={"q": q}, headers=Cm)
        check(nome, r.status_code == 200 and any(i["id"] == img["id"] for i in r.json()["items"]), r.text[:120])
    r = await c.get("/media", params={"limit": 1}, headers=Cm)
    check("paginacao respeita o limite e informa o total", len(r.json()["items"]) == 1 and r.json()["total"] >= 2)

    r = await c.patch(f"/media/{img['id']}", json={"name": "novo"}, headers=Cm)
    check("Creator NAO renomeia (403)", r.status_code == 403)
    r = await c.patch(f"/media/{img['id']}", json={"name": f"{SLUG} renomeada"}, headers=S)
    check("S.Adm renomeia a imagem", r.status_code == 200 and r.json()["name"] == f"{SLUG} renomeada")

    # usar o ID nos campos de imagem
    alvo = novo_conteudo("img1")
    for ref in (f"img:{img['id']}", f"#{img['id']}", str(img["id"]), f"IMG-{img['id']}"):
        r = await c.post("/content-items", json={**alvo, "slug": f"{SLUG}-img-{abs(hash(ref)) % 9999}", "image": ref}, headers=A)
        check(f"content: '{ref}' vira o endereco da imagem", r.status_code == 201 and r.json()["image"] == img["url"], f"{r.status_code} {r.text[:150]}")
    cid = r.json()["id"]
    r = await c.post("/content-items", json={**alvo, "slug": f"{SLUG}-img-url", "image": "https://exemplo.com/a.png"}, headers=A)
    check("endereco normal passa igual", r.status_code == 201 and r.json()["image"] == "https://exemplo.com/a.png")
    r = await c.post("/content-items", json={**alvo, "slug": f"{SLUG}-img-nao", "image": "img:99999999"}, headers=A)
    check("ID que nao existe e' recusado (422)", r.status_code == 422 and "not found" in r.json()["detail"], r.text[:150])
    r = await c.put(f"/content-items/{cid}", json={**alvo, "slug": f"{SLUG}-img-edit", "image": f"img:{img2['id']}"}, headers=A)
    check("content: editar tambem aceita o ID", r.status_code == 200 and r.json()["image"] == img2["url"], r.text[:150])
    r = await c.post("/posts", json={"slug": f"{SLUG}-capa", "title": "t", "excerpt": "e", "content": "c", "coverImage": f"#{img['id']}", "status": "draft", "tags": []}, headers=A)
    check("blog: capa aceita o ID", r.status_code == 201 and r.json()["coverImage"] == img["url"], f"{r.status_code} {r.text[:150]}")

    r = await c.get(f"/media/{img['id']}/usage", headers=Cm)
    check("Creator NAO ve o uso (403)", r.status_code == 403)
    r = await c.get(f"/media/{img['id']}/usage", headers=S)
    kinds = {u["kind"] for u in r.json()}
    check("o uso mostra o conteudo e o post que usam a imagem", r.status_code == 200 and {"content", "blog post"} <= kinds, r.text[:200])
    r = await c.delete(f"/media/{img['id']}", headers=Cm)
    check("Creator NAO apaga imagem (403)", r.status_code == 403)
    r = await c.delete(f"/media/{img['id']}", headers=S)
    check("imagem em uso nao e' apagada sem force (409)", r.status_code == 409 and "used in" in r.json()["detail"], r.text[:200])
    arquivo = _UPLOADS / img["url"].rsplit("/", 1)[1]
    check("o arquivo continua no disco apos o 409", arquivo.exists())
    r = await c.delete(f"/media/{img['id']}", params={"force": "true"}, headers=S)
    check("force=true apaga a imagem e o arquivo", r.status_code == 204 and not arquivo.exists() and (await c.get(f"/media/{img['id']}", headers=Cm)).status_code == 404)

    # sincronizar a pasta: arquivo que ja' estava em uploads/ sem ID
    solto = _UPLOADS / f"{SLUG}-solto.png"
    solto.write_bytes(_png((10, 10, 200)))
    r = await c.post("/media/sync", headers=Cm)
    check("Creator NAO sincroniza (403)", r.status_code == 403)
    r = await c.post("/media/sync", headers=S)
    check("sincronizar registra a imagem solta e ela ganha ID", r.status_code == 200 and r.json()["added"] >= 1, r.text)
    r = await c.get("/media", params={"limit": 200}, headers=Cm)
    solto_id = next((i["id"] for i in r.json()["items"] if i["url"].endswith(solto.name)), None)
    check("a imagem sincronizada aparece na lista", solto_id is not None)
    check("sincronizar de novo nao duplica", (await c.post("/media/sync", headers=S)).json()["added"] == 0)
    if solto_id is not None:
        await c.delete(f"/media/{solto_id}", headers=S)
    solto.unlink(missing_ok=True)
    r = await c.delete(f"/media/{img2['id']}", params={"force": "true"}, headers=S)
    check("apagar a outra imagem de teste (limpeza)", r.status_code == 204)
    await c.post("/roles/creator/permissions/reset", headers=S)

    secao("29) Remover alguem da equipe e apagar varias imagens de uma vez")
    nov = await c.post("/staff", json={"discordId": str(BASE + 28), "role": "creator", "username": "TESTE_remover"}, headers=S)
    nov_id = nov.json()["id"]
    r = await c.delete(f"/staff/{nov_id}", headers=A)
    check("Adm NAO remove ninguem da equipe (404, area exclusiva do S.Adm)", r.status_code == 404)
    r = await c.delete(f"/staff/{sadm.id}", headers=S)
    check("ninguem remove a si mesmo (400)", r.status_code == 400, r.text[:120])
    r = await c.delete("/staff/00000000-0000-0000-0000-000000000000", headers=S)
    check("remover quem nao existe = 404", r.status_code == 404)
    # a pessoa com sessao valida perde o acesso na hora da remocao
    cookie_novo = cookie(await recarregar_por_id(nov_id))
    check("antes de remover, a pessoa acessa o painel", (await c.get("/auth/me", headers=cookie_novo)).status_code == 200)
    r = await c.delete(f"/staff/{nov_id}", headers=S)
    check("S.Adm remove alguem da equipe (204)", r.status_code == 204, r.text[:120])
    check("a sessao da pessoa removida cai na hora (401)", (await c.get("/auth/me", headers=cookie_novo)).status_code == 401)
    check("ela some da lista da equipe", all(m["id"] != nov_id for m in (await c.get("/staff", headers=S)).json()))
    async with AsyncSessionLocal() as db:
        lg = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.entity_type == "staff", AuditLogEntry.action == "delete", AuditLogEntry.entity_id == str(BASE + 28)))).scalars().first()
    check("a remocao fica no log com o nome de quem foi removido", lg is not None and lg.diff.get("username") == "TESTE_remover", str(lg and lg.diff))
    # o ultimo S.Adm ativo nunca e' removido: o sadm2 (se ainda existir) remove o sadm, mas nao o contrario quando sobra um so'
    ativos = [m for m in (await c.get("/staff", headers=S)).json() if m["role"] == "super_admin" and m["isActive"]]
    check("a regra do ultimo S.Adm existe no servico (staff_service.delete_staff)", hasattr(__import__("app.core.staff_service", fromlist=["x"]), "delete_staff") and len(ativos) >= 1)

    await dar_envio_ao_creator()   # o reset acima devolveu o padrao
    imgs = []
    for k in range(3):
        r = await c.post("/media", files={"file": (f"m{k}.png", _png((k * 60, 20, 200)), "image/png")}, data={"name": f"{SLUG} lote {k}"}, headers=Cm)
        imgs.append(r.json())
    r = await c.post("/media/bulk-delete", json={"ids": [imgs[0]["id"]]}, headers=Cm)
    check("Creator NAO apaga em massa (403)", r.status_code == 403)
    r = await c.post("/content-items", json={**novo_conteudo("emuso"), "image": f"img:{imgs[1]['id']}"}, headers=A)
    r = await c.post("/media/bulk-delete", json={"ids": [imgs[0]["id"], imgs[1]["id"], imgs[2]["id"], 99999999]}, headers=S)
    res = r.json()
    check("em massa: apaga as livres e devolve as em uso e as que nao existem", r.status_code == 200 and sorted(res["deleted"]) == sorted([imgs[0]["id"], imgs[2]["id"]])
          and [x["id"] for x in res["inUse"]] == [imgs[1]["id"]] and res["notFound"] == [99999999], r.text[:300])
    check("as apagadas saem do banco e do disco; a em uso continua", (await c.get(f"/media/{imgs[0]['id']}", headers=Cm)).status_code == 404
          and not (_UPLOADS / imgs[0]["url"].rsplit("/", 1)[1]).exists() and (await c.get(f"/media/{imgs[1]['id']}", headers=Cm)).status_code == 200)
    r = await c.post("/media/bulk-delete", json={"ids": [imgs[1]["id"]], "force": True}, headers=S)
    check("com force=true apaga ate' a que esta' em uso", r.status_code == 200 and r.json()["deleted"] == [imgs[1]["id"]])
    r = await c.post("/media/bulk-delete", json={"ids": []}, headers=S)
    check("lista vazia e' recusada (422)", r.status_code == 422)

    # categorias do banco de imagens
    r = await c.post("/media", files={"file": ("a.png", _png((1, 2, 3)), "image/png")}, data={"name": f"{SLUG} sword", "category": "weapon"}, headers=S)
    ca = r.json()
    check("S.Adm envia com categoria e ela e' guardada", r.status_code == 201 and ca["category"] == "weapon", r.text[:160])
    r = await c.post("/media", files={"file": ("a2.png", _png((2, 2, 3)), "image/png")}, data={"name": f"{SLUG} do creator", "category": "weapon"}, headers=Cm)
    check("Creator (sem media.manage) nao escolhe categoria: ela e' ignorada", r.status_code == 201 and r.json()["category"] == "", r.text[:160])
    cc = r.json()
    r = await c.post("/media", files={"file": ("b.png", _png((3, 2, 1)), "image/png")}, data={"category": "inventada"}, headers=S)
    check("categoria desconhecida e' recusada (422)", r.status_code == 422)
    for nova in ("scroll", "npc", "monster", "furniture", "hair_beard"):
        r = await c.post("/media", files={"file": (f"{nova}.png", _png((4, 4, len(nova))), "image/png")}, data={"category": nova}, headers=S)
        check(f"categoria nova '{nova}' existe", r.status_code == 201 and r.json()["category"] == nova, r.text[:100])
        if r.status_code == 201:
            await c.delete(f"/media/{r.json()['id']}", params={"force": "true"}, headers=S)
    r = await c.post("/media", files={"file": ("c.png", _png((5, 5, 5)), "image/png")}, data={"name": f"{SLUG} semcat"}, headers=Cm)
    cb = r.json()
    check("sem categoria fica vazio", r.status_code == 201 and cb["category"] == "")
    r = await c.get("/media", params={"category": "weapon", "limit": 200}, headers=Cm)
    ids_w = [i["id"] for i in r.json()["items"]]
    check("filtro por categoria traz so' as dela", ca["id"] in ids_w and cb["id"] not in ids_w and all(i["category"] == "weapon" for i in r.json()["items"]))
    r = await c.get("/media", params={"category": "none", "limit": 200}, headers=Cm)
    check("filtro 'none' traz so' as sem categoria", cb["id"] in [i["id"] for i in r.json()["items"]] and all(i["category"] == "" for i in r.json()["items"]))
    r = await c.get("/media", headers=Cm)
    j = r.json()
    check("a lista informa a contagem por categoria e a pagina padrao e' de 100", j["counts"].get("weapon", 0) >= 1 and len(j["items"]) <= 100 and sum(j["counts"].values()) == j["total"], str(j["counts"]))
    r = await c.patch(f"/media/{cb['id']}", json={"category": "currency"}, headers=Cm)
    check("Creator NAO muda a categoria (403)", r.status_code == 403)
    r = await c.patch(f"/media/{cb['id']}", json={"category": "currency"}, headers=S)
    check("S.Adm muda a categoria sem perder o nome", r.status_code == 200 and r.json()["category"] == "currency" and r.json()["name"] == f"{SLUG} semcat", r.text[:160])
    r = await c.patch(f"/media/{cb['id']}", json={"category": "xyz"}, headers=S)
    check("categoria invalida no PATCH e' recusada (422)", r.status_code == 422)
    r = await c.post("/media/bulk-category", json={"ids": [ca["id"], cb["id"]], "category": "ring"}, headers=Cm)
    check("Creator NAO muda categoria em massa (403)", r.status_code == 403)
    r = await c.post("/media/bulk-category", json={"ids": [ca["id"], cb["id"], 99999999], "category": "ring"}, headers=S)
    check("S.Adm muda a categoria de varias de uma vez", r.status_code == 200 and r.json()["updated"] == 2, r.text[:120])
    r = await c.post("/media/bulk-category", json={"ids": [ca["id"]], "category": ""}, headers=S)
    check("categoria vazia tira a categoria", r.status_code == 200 and (await c.get(f"/media/{ca['id']}", headers=Cm)).json()["category"] == "")
    await c.post("/media/bulk-delete", json={"ids": [ca["id"], cb["id"], cc["id"]], "force": True}, headers=S)

    # categoria 'closed': privada, so' o S.Adm ve
    r = await c.post("/media", files={"file": ("fechada.png", _png((21, 5, 5)), "image/png")}, data={"name": f"{SLUG} fechada", "category": "closed"}, headers=S)
    fechada = r.json()
    check("S.Adm cria imagem na categoria closed", r.status_code == 201 and fechada["category"] == "closed", r.text[:120])
    atuais_adm = (await c.get("/auth/me", headers=A)).json()["permissions"]
    await c.put("/roles/admin/permissions", json={"permissions": sorted(set(atuais_adm) | {"media.manage", "media.upload"})}, headers=S)
    r = await c.get("/media", params={"limit": 200}, headers=S)
    check("S.Adm ve a closed na lista e na contagem", fechada["id"] in [i["id"] for i in r.json()["items"]] and r.json()["counts"].get("closed", 0) >= 1)
    check("S.Adm tem media.closed em /auth/me", "media.closed" in (await c.get("/auth/me", headers=S)).json()["permissions"])
    for quem, h in (("Adm (com media.manage)", A), ("Creator", Cm)):
        r = await c.get("/media", params={"limit": 200}, headers=h)
        check(f"{quem} NAO ve a closed na lista nem na contagem", fechada["id"] not in [i["id"] for i in r.json()["items"]] and "closed" not in r.json()["counts"] and sum(r.json()["counts"].values()) == r.json()["total"])
        r = await c.get("/media", params={"category": "closed"}, headers=h)
        check(f"{quem} filtrando por closed recebe 403 com o aviso de acesso negado", r.status_code == 403 and "not allowed to view" in r.json()["detail"], r.text[:120])
        r = await c.get(f"/media/{fechada['id']}", headers=h)
        check(f"{quem} chutando o ID da closed recebe 403 com o aviso", r.status_code == 403 and "closed" in r.json()["detail"], r.text[:120])
        r = await c.get("/media", params={"q": f"#{fechada['id']}"}, headers=h)
        check(f"{quem} busca pelo ID da closed: nada na lista, mas restricted=true (aviso)", fechada["id"] not in [i["id"] for i in r.json()["items"]] and r.json()["restricted"] is True)
        r = await c.get("/media", params={"q": f"{SLUG} fechada"}, headers=h)
        check(f"{quem} busca pelo NOME da closed: nada na lista, mas restricted=true (aviso)", r.json()["items"] == [] and r.json()["restricted"] is True)
        r = await c.get("/media", params={"q": f"{SLUG} nome-que-nao-existe"}, headers=h)
        check(f"{quem} busca sem relacao nao dispara o aviso", r.json()["restricted"] is False)
    check("Adm (com media.manage) nao ve a permissao media.closed", "media.closed" not in (await c.get("/auth/me", headers=A)).json()["permissions"])
    check("Adm nao renomeia a closed (403 com o aviso)", (await c.patch(f"/media/{fechada['id']}", json={"name": "x"}, headers=A)).status_code == 403)
    check("Adm nao apaga a closed (403 com o aviso)", (await c.delete(f"/media/{fechada['id']}", headers=A)).status_code == 403)
    r = await c.post("/media/bulk-delete", json={"ids": [fechada["id"]], "force": True}, headers=A)
    check("em massa, incluir a closed recusa tudo para o Adm (403)", r.status_code == 403 and "closed" in r.json()["detail"])
    r = await c.post("/media/bulk-category", json={"ids": [fechada["id"]], "category": "weapon"}, headers=A)
    check("Adm nao muda a categoria da closed em massa (403)", r.status_code == 403)
    r = await c.post("/media", files={"file": ("t.png", _png((22, 5, 5)), "image/png")}, data={"category": "closed"}, headers=A)
    check("Adm nao cria imagem na closed (403 com o aviso)", r.status_code == 403)
    r = await c.post("/content-items", json={**novo_conteudo("closed-ref"), "image": f"img:{fechada['id']}"}, headers=A)
    check("Adm nao usa o ID de uma closed num campo de imagem (403 com o aviso)", r.status_code == 403 and "closed" in r.json()["detail"], r.text[:140])
    r = await c.post("/content-items", json={**novo_conteudo("closed-ref-sadm"), "image": f"img:{fechada['id']}"}, headers=S)
    check("o S.Adm usa o ID da closed normalmente", r.status_code == 201 and r.json()["image"].endswith(".png"), r.text[:140])
    if r.status_code == 201:
        await c.delete(f"/content-items/{r.json()['id']}", headers=S)
    r = await c.put("/roles/admin/permissions", json={"permissions": ["media.closed"]}, headers=S)
    check("media.closed nao pode ser dada a nenhum cargo (exclusiva do S.Adm: 400)", r.status_code == 400)
    check("a closed continua existindo para o S.Adm", (await c.get(f"/media/{fechada['id']}", headers=S)).status_code == 200)
    await c.delete(f"/media/{fechada['id']}", params={"force": "true"}, headers=S)
    await c.post("/roles/admin/permissions/reset", headers=S)

    # TRANCAR categorias por cargo (permissao media.cat.<categoria>): igual a 'closed', mas escolhido pelo S.Adm
    r = await c.get("/roles/permissions", headers=S)
    nomes = {p["name"] for p in r.json()["permissions"]}
    check("o catalogo de permissoes tem uma por categoria do banco de imagens (e 'Sem categoria')", {"media.cat.weapon", "media.cat.hair_beard", "media.cat.none"} <= nomes)
    me_cr = (await c.get("/auth/me", headers=Cm)).json()["permissions"]
    check("por padrao o Creator ve todas as categorias (menos closed)", "media.cat.weapon" in me_cr and "media.cat.none" in me_cr and "media.closed" not in me_cr)
    trancada = (await c.post("/media", files={"file": ("tr.png", _png((31, 3, 3)), "image/png")}, data={"name": f"{SLUG} trancada", "category": "weapon"}, headers=S)).json()
    solta = (await c.post("/media", files={"file": ("sc.png", _png((32, 3, 3)), "image/png")}, data={"name": f"{SLUG} sem categoria"}, headers=S)).json()
    r = await c.put("/roles/creator/permissions", json={"permissions": [p for p in me_cr if p not in ("media.cat.weapon", "media.cat.none")]}, headers=S)
    check("S.Adm tranca 'weapon' e 'Sem categoria' para o Creator", r.status_code == 200, r.text[:100])
    r = await c.get("/media", params={"limit": 200}, headers=Cm)
    j = r.json()
    check("Creator: as imagens trancadas somem da lista e da contagem", trancada["id"] not in [i["id"] for i in j["items"]] and solta["id"] not in [i["id"] for i in j["items"]]
          and "weapon" not in j["counts"] and "" not in j["counts"] and sum(j["counts"].values()) == j["total"], str(j["counts"]))
    r = await c.get(f"/media/{trancada['id']}", headers=Cm)
    check("Creator chutando o ID de imagem trancada: 403 com o aviso", r.status_code == 403 and "not allowed to view" in r.json()["detail"], r.text[:100])
    r = await c.get("/media", params={"category": "weapon"}, headers=Cm)
    check("Creator filtrando pela categoria trancada: 403", r.status_code == 403)
    r = await c.get("/media", params={"category": "none"}, headers=Cm)
    check("Creator filtrando 'Sem categoria' trancada: 403", r.status_code == 403)
    r = await c.get("/media", params={"q": f"{SLUG} trancada"}, headers=Cm)
    check("busca pelo nome da imagem trancada: nada na lista e restricted=true", r.json()["items"] == [] and r.json()["restricted"] is True)
    r = await c.post("/content-items", json={**novo_conteudo("tranc-ref"), "image": f"img:{trancada['id']}"}, headers=C)
    check("Creator nao usa o ID da imagem trancada num campo de imagem (403)", r.status_code == 403)
    check("o Adm (nao trancado) continua vendo", (await c.get(f"/media/{trancada['id']}", headers=A)).status_code == 200)
    check("o S.Adm sempre ve", (await c.get(f"/media/{trancada['id']}", headers=S)).status_code == 200)
    r = await c.put("/roles/creator/permissions", json={"permissions": me_cr}, headers=S)
    check("S.Adm destranca (devolve as permissoes)", r.status_code == 200 and (await c.get(f"/media/{trancada['id']}", headers=Cm)).status_code == 200)
    await c.post("/media/bulk-delete", json={"ids": [trancada["id"], solta["id"]], "force": True}, headers=S)
    await c.post("/roles/creator/permissions/reset", headers=S)

    # renumerar os IDs (so' S.Adm)
    r = await c.post("/media/renumber", headers=A)
    check("Adm NAO renumera os IDs (404: permissao exclusiva do S.Adm)", r.status_code == 404)
    r = await c.post("/media/renumber", headers=Cm)
    check("Creator NAO renumera os IDs (404)", r.status_code == 404)
    r1 = await c.post("/media", files={"file": ("r1.png", _png((11, 1, 1)), "image/png")}, headers=S)
    r2 = await c.post("/media", files={"file": ("r2.png", _png((12, 1, 1)), "image/png")}, headers=S)
    total_antes = (await c.get("/media", params={"limit": 1}, headers=S)).json()["total"]
    r = await c.post("/media/renumber", headers=S)
    check("S.Adm renumera: devolve quantas imagens", r.status_code == 200 and r.json()["renumbered"] == total_antes, r.text[:100])
    todas = (await c.get("/media", params={"limit": 200}, headers=S)).json()["items"]
    ids = sorted(i["id"] for i in todas)
    check("depois de renumerar os IDs vao de 1 a N sem buracos", ids == list(range(1, len(ids) + 1)), str(ids[:12]))
    r3 = await c.post("/media", files={"file": ("r3.png", _png((13, 1, 1)), "image/png")}, headers=S)
    check("a proxima imagem recebe N+1 (a sequencia foi ajustada)", r3.status_code == 201 and r3.json()["id"] == len(ids) + 1, r3.text[:100])
    for nome in ("r1", "r2", "r3"):
        mid = next((i["id"] for i in (await c.get("/media", params={"limit": 200}, headers=S)).json()["items"] if i["name"] == nome), None)
        if mid:
            await c.delete(f"/media/{mid}", params={"force": "true"}, headers=S)
    await c.post("/roles/creator/permissions/reset", headers=S)

    secao("25) Texto rico: estilos de letra (cor, fundo, fonte, tamanho) so' no formato permitido")
    from app.schemas.validators import validate_rich_content

    def _estilo(attrs: dict) -> str:
        """Documento de 1 paragrafo com a marca textStyle recebida."""
        return json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [
            {"type": "text", "text": "a", "marks": [{"type": "textStyle", "attrs": attrs}]}]}]})

    def _aceita(attrs: dict) -> bool:
        """True se o validador aceita o estilo."""
        try:
            validate_rich_content(_estilo(attrs))
            return True
        except ValueError:
            return False

    check("cor em hexadecimal e' aceita", _aceita({"color": "#dc2626", "backgroundColor": "#ffff00"}))
    check("fonte do site (var) e fonte de sistema com aspas sao aceitas",
          _aceita({"fontFamily": "var(--font-lora), serif"}) and _aceita({"fontFamily": '"Times New Roman", Times, serif'}))
    check("tamanho em px e' aceito", _aceita({"fontSize": "24px", "color": None}))
    check("cor com ';' ou url() e' recusada (injecao de CSS)",
          not _aceita({"color": "red;position:fixed"}) and not _aceita({"backgroundColor": "url(x)"}))
    check("fonte com ';' e' recusada", not _aceita({"fontFamily": "a;b"}))
    check("atributo de estilo desconhecido e' recusado", not _aceita({"position": "fixed"}))

    secao("24) Acessos ao site: grafico por dia, paises e paginas (so' contagens)")
    from app.core import geoip
    from app.core.database import AsyncSessionLocal as _SessLimpa
    async with _SessLimpa() as _db:   # o ranking mostra so' as 8 paginas mais vistas: sobras de acessos reais/testes antigos no banco local nao podem empurrar a de teste para fora
        await _db.execute(text("DELETE FROM traffic_pages WHERE day >= current_date - 8"))
        await _db.commit()
    c.cookies.clear()
    H = {"User-Agent": UA_NAVEGADOR, "Origin": "http://localhost:3000"}
    pagina = f"/{SLUG}-pagina"
    settings.trust_proxy_headers = True
    r = await c.post("/analytics/hit", json={"path": pagina + "?utm=x#topo"}, headers={**H, "CF-IPCountry": "qq"})
    check("visita e' contada (204)", r.status_code == 204, r.text)
    await c.post("/analytics/hit", json={"path": pagina}, headers={**H, "CF-IPCountry": "QQ"})
    await c.post("/analytics/hit", json={"path": pagina + "-lugar"}, headers={**H, "CF-IPCountry": "QR", "CF-Region": "S%C3%A3o%20Paulo", "CF-IPCity": "Campinas\n"})
    settings.trust_proxy_headers = False
    await c.post("/analytics/hit", json={"path": pagina + "-lugar"}, headers={**H, "CF-IPCountry": "QR", "CF-Region": "Falso", "CF-IPCity": "Forjada"})   # sem proxy confiavel: ignorado
    r = await c.get("/analytics/summary?days=7", headers=A)
    resumo = r.json()
    lugar = next((x for x in resumo["places"] if x["country"] == "QR" and x["city"] == "Campinas"), None)
    check("estado e cidade da Cloudflare entram no ranking de lugares (decodificados e limpos)", lugar is not None and lugar["region"] == "São Paulo" and lugar["views"] == 1, str(resumo["places"][:3]))
    check("estado/cidade FORJADOS (sem proxy confiavel) sao ignorados", not any(x["city"] == "Forjada" for x in resumo["places"]))
    pais = next((x for x in resumo["countries"] if x["code"] == "QQ"), None)
    pag = next((x for x in resumo["pages"] if x["path"] == pagina), None)
    check("Adm ve o resumo (200) com 7 dias na serie", r.status_code == 200 and len(resumo["series"]) == 7 and resumo["days"] == 7, r.text[:150])
    check("pais da Cloudflare entra no ranking (2 visualizacoes, 1 visitante unico: mesmo IP+navegador)", pais is not None and pais["views"] == 2 and pais["visitors"] == 1, str(pais))
    check("pagina entra no ranking sem parametros nem hash (2 visualizacoes)", pag is not None and pag["views"] == 2, str(pag))
    check("o ultimo ponto da serie e' hoje e soma as visualizacoes", resumo["series"][-1]["views"] >= 2 and resumo["totalViews"] >= 2)
    n_antes = pais["views"]
    await c.post("/analytics/hit", json={"path": pagina}, headers={**H, "CF-IPCountry": "QQ"})  # trust_proxy_headers desligado: cabecalho forjado e' ignorado
    resumo2 = (await c.get("/analytics/summary?days=7", headers=A)).json()
    check("cabecalho de pais FORJADO e' ignorado sem proxy confiavel (QQ nao cresce; vira desconhecido)",
          next(x for x in resumo2["countries"] if x["code"] == "QQ")["views"] == n_antes, str(resumo2["countries"][:3]))
    total_antes = resumo2["totalViews"]
    for rotulo, corpo, cab in [("robo (User-Agent de bot)", {"path": pagina}, {**H, "User-Agent": "Googlebot/2.1"}),
                               ("pagina do painel", {"path": "/admin/staff"}, H), ("login", {"path": "/login"}, H),
                               ("caminho externo", {"path": "//evil.example/x"}, H), ("sem User-Agent", {"path": pagina}, {"Origin": "http://localhost:3000", "User-Agent": ""})]:
        r = await c.post("/analytics/hit", json=corpo, headers=cab)
        check(f"ignorado em silencio: {rotulo}", r.status_code == 204)
    resumo3 = (await c.get("/analytics/summary?days=7", headers=A)).json()
    check("nada disso entrou na contagem", resumo3["totalViews"] == total_antes, f"{total_antes} -> {resumo3['totalViews']}")
    check("Origin de outro site -> 403", (await c.post("/analytics/hit", json={"path": pagina}, headers={**H, "Origin": "https://evil.example"})).status_code == 403)
    check("caminho vazio/gigante -> 422", (await c.post("/analytics/hit", json={"path": ""}, headers=H)).status_code == 422
          and (await c.post("/analytics/hit", json={"path": "/" + "a" * 300}, headers=H)).status_code == 422)
    check("Creator nao ve o resumo (403)", (await c.get("/analytics/summary", headers=C)).status_code == 403)
    check("anonimo nao ve o resumo (401)", (await c.get("/analytics/summary")).status_code == 401)
    check("dias fora do limite -> 422", (await c.get("/analytics/summary?days=0", headers=A)).status_code == 422)
    check("geoip: IP privado/invalido vira desconhecido (ZZ) e 'XX' da Cloudflare e' ignorado",
          geoip.country_of("10.0.0.1") == "ZZ" and geoip.country_of("nao-e-ip") == "ZZ" and geoip.valid_country("xx") is None
          and geoip.valid_country("br") == "BR" and geoip.country_of("8.8.8.8", "BR", trust_header=True) == "BR")
    limiter.reset()
    codigos = [(await c.post("/analytics/hit", json={"path": pagina}, headers=H)).status_code for _ in range(95)]
    check("flood de visitas: passa o limite por minuto e recebe 429", 429 in codigos and codigos[0] == 204, str(set(codigos)))
    limiter.reset()

    secao("30) Importador de noticias da Steam: so' patchnotes, sem duplicar, credito, autor e rascunho/publicado")
    from app.core import steam_news as sn
    from app.core.config import settings as _cfg
    from app.core.database import AsyncSessionLocal as _Sess

    def _item(gid: str, titulo: str, tags: list[str] | None, corpo: str = "[b]Hi[/b] [url=https://x.test/a]link[/url]\n[list][*]one[*]two[/list]") -> dict:
        """Post de mentira no formato da API de noticias da Steam."""
        return {"gid": gid, "title": titulo, "url": f"https://store.steampowered.com/news/app/1/view/{gid}", "author": "Steam-Autor", "contents": corpo,
                "date": 1790000000 + int(gid[-3:]), **({"tags": tags} if tags is not None else {})}

    feed = [_item("teste-steam-001", f"{SLUG} Update 1", ["patchnotes"]), _item("teste-steam-002", f"{SLUG} Evento", ["event"]),
            _item("teste-steam-003", f"{SLUG} Update 2", ["patchnotes", "other"]), _item("teste-steam-004", f"{SLUG} Sem tags", None)]

    async def _fake(app_id, count=20, transport=None):
        """Substitui a chamada real a' Steam por uma lista fixa."""
        return feed

    async def _fake_capsule(app_id, gid, transport=None, **_ignored):
        """Substitui a pagina do post na Steam: so' o post 001 tem miniatura (capsule); os outros caem na 1a imagem do texto."""
        return "https://clan.akamai.steamstatic.com/images/1/capsule-001.png" if gid.endswith("001") else None

    original_capsule = sn.fetch_capsule
    sn.fetch_capsule = _fake_capsule
    original_fetch, original_cfg = sn.fetch_news, (_cfg.steam_news_app_id, _cfg.steam_news_author_name, _cfg.steam_news_status, _cfg.steam_news_require_tag)
    sn.fetch_news = _fake
    try:
        _cfg.steam_news_app_id, _cfg.steam_news_author_name, _cfg.steam_news_status, _cfg.steam_news_require_tag = "1", "Dev Studio", "published", "patchnotes"
        r = await c.get("/steam-news/status")
        check("anonimo NAO ve o estado do importador (401)", r.status_code == 401)
        check("Creator NAO ve o importador (403)", (await c.get("/steam-news/status", headers=C)).status_code == 403)
        r = await c.get("/steam-news/status", headers=A)
        check("Adm ve o estado: ligado, jogo e modo", r.status_code == 200 and r.json()["enabled"] is True and r.json()["appId"] == "1" and r.json()["mode"] == "published", r.text[:150])
        check("Creator NAO importa (403)", (await c.post("/steam-news/import", headers=C)).status_code == 403)
        r = await c.post("/steam-news/import", headers=A)
        run = r.json()["lastRun"]
        check("Adm importa: 4 lidos, 2 com a tag patchnotes, 2 importados", r.status_code == 200 and run["fetched"] == 4 and run["matched"] == 2 and run["imported"] == 2 and not run["errors"], str(run)[:200])
        check("o resultado traz o diagnostico: titulo e tags do que a Steam devolveu", len(run["seen"]) == 4 and run["seen"][0]["tags"] == ["patchnotes"] and run["seen"][3]["tags"] == [], str(run["seen"])[:160])
        async with _Sess() as db:
            posts = (await db.execute(text("SELECT p.title, p.status, p.author_label, p.source_url, p.cover_image, p.content, p.published_at FROM posts p WHERE p.source_id LIKE 'teste-steam-%' ORDER BY p.source_id"))).all()
            tags = (await db.execute(text("SELECT t.id FROM post_tag_links l JOIN tags t ON t.id = l.tag_id JOIN posts p ON p.id = l.post_id WHERE p.source_id LIKE 'teste-steam-%'"))).scalars().all()
        check("so' os posts com patchnotes viraram posts do blog", [p[0] for p in posts] == [f"{SLUG} Update 1", f"{SLUG} Update 2"])
        check("entram PUBLICADOS e com a data da Steam", all(str(p[1]).endswith("PUBLISHED") or str(p[1]).endswith("published") for p in posts) and all(p[6] is not None for p in posts))
        check("o nome da desenvolvedora aparece em por/by (autor sem usuario)", all(p[2] == "Dev Studio" for p in posts))
        check("tag Patch Notes ligada aos dois posts", tags.count("patch-notes") == 2)
        check("credito para o original (link da Steam) no topo do texto", "Originally published on Steam by Dev Studio" in posts[0][5] and "store.steampowered.com/news/app/1/view/teste-steam-001" in posts[0][5])
        async with _Sess() as db:
            capa = (await db.execute(text("SELECT cover_image, banner_image FROM posts WHERE source_id = 'teste-steam-001'"))).first()
        check("miniatura do post = capsule da Steam; banner do topo = a arte padrao do jogo", capa[0] == "https://clan.akamai.steamstatic.com/images/1/capsule-001.png" and capa[1] == _cfg.steam_news_banner_image, str(capa))
        html_ok = '<html><head><meta property="og:image" content="https://clan.akamai.steamstatic.com/images/40800315/abc.jpg"></head></html>'
        html_generico = '<meta property="og:image" content="https://store.akamai.steamstatic.com/public/shared/images/share.jpg">'
        html_inverso = '<meta content="//clan.akamai.steamstatic.com/images/9/x.png" name="twitter:image">'
        evento = {"events": [{"gid": "123", "jsondata": json.dumps({"localized_capsule_image": [None, "x.png"], "localized_title_image": ["t.png"]})},
                             {"gid": "999", "announcement_body": {"gid": "456"}, "jsondata": {"localized_capsule_image": ["40800315/cap.jpg"]}}]}
        check("capsule_from_event_json: acha o evento pelo gid, monta o endereco com o numero do clan e aceita caminho ja' completo",
              sn.capsule_from_event_json(evento, "123", "40800315") == "https://clan.akamai.steamstatic.com/images/40800315/x.png"
              and sn.capsule_from_event_json(evento, "456") == "https://clan.akamai.steamstatic.com/images/40800315/cap.jpg"
              and sn.capsule_from_event_json(evento, "123") is None and sn.capsule_from_event_json(evento, "000") is None
              and sn.clan_account_of({"x": "https://clan.akamai.steamstatic.com/images/40800315/a.png"}) == "40800315")
        check("capsule_from_html: pega a og:image do clan, ignora a generica da loja e entende a ordem inversa dos atributos",
              sn.capsule_from_html(html_ok).endswith("40800315/abc.jpg") and sn.capsule_from_html(html_generico) is None
              and sn.capsule_from_html(html_inverso) == "https://clan.akamai.steamstatic.com/images/9/x.png" and sn.capsule_from_html("<html></html>") is None)
        check("o texto virou documento do editor (negrito, link, lista)", '"bold"' in posts[0][5] and "https://x.test/a" in posts[0][5] and "bulletList" in posts[0][5])
        pub = (await c.get("/posts", params={"limit": 50})).json()
        check("o post importado aparece no blog publico com 'por' = desenvolvedora", any(x["title"] == f"{SLUG} Update 1" and x["authorName"] == "Dev Studio" for x in pub), str(pub)[:200] if not isinstance(pub, list) else "")
        r = await c.post("/steam-news/import", headers=A)
        check("rodar de novo nao duplica (ja' importados contam como pulados)", r.json()["lastRun"]["imported"] == 0 and r.json()["lastRun"]["skipped"] == 2)
        feed.append(_item("teste-steam-005", f"{SLUG} Update 3", ["patchnotes"], corpo="[img]{STEAM_CLAN_IMAGE}/1/a.png[/img]\nTexto."))
        feed.append(_item("teste-steam-006", "Update v6.0.0.9b", []))   # "Atualizacao regular" da Steam: sem a tag patchnotes, mas o titulo e' de update
        _cfg.steam_news_status = "draft"
        r = await c.post("/steam-news/import", headers=A)
        check("modo draft: os posts novos entram como rascunho (inclusive o update SEM a tag, achado pelo titulo)", r.json()["lastRun"]["imported"] == 2, str(r.json()["lastRun"])[:200])
        async with _Sess() as db:
            novo = (await db.execute(text("SELECT status, cover_image FROM posts WHERE source_id = 'teste-steam-005'"))).first()
        check("rascunho e a primeira imagem vira a capa", str(novo[0]).lower().endswith("draft") and novo[1] == "https://clan.akamai.steamstatic.com/images/1/a.png", str(novo))
        _cfg.steam_news_require_tag = ""
        r = await c.post("/steam-news/import", headers=A)
        check("sem exigir tag, importa tambem os outros (evento e sem tags)", r.json()["lastRun"]["imported"] == 2, str(r.json()["lastRun"])[:160])
        feed.append({**_item("teste-steam-777000001", f"{SLUG} Post antigo", ["event"], corpo="Texto antigo."), "gid": "777000001", "date": 1500000000})   # 2017: bem antes do sistema
        _cfg.steam_news_require_tag = "patchnotes"
        r = await c.post("/steam-news/import", params={"post": "https://store.steampowered.com/news/app/1"}, headers=A)
        check("link sem numero de post: 422", r.status_code == 422)
        r = await c.post("/steam-news/import", params={"post": "https://store.steampowered.com/news/app/1/view/999999999"}, headers=A)
        check("post que a Steam nao tem: aviso 'not found' (nada importado)", r.status_code == 200 and r.json()["lastRun"]["imported"] == 0 and "not found" in r.json()["lastRun"]["errors"][0], str(r.json()["lastRun"])[:160])
        r = await c.post("/steam-news/import", params={"post": "https://store.steampowered.com/news/app/1/view/777000001"}, headers=A)
        check("post antigo e sem a tag: importado pelo link", r.status_code == 200 and r.json()["lastRun"]["imported"] == 1 and not r.json()["lastRun"]["errors"], str(r.json()["lastRun"])[:200])
        async with _Sess() as db:
            velho = (await db.execute(text("SELECT published_at, status FROM posts WHERE source_id = '777000001'"))).first()
        check("o post antigo entra com a DATA ORIGINAL da Steam (2017)", velho is not None and velho[0].year == 2017, str(velho))
        r = await c.post("/steam-news/import", params={"post": "777000001"}, headers=A)
        async with _Sess() as db:
            qtd = (await db.execute(text("SELECT count(*) FROM posts WHERE source_id = '777000001'"))).scalar()
        check("importar o mesmo post de novo ATUALIZA o conteudo (nao duplica)", qtd == 1 and r.json()["lastRun"]["imported"] == 1 and "(updated)" in r.json()["lastRun"]["titles"][0], str(r.json()["lastRun"])[:200])
        for it in feed:   # a Steam passou a mandar [img src="..."] (sem [/img]): o "atualizar todos" tem que consertar os posts ja' importados
            if it["gid"] == "teste-steam-005":
                it["contents"] = 'Texto novo.\n[img src="https://clan.akamai.steamstatic.com/images/9/novo.png"]'
        r = await c.post("/steam-news/import", params={"refresh": "true"}, headers=A)
        async with _Sess() as db:
            ref = (await db.execute(text("SELECT content, cover_image FROM posts WHERE source_id = 'teste-steam-005'"))).first()
            n005 = (await db.execute(text("SELECT count(*) FROM posts WHERE source_id = 'teste-steam-005'"))).scalar()
        check("atualizar todos: reconverte os ja' importados (imagem no formato novo vira imagem e capa; sem duplicar)", r.json()["lastRun"]["imported"] >= 1 and n005 == 1 and "novo.png" in ref[0] and "[img" not in ref[0] and ref[1].endswith("novo.png"), str(ref)[:200] + str(r.json()["lastRun"])[:200])
        check("so' quem publica importa por link (Creator 403)", (await c.post("/steam-news/import", params={"post": "777000001"}, headers=C)).status_code == 403)
        _cfg.steam_news_app_id = ""
        check("desligado (sem STEAM_NEWS_APP_ID): importar da' 404", (await c.post("/steam-news/import", headers=A)).status_code == 404)
        check("desligado: o estado diz enabled=false", (await c.get("/steam-news/status", headers=A)).json()["enabled"] is False)
        # erro da Steam nao derruba
        async def _boom(*a, **k):
            """Simula a Steam fora do ar."""
            raise RuntimeError("steam down")
        sn.fetch_news = _boom
        _cfg.steam_news_app_id = "1"
        r = await c.post("/steam-news/import", headers=A)
        check("Steam fora do ar: responde 200 e registra o erro (sem derrubar a API)", r.status_code == 200 and r.json()["lastRun"]["errors"], r.text[:160])
    finally:
        sn.fetch_news = original_fetch
        sn.fetch_capsule = original_capsule
        _cfg.steam_news_app_id, _cfg.steam_news_author_name, _cfg.steam_news_status, _cfg.steam_news_require_tag = original_cfg
        async with _Sess() as db:
            await db.execute(text("DELETE FROM posts WHERE source_id LIKE 'teste-steam-%' OR source_id = '777000001'"))
            await db.commit()

    secao("31) Backup cifrado (banco + imagens) e versao publicada: so' o bot, nunca sem senha")
    import gzip as _gz, io as _io, tarfile as _tar
    from app.core import backup as _bk
    settings.bot_api_token = "token-de-teste-do-bot-1234567890"
    BK = {"X-Bot-Token": settings.bot_api_token}
    orig_pass = settings.backup_passphrase
    try:
        settings.backup_passphrase = ""
        check("backup sem token do bot: 401", (await c.post("/bot/backup")).status_code == 401)
        r = await c.post("/bot/backup", headers=BK)
        check("sem BACKUP_PASSPHRASE o backup NAO e' gerado (503)", r.status_code == 503, r.text[:100])
        check("Adm logado (sem token do bot) nao cria backup (401)", (await c.post("/bot/backup", headers=A)).status_code == 401)
        r = await c.get("/bot/version", headers=BK)
        check("/bot/version devolve sha, mensagem e data da atualizacao", r.status_code == 200 and {"sha", "message", "date"} <= set(r.json()), r.text[:100])
        check("/bot/version exige o token do bot (401)", (await c.get("/bot/version")).status_code == 401)
        settings.backup_passphrase = "senha-de-teste-do-backup"
        r = await c.post("/bot/backup", headers=BK)
        info = r.json()
        check("com senha: backup criado (id, tamanho, linhas)", r.status_code == 200 and info["size"] > 100 and info["rows"] > 0 and re.fullmatch(r"[0-9a-f]{32}", info["id"]), r.text[:150])
        r = await c.get(f"/bot/backup/{info['id']}", params={"part": 1, "size": 1024}, headers=BK)
        check("baixa a parte 1 (comeca com a assinatura NINBK2 e NAO e' texto legivel)", r.status_code == 200 and r.content.startswith(b"NINBK2") and len(r.content) == 1024 and b"audit" not in r.content)
        total = info["size"]
        partes = (total + 1023) // 1024
        buf = b"".join([(await c.get(f"/bot/backup/{info['id']}", params={"part": n, "size": 1024}, headers=BK)).content for n in range(1, partes + 1)])
        check("as partes juntas somam o arquivo inteiro", len(buf) == total)
        check("parte alem do fim: 404", (await c.get(f"/bot/backup/{info['id']}", params={"part": partes + 1, "size": 1024}, headers=BK)).status_code == 404)
        check("id estranho (../) e' 404", (await c.get("/bot/backup/..%2F..%2Fetc%2Fpasswd", headers=BK)).status_code == 404)
        plain = _io.BytesIO()
        _bk.decrypt_to(_io.BytesIO(buf), plain, "senha-de-teste-do-backup")
        plain.seek(0)
        with _tar.open(fileobj=plain, mode="r:gz") as t:
            nomes = t.getnames()
            linhas = t.extractfile("db.ndjson").read().decode().splitlines()
        check("o arquivo decifrado tem db.ndjson com cabecalho e linhas de tabelas", "db.ndjson" in nomes and '"format": 1' in linhas[0] and len(linhas) - 1 == info["rows"])
        check("tabelas descartaveis (traffic_visitors, error_events) ficam fora", '"t": "traffic_visitors"' not in "\n".join(linhas) and '"t": "error_events"' not in "\n".join(linhas))
        try:
            _bk.decrypt_to(_io.BytesIO(buf), _io.BytesIO(), "senha-errada")
            ok_errada = False
        except ValueError:
            ok_errada = True
        check("senha errada nao abre o backup", ok_errada)
        check("o bot apaga o temporario (204) e ele some", (await c.delete(f"/bot/backup/{info['id']}", headers=BK)).status_code == 204
              and (await c.get(f"/bot/backup/{info['id']}", headers=BK)).status_code == 404)
    finally:
        settings.backup_passphrase = orig_pass

    secao("32) Manutencao automatica: apaga o que ficou velho e inutil (erros resolvidos, log antigo, acessos antigos) e limpa a memoria")
    from app.core import maintenance
    from app.core.database import AsyncSessionLocal as _SessM
    async with _SessM() as db:
        for fp, resolvido, dias in [("teste-manut-a", True, 40), ("teste-manut-b", False, 40), ("teste-manut-c", False, 120), ("teste-manut-d", True, 1)]:
            await db.execute(text("INSERT INTO error_events (id, fingerprint, source, level, title, message, count, first_seen, last_seen, resolved) VALUES (gen_random_uuid(), :fp, 'api', 'error', 'TESTE manutencao', 'x', 1, now(), now() - make_interval(days => :d), :r)"),
                             {"fp": fp, "d": dias, "r": resolvido})
        await db.execute(text("INSERT INTO audit_log (id, action, entity_type, entity_id, created_at) VALUES (gen_random_uuid(), 'teste-manut', 'teste', 'velho', now() - interval '400 days')"))
        await db.execute(text("INSERT INTO audit_log (id, action, entity_type, entity_id, created_at) VALUES (gen_random_uuid(), 'teste-manut', 'teste', 'novo', now())"))
        await db.execute(text("INSERT INTO traffic_daily (day, country, views, visitors) VALUES (current_date - 500, 'QM', 1, 1)"))
        await db.commit()
    async with _SessM() as db:
        feito = await maintenance.prune_database(db)
        restam = set((await db.execute(text("SELECT fingerprint FROM error_events WHERE fingerprint LIKE 'teste-manut-%'"))).scalars().all())
        audit = set((await db.execute(text("SELECT entity_id FROM audit_log WHERE action = 'teste-manut'"))).scalars().all())
        trafego = (await db.execute(text("SELECT count(*) FROM traffic_daily WHERE country = 'QM'"))).scalar()
    check("erro RESOLVIDO ha' 40 dias some; nao resolvido de 40 dias fica (so' some com 90)", "teste-manut-a" not in restam and "teste-manut-b" in restam, str(restam))
    check("erro sem ocorrencia ha' 120 dias some, mesmo nao resolvido; o recente fica", "teste-manut-c" not in restam and "teste-manut-d" in restam, str(restam))
    check("log geral com 400 dias some; o de hoje fica", audit == {"novo"}, str(audit))
    check("acessos com mais de 400 dias somem", trafego == 0 and feito["trafficDaily"] >= 1, str(feito))
    check("manutencao devolve o resumo do que apagou", feito["errorsResolved"] >= 1 and feito["errorsOld"] >= 1 and feito["auditLog"] >= 1, str(feito))
    from app.core.rate_limit import RateLimiter
    relogio = [0.0]
    lim = RateLimiter(time_fn=lambda: relogio[0])
    lim.hit("b", "ip1", 5, 60)
    lim.fail("f", "ip2", 900)
    relogio[0] = 120.0
    apagados = lim.sweep()
    check("limpeza da memoria: balde de 60s vencido some; o de 15 min (ainda valendo) fica", apagados == 1 and ("f", "ip2") in lim._hits and ("b", "ip1") not in lim._hits, str(lim._hits))
    async with _SessM() as db:
        await db.execute(text("DELETE FROM error_events WHERE fingerprint LIKE 'teste-manut-%'"))
        await db.execute(text("DELETE FROM audit_log WHERE action = 'teste-manut'"))
        await db.commit()

    secao("33) Reports de visitantes: conteudo desatualizado / erro de traducao (publico com defesas; so' reports.manage le e resolve)")
    from app.core.rate_limit import limiter as _lim
    from app.core.database import AsyncSessionLocal as _SessR
    ORIGEM = {"Origin": settings.frontend_origin}
    async with _SessR() as db:
        jutsu_id = (await db.execute(text("SELECT id FROM jutsus LIMIT 1"))).scalar()
        mastery_id = (await db.execute(text("SELECT id FROM masteries LIMIT 1"))).scalar()
    base = {"targetType": "content", "targetId": f"{SLUG}-drop-item", "kind": "translation", "message": "A traducao deste item esta errada no nome.", "locale": "pt"}
    _lim._hits.clear()
    r = await c.post("/reports", json=base, headers=ORIGEM)
    check("visitante anonimo envia report de um conteudo publicado (204)", r.status_code == 204, f"veio {r.status_code} {r.text[:120]}")
    r = await c.get("/reports?status=all", headers=A)
    meus = [x for x in r.json() if x["targetId"] == f"{SLUG}-drop-item"] if r.status_code == 200 else []
    check("Adm ve o report; nome e endereco da pagina vem do banco (nao do visitante)", len(meus) == 1 and meus[0]["targetPath"] == f"/detail/{SLUG}-drop-item" and meus[0]["status"] == "open" and "ip" not in str(meus[0]).lower(), r.text[:240])
    rep_id = meus[0]["id"] if meus else None
    settings.bot_api_token = "token-de-teste-do-bot"
    r = await c.get("/bot/reports", params={"since": "2000-01-01T00:00:00+00:00"}, headers={"X-Bot-Token": settings.bot_api_token})
    check("bot le os reports novos (aviso no Discord), sem IP", r.status_code == 200 and any(x["targetPath"] == f"/detail/{SLUG}-drop-item" for x in r.json())
          and "ip" not in str(r.json()).lower().replace("description", ""), r.text[:200])
    r = await c.get("/bot/reports", params={"since": "2000-01-01T00:00:00+00:00"})
    check("/bot/reports sem token do bot (401)", r.status_code == 401)
    for tipo, alvo in (("jutsu", jutsu_id), ("mastery", mastery_id)):
        if alvo:
            r = await c.post("/reports", json={**base, "targetType": tipo, "targetId": alvo, "kind": "outdated"}, headers=ORIGEM)
            check(f"report de {tipo} e' aceito", r.status_code == 204, f"veio {r.status_code} {r.text[:120]}")
    _lim._hits.clear()
    r = await c.post("/reports", json=base, headers=ORIGEM)
    r2 = await c.get("/reports?status=all", headers=A)
    check("mesmo texto, mesma pagina e mesmo IP nao cria duplicado", r.status_code == 204 and len([x for x in r2.json() if x["targetId"] == f"{SLUG}-drop-item"]) == 1, r2.text[:200])
    _lim._hits.clear()
    r = await c.post("/reports", json=base, headers={"Origin": "https://site-malicioso.example"})
    check("origem estranha e' barrada (403)", r.status_code == 403, f"veio {r.status_code}")
    r = await c.post("/reports", json={**base, "message": "curto"}, headers=ORIGEM)
    check("mensagem curta demais e' recusada (422)", r.status_code == 422, f"veio {r.status_code}")
    r = await c.post("/reports", json={**base, "message": "x" * 1001}, headers=ORIGEM)
    check("mensagem acima de 1000 caracteres e' recusada (422)", r.status_code == 422, f"veio {r.status_code}")
    _lim._hits.clear()
    r = await c.post("/reports", json={**base, "message": "veja http://a.com e http://b.com por favor"}, headers=ORIGEM)
    check("mais de 1 link e' recusado (422)", r.status_code == 422, f"veio {r.status_code}")
    r = await c.post("/reports", json={**base, "targetId": "nao-existe-teste-perm"}, headers=ORIGEM)
    check("pagina que nao existe e' recusada (404)", r.status_code == 404, f"veio {r.status_code}")
    await c.post("/content-items", json=novo_conteudo("rep-rascunho"), headers=C)   # fica em rascunho (Creator so' cria rascunho)
    r = await c.post("/reports", json={**base, "targetId": f"{SLUG}-rep-rascunho"}, headers=ORIGEM)
    check("pagina em rascunho nao recebe report (404)", r.status_code == 404, f"veio {r.status_code}")
    _lim._hits.clear()
    r = await c.post("/reports", json={**base, "kind": "hack"}, headers=ORIGEM)
    check("tipo de report invalido e' recusado (422)", r.status_code == 422, f"veio {r.status_code}")
    r = await c.post("/reports", json={**base, "message": "texto de robo bem comprido aqui", "website": "http://spam.example"}, headers=ORIGEM)
    r2 = await c.get("/reports?status=all", headers=A)
    check("robo que preenche o campo isca: 204 mas nada e' guardado", r.status_code == 204 and not any("robo" in x["message"] for x in r2.json()), r2.text[:160])
    _lim._hits.clear()
    codigos = [(await c.post("/reports", json={**base, "message": f"flood numero {i} do teste de limite"}, headers=ORIGEM)).status_code for i in range(6)]
    check("limite por IP: depois de 3 por minuto vem 429", 429 in codigos and codigos[0] == 204, str(codigos))
    _lim._hits.clear()
    r = await c.get("/reports")
    check("anonimo NAO lista reports (401)", r.status_code == 401, f"veio {r.status_code}")
    r = await c.get("/reports", headers=C)
    check("Creator NAO ve reports por padrao (403)", r.status_code == 403, f"veio {r.status_code}")
    r = await c.patch(f"/reports/{rep_id}", json={"status": "resolved"}, headers=A)
    check("Adm marca como resolvido (guarda quem e quando)", r.status_code == 200 and r.json()["status"] == "resolved" and r.json()["handledBy"], r.text[:200])
    r = await c.get("/reports", headers=A)
    check("report resolvido some da lista de abertos", all(x["id"] != rep_id for x in r.json()), r.text[:160])
    r = await c.patch(f"/reports/{rep_id}", json={"status": "open"}, headers=A)
    check("reabrir limpa quem resolveu", r.status_code == 200 and r.json()["handledBy"] is None, r.text[:200])
    r = await c.patch(f"/reports/{rep_id}", json={"status": "qualquer"}, headers=A)
    check("status invalido e' recusado (422)", r.status_code == 422, f"veio {r.status_code}")
    r = await c.delete(f"/reports/{rep_id}", headers=A)
    check("Adm apaga o report (204)", r.status_code == 204, f"veio {r.status_code}")
    async with _SessR() as db:
        await db.execute(text("DELETE FROM content_reports WHERE target_id LIKE :p OR target_id = 'nao-existe-teste-perm' OR message LIKE 'flood numero%' OR ip_address IS NOT NULL AND created_at > now() - interval '1 hour'"), {"p": f"{SLUG}%"})
        await db.commit()

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
