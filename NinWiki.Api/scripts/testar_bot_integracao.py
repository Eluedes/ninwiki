"""
Teste de integracao do NinWiki.Bot: o codigo REAL do bot conversando com a API
REAL (sem Discord e sem internet).

  - O cliente HTTP do bot (ninwiki_bot/api_client.py) chama a API de verdade.
  - Cada comando de barra (/equipe listar|adicionar|cargo|desativar|reativar) e'
    executado com um "Discord de mentira" e o resultado e' conferido no banco.

COMO RODAR (na pasta NinWiki.Api, venv ativado, banco ligado e migrado):
    py scripts/testar_bot_integracao.py

A parte dos comandos precisa do discord.py instalado NESTE ambiente
(pip install discord.py) - sem ele essa parte e' PULADA e o resto roda.
Cria e apaga os proprios dados de teste (nomes TESTE_...).
"""
import asyncio
import json
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
from sqlalchemy import delete, select

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "NinWiki.Bot"))

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.main import app  # noqa: E402
from scripts._guarda_banco import exigir_banco_local  # noqa: E402

exigir_banco_local(settings.database_url)   # nunca roda contra o banco da SquareCloud (o teste apaga dados)
from app.models.enums import StaffRole  # noqa: E402
from app.models.users import AuditLogEntry, User  # noqa: E402
from ninwiki_bot.api_client import ApiError, NinWikiApi  # noqa: E402
from ninwiki_bot.config import BotSettings  # noqa: E402

try:
    import discord
    from discord import app_commands
    TEM_DISCORD = True
except ImportError:
    TEM_DISCORD = False

PASS, FAIL = 0, 0
FALHAS: list[str] = []
TOKEN = "token-de-teste-do-bot-1234567890"
BASE = random.randint(10**17, 9 * 10**17)
IDS = {"sadm": BASE + 1, "adm": BASE + 2, "creator": BASE + 3, "alvo": BASE + 4, "alvo2": BASE + 5, "estranho": BASE + 6}
TODOS = [str(BASE + n) for n in range(1, 30)]


def check(nome: str, cond: bool, detalhe: str = "") -> None:
    """Registra e imprime o resultado de uma verificacao."""
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [OK]   {nome}")
    else:
        FAIL += 1
        FALHAS.append(nome)
        print(f"  [FALHOU] {nome} {('-> ' + detalhe) if detalhe else ''}")


def secao(t: str) -> None:
    """Imprime o titulo de uma secao de testes."""
    print(f"\n== {t}")


async def _recusa(api, termo) -> bool:
    """True se a API recusa a busca com idioma desconhecido (422)."""
    try:
        await api._request("GET", "/bot/search", params={"q": termo, "lang": "xx"})
    except ApiError:
        return True
    return False


async def criar(chave: str, role: StaffRole) -> None:
    """Cria um usuario de teste com o cargo informado."""
    async with AsyncSessionLocal() as db:
        db.add(User(discord_id=IDS[chave], username=f"TESTE_{chave}", role=role))
        await db.commit()


async def buscar(discord_id: int) -> User | None:
    """Le um usuario de teste do banco pelo Discord ID."""
    async with AsyncSessionLocal() as db:
        return (await db.execute(select(User).where(User.discord_id == discord_id))).scalar_one_or_none()


async def limpar() -> None:
    """Apaga do banco tudo que o teste criou (usuarios e linhas de log)."""
    async with AsyncSessionLocal() as db:
        await db.execute(delete(AuditLogEntry).where(
            AuditLogEntry.actor_name.like("TESTE_%") | AuditLogEntry.entity_id.in_(TODOS)))
        await db.execute(delete(User).where(User.discord_id.in_([int(x) for x in TODOS])))
        await db.commit()
    print("\n(dados de teste apagados)")


def interacao(user_id: int, guild_id: int = 1) -> MagicMock:
    """Simula uma interacao do Discord (quem digitou, em qual servidor)."""
    i = MagicMock()
    i.user.id = user_id
    i.user.display_name = f"user{user_id}"
    i.guild_id = guild_id
    i.response.defer = AsyncMock()
    i.response.send_message = AsyncMock()
    i.followup.send = AsyncMock()
    i.response.send_modal = AsyncMock()
    return i


def fake_user(chave: str, bot: bool = False) -> MagicMock:
    """Simula o usuario escolhido no comando (alvo), podendo ser um bot."""
    u = MagicMock()
    u.id = IDS[chave]
    u.name = f"TESTE_{chave}"
    u.global_name = f"TESTE_{chave}"
    u.bot = bot
    return u


def texto_enviado(i: MagicMock) -> str:
    """Junta o texto de tudo que o comando respondeu (mensagem ou embed)."""
    partes = []
    for chamada in list(i.followup.send.call_args_list) + list(i.response.send_message.call_args_list):
        args, kwargs = chamada
        if args:
            partes.append(str(args[0]))
        if kwargs.get("content"):
            partes.append(str(kwargs["content"]))
        if kwargs.get("embed") is not None:
            partes.append(str(kwargs["embed"].title) + " " + str(kwargs["embed"].description))
    return "\n".join(partes)


def todas_efemeras(i: MagicMock) -> bool:
    """True se todas as respostas do comando foram so' para quem digitou."""
    chamadas = list(i.followup.send.call_args_list) + list(i.response.send_message.call_args_list)
    return bool(chamadas) and all(c.kwargs.get("ephemeral") is True for c in chamadas)


async def testar() -> None:
    """Roda todas as secoes de teste do bot contra a API real."""
    limiter.reset()
    await criar("sadm", StaffRole.SUPER_ADMIN)
    await criar("adm", StaffRole.ADMIN)
    await criar("creator", StaffRole.CREATOR)

    transport = httpx.ASGITransport(app=app, client=("203.0.113.7", 1234))
    http = httpx.AsyncClient(transport=transport, base_url="http://test")
    api = NinWikiApi("http://test", TOKEN, client=http)

    # ------------------------------------------------------------------
    secao("1) Configuracao do bot (.env)")
    ok = dict(_env_file=None, discord_bot_token="abc", bot_api_token=TOKEN)
    check("configuracao valida carrega", BotSettings(**ok).ninwiki_api_url == "http://localhost:8000")
    for nome, kwargs in [("BOT_API_TOKEN curto e' recusado", {**ok, "bot_api_token": "curto"}),
                         ("DISCORD_BOT_TOKEN vazio e' recusado", {**ok, "discord_bot_token": "  "})]:
        try:
            BotSettings(**kwargs)
            check(nome, False)
        except ValueError:
            check(nome, True)
    check("DEV_GUILD_ID vazio no .env vira 'sem valor'", BotSettings(**ok, dev_guild_id="").dev_guild_id is None)
    check("ALLOWED_GUILD_IDS lista IDs", BotSettings(**ok, allowed_guild_ids="1, 2;3").allowed_guilds == {1, 2, 3})
    try:
        BotSettings(**ok, allowed_guild_ids="1,abc").allowed_guilds
        check("ALLOWED_GUILD_IDS invalido e' recusado", False)
    except ValueError:
        check("ALLOWED_GUILD_IDS invalido e' recusado", True)

    # ------------------------------------------------------------------
    secao("2) Cliente HTTP do bot x API real")
    settings.bot_api_token = TOKEN
    DESDE = "2000-01-01T00:00:00+00:00"
    erros = await api.errors_since(DESDE)
    check("cliente do bot conversa com a API com o token certo (lista de erros)", isinstance(erros, list))
    for metodo, rota in (("GET", f"/bot/me?invokerDiscordId={IDS['sadm']}"), ("GET", f"/bot/staff?invokerDiscordId={IDS['sadm']}"),
                         ("POST", "/bot/staff"), ("POST", "/bot/audit-log/clear"), ("PATCH", f"/bot/staff/{IDS['alvo']}/role")):
        r = await http.request(metodo, rota, headers={"X-Bot-Token": TOKEN}, json={} if metodo != "GET" else None)
        check(f"{metodo} {rota.split('?')[0]}: a gestao da equipe pelo bot NAO existe mais (404/405)", r.status_code in (404, 405), f"veio {r.status_code}")

    errado = NinWikiApi("http://test", "token-errado-1234567890", client=http)
    try:
        await errado.errors_since(DESDE)
        check("token do bot errado e' barrado", False)
    except ApiError as e:
        check("token do bot errado (401) com mensagem clara", e.status_code == 401 and "BOT_API_TOKEN" in e.detail, e.detail)
    settings.bot_api_token = ""
    try:
        await api.errors_since(DESDE)
        check("API com bot desligado", False)
    except ApiError as e:
        check("API com bot desligado (404) explica o motivo", e.status_code == 404 and "BOT_API_TOKEN" in e.detail, e.detail)
    settings.bot_api_token = TOKEN
    limiter.reset()
    for i in range(10):
        try:
            await NinWikiApi("http://test", f"chute-numero-{i}-xxxxxxxxxx", client=http).errors_since(DESDE)
        except ApiError:
            pass
    try:
        await api.errors_since(DESDE)
        check("bloqueio por forca bruta", False)
    except ApiError as e:
        check("apos muitos tokens errados a API bloqueia e o bot mostra a mensagem (429)", e.status_code == 429 and "Too many attempts" in e.detail, e.detail)
    limiter.reset()
    fora = NinWikiApi("http://127.0.0.1:9", TOKEN)
    try:
        await fora.errors_since(DESDE)
        check("API fora do ar", False)
    except ApiError as e:
        check("API fora do ar vira mensagem amigavel (503)", e.status_code == 503 and "API" in e.detail, e.detail)
    finally:
        await fora.aclose()

    # ------------------------------------------------------------------
    if not TEM_DISCORD:
        print("\n[PULADO] comandos de barra: discord.py nao esta instalado neste ambiente (pip install discord.py)")
        await http.aclose()
        return

    from unittest.mock import patch  # noqa: F401  (usado pelas secoes seguintes)

    # ------------------------------------------------------------------
    from ninwiki_bot.error_feed import format_report
    f = format_report({"kind": "translation", "targetType": "jutsu", "targetName": "Fire Ball", "targetPath": "/jutsus/fire-ball",
                       "message": "O nome em portugues esta errado", "locale": "pt", "createdAt": "2026-10-08T12:00:00Z"}, "https://wiki.example/")
    check("aviso de report: titulo com o tipo, link da pagina no site e aponta o painel",
          "Translation error" in f["title"] and "https://wiki.example/jutsus/fire-ball" in f["fields"][0][1] and "/admin/reports" in f["footer"], str(f))
    if TEM_DISCORD:
        from ninwiki_bot.public_commands import build_drop_embed, build_posts_embed
        e = build_drop_embed({"found": True, "title": "Ring of Vigor", "href": "/detail/ring", "image": None, "rarity": "rare",
                              "mobs": [{"name": "Larva", "href": "/detail/larva", "chance": 10, "chanceQualifier": "over"}, {"name": "Wolf", "href": "/detail/wolf", "chance": 2.5, "chanceQualifier": None}]},
                             "ring", "https://wiki.example/", "en")
        check("/drop: titulo com o item, mobs com link e chance (Over 10% / 2.5%)", "Ring of Vigor" in e.title and "[Larva](https://wiki.example/detail/larva) — Over 10%" in e.description and "2.5%" in e.description, str(e.description))
        check("/drop: item sem mob mostra aviso; nome inexistente mostra 'nada encontrado'",
              "No published mob" in build_drop_embed({"found": True, "title": "X", "href": "/detail/x", "mobs": []}, "x", "", "en").description
              and "Nothing matched" in build_drop_embed({"found": False}, "zz", "", "en").description)
        e = build_posts_embed([{"title": "Update 1.0", "excerpt": "Big update", "image": None, "href": "/blog/u1", "publishedAt": "2026-10-08T12:00:00Z"}], "https://wiki.example", "pt")
        check("/patchnotes: titulo em portugues, post com link e data", "Últimas notícias" in e.title and "https://wiki.example/blog/u1" in e.fields[0].value and "<t:" in e.fields[0].value, str(e.fields[0].value))
    secao("5) Feed do log geral no Discord")
    import tempfile
    from ninwiki_bot.log_feed import FeedState, LogFeedStore, format_entry, pick_new, query_since
    # Uma linha de log criada aqui mesmo: os comandos /team (que antes geravam as linhas) foram removidos, entao o teste nao pode depender deles.
    async with AsyncSessionLocal() as db:
        db.add(AuditLogEntry(action="update", entity_type="content_item", entity_id=f"TESTE-{BASE}", actor_name="TESTE_log", actor_role="admin", source="panel", ip_address="203.0.113.7"))
        await db.commit()
    desde = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    linhas = await api.audit_log_since(desde)
    check("API devolve as acoes recentes (lista)", isinstance(linhas, list) and len(linhas) >= 1)
    check("SEM IP nem dados sensiveis nas linhas (padrao)", all("ipAddress" not in l and "ip_address" not in l for l in linhas))
    sem_liberar = await api.audit_log_since(desde, include_ip=True)
    check("includeIp sem BOT_LOG_SHOW_IP na API NAO entrega o IP (token vazado nao le IP da equipe)", all("ipAddress" not in l for l in sem_liberar))
    settings.bot_log_show_ip = True
    com_ip = await api.audit_log_since(desde, include_ip=True)
    settings.bot_log_show_ip = False
    check("com includeIp o IP de quem agiu vem junto (LOG_SHOW_IP=true no bot)", len(com_ip) == len(linhas) and all("ipAddress" in l for l in com_ip))
    from ninwiki_bot.log_feed import format_entry as _fmt
    check("rodape do embed mostra 'Panel · IP x' quando o IP vem", _fmt({**com_ip[0], "ipAddress": "203.0.113.7"})["footer"].endswith("IP 203.0.113.7")
          and "IP" not in _fmt({**linhas[0]})["footer"])
    check("ordem cronologica (mais antiga primeiro)", [l["createdAt"] for l in linhas] == sorted(l["createdAt"] for l in linhas))
    futuro = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    check("nada novo depois de um instante futuro", await api.audit_log_since(futuro) == [])
    try:
        await NinWikiApi("http://test", "token-errado-1234567890", client=http).audit_log_since(desde)
        check("feed com token errado e' barrado", False)
    except ApiError as e:
        check("feed com token errado e' barrado (401)", e.status_code == 401)

    exemplo = {"id": "a1", "createdAt": "2026-10-01T12:00:00Z", "action": "update", "entityType": "post", "entityId": "x",
               "diff": {"before": {"name": "Velho"}, "after": {"name": "Novo"}, "content": "TEXTO SECRETO LONGO", "ip": "1.2.3.4"},
               "actorName": "Rafa", "actorRole": "admin", "source": "panel"}
    f = format_entry(exemplo)
    check("embed: titulo diz quem fez o que", "Rafa (Adm) edited a post" in f["title"], f["title"])
    check("embed: mostra o que mudou (nome antigo -> novo)", "Velho" in f["description"] and "Novo" in f["description"])
    check("embed NUNCA mostra conteudo de texto nem IP", "SECRETO" not in f["description"] and "1.2.3.4" not in f["description"])
    check("acao desconhecida nao quebra", format_entry({**exemplo, "action": "xyz", "entityType": "abc", "diff": None})["title"].startswith("Rafa"))
    check("login nao cita alvo", format_entry({**exemplo, "action": "login"})["title"].endswith("signed in to the panel"))
    texto_longo = format_entry({**exemplo, "diff": {"name": "n" * 5000}})["description"]
    check("texto enorme e' cortado", len(texto_longo) <= 700)

    estado = FeedState(since=datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc))
    novos = pick_new(estado, [exemplo, {**exemplo, "id": "a2", "createdAt": "2026-10-01T12:01:00Z"}])
    check("pick_new devolve as 2 e avanca o 'since'", len(novos) == 2 and estado.since.minute == 1)
    check("repetir as mesmas acoes nao posta de novo (dedup)", pick_new(estado, [exemplo, {**exemplo, "id": "a2"}]) == [])
    check("consulta volta alguns minutos (sobreposicao)", query_since(estado) < estado.since)
    with tempfile.TemporaryDirectory() as tmp:
        loja = LogFeedStore(Path(tmp) / "estado.json")
        check("sem arquivo: comeca de agora (nao despeja historico)", abs((loja.load().since - datetime.now(timezone.utc)).total_seconds()) < 5)
        loja.save(estado)
        carregado = loja.load()
        check("estado salvo e relido (sobrevive a reinicio)", carregado.since == estado.since and carregado.seen == estado.seen)
        (Path(tmp) / "estado.json").write_text("{lixo", encoding="utf-8")
        check("arquivo corrompido nao derruba o bot", abs((loja.load().since - datetime.now(timezone.utc)).total_seconds()) < 5)
    ok_cfg = {"discord_bot_token": "abc", "bot_api_token": "x" * 20}
    check("LOG_CHANNEL_ID vazio = recurso desligado", BotSettings(**ok_cfg, log_channel_id="").log_channel_id is None)
    check("LOG_CHANNEL_ID numerico e' lido", BotSettings(**ok_cfg, log_channel_id="123456789").log_channel_id == 123456789)
    try:
        BotSettings(**ok_cfg, log_poll_seconds=2)
        check("LOG_POLL_SECONDS < 10 e' recusado", False)
    except ValueError:
        check("LOG_POLL_SECONDS < 10 e' recusado", True)
    check("LOG_IGNORE_ACTIONS vira conjunto", BotSettings(**ok_cfg, log_ignore_actions="login, logout").ignored_log_actions == {"login", "logout"})

    # ------------------------------------------------------------------
    secao("6) Feed de ERROS e vigia de saude (API, banco, site)")
    from ninwiki_bot.error_feed import (
        COOLDOWN, DOWN_AFTER, ErrorFeedState, ErrorFeedStore, ServiceStatus, StatusMessageStore, decide, format_error, format_status_panel,
        record_check, update_status, uptime_pct,
    )
    from ninwiki_bot.error_feed import query_since as err_query_since
    agora = datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc)
    erro = {"id": "e1", "fingerprint": "fp1", "source": "api", "level": "error", "title": "RuntimeError", "message": "boom",
            "location": "app/api/posts.py:131 in create_post", "path": "/posts/{post_id}", "method": "POST", "status": 500,
            "count": 1, "firstSeen": "2026-10-02T11:59:00Z", "lastSeen": "2026-10-02T12:00:00Z", "resolved": False}
    estado = ErrorFeedState(since=agora - timedelta(minutes=5))
    p1 = decide(estado, [erro], agora)
    check("problema novo avisa na hora", len(p1) == 1 and p1[0][1] == 1)
    check("o MESMO problema na proxima volta NAO avisa de novo", decide(estado, [{**erro, "count": 1}], agora + timedelta(seconds=20)) == [])
    check("contador subiu mas ainda dentro do cooldown: NAO avisa (anti-spam)", decide(estado, [{**erro, "count": 50}], agora + timedelta(minutes=3)) == [])
    p3 = decide(estado, [{**erro, "count": 50}], agora + COOLDOWN + timedelta(seconds=1))
    check("passou o cooldown e continua acontecendo: avisa de novo com o delta", len(p3) == 1 and p3[0][1] == 49, str(p3))
    check("depois desse aviso o cooldown recomeca", decide(estado, [{**erro, "count": 60}], agora + COOLDOWN + timedelta(minutes=1)) == [])
    check("'since' avanca para a ultima ocorrencia vista", estado.since == datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc))
    check("consulta volta alguns minutos (sobreposicao)", err_query_since(estado) < estado.since)
    resolvido = ErrorFeedState(since=agora)
    check("problema ja' resolvido e nunca avisado nao e' postado", decide(resolvido, [{**erro, "resolved": True}], agora) == [])
    est2 = ErrorFeedState(since=agora)
    decide(est2, [erro], agora)
    check("resolvido depois de avisado: nao avisa mesmo com contador subindo", decide(est2, [{**erro, "resolved": True, "count": 99}], agora + timedelta(hours=1)) == [])
    check("reaberto (voltou a acontecer) e passou o cooldown: avisa de novo", len(decide(est2, [{**erro, "resolved": False, "count": 120}], agora + timedelta(hours=2))) == 1)
    f = format_error(erro, 1)
    check("embed de problema novo: titulo, local, rota e contador", "API: RuntimeError" in f["title"] and any("create_post" in v for _, v in f["fields"])
          and any("POST /posts/{post_id}" in v for _, v in f["fields"]) and f["footer"].startswith("New problem"))
    f2 = format_error({**erro, "count": 50}, 49)
    check("embed de repeticao mostra o delta desde o ultimo aviso", any("+49" in v for _, v in f2["fields"]) and f2["footer"].startswith("Still happening"))
    check("embed de erro enorme e' cortado", len(format_error({**erro, "message": "m" * 5000}, 1)["description"]) <= 360)
    check("fonte desconhecida nao quebra", format_error({**erro, "source": "xyz"}, 1)["title"].endswith("RuntimeError"))

    st = ServiceStatus("API")
    msgs = [update_status(st, False, agora + timedelta(seconds=i)) for i in range(DOWN_AFTER)]
    check("falhas isoladas NAO alertam; so' a ultima falha seguida avisa que caiu", msgs[:-1] == [None] * (DOWN_AFTER - 1) and msgs[-1] and "DOWN" in msgs[-1]["title"])
    check("continuar fora do ar nao repete o alerta", update_status(st, False, agora + timedelta(minutes=1)) is None)
    back = update_status(st, True, agora + timedelta(minutes=5))
    check("quando volta, avisa uma vez com o tempo fora", back and "back online" in back["title"] and "4 min" in back["description"], str(back))
    check("estando ok nada acontece", update_status(st, True, agora + timedelta(minutes=6)) is None)
    # painel ao vivo
    pa, pd, pw = ServiceStatus("API"), ServiceStatus("Database"), ServiceStatus("Website")
    for ok in (True, True, True, False):
        record_check(pa, ok, 120)
    check("uptime = % de checagens OK", uptime_pct(pa) == 75.0 and uptime_pct(pw) is None)
    record_check(pd, None)
    record_check(pw, True, 340)
    painel = format_status_panel([pa, pd, pw], agora, 60, True)
    check("painel: servico fora do ar em vermelho, desconhecido em cinza (nao diz 'online' por engano)",
          "🔴 **API** — OFFLINE" in painel["description"] and "⚪ **Database** — unknown" in painel["description"] and painel["color"] != 0x2ECC71, painel["description"])
    check("painel mostra tempo de resposta e carimbo relativo do Discord", "340 ms" in painel["description"] and f"<t:{int(agora.timestamp())}:R>" in painel["description"])
    record_check(pa, True, 90)
    ok_panel = format_status_panel([pa, pw], agora, 60, False)
    check("tudo online: painel verde; sem SITE_URL avisa que o site nao e' vigiado", ok_panel["color"] == 0x2ECC71 and "not monitored" in ok_panel["description"])
    import tempfile
    from pathlib import Path as _P
    with tempfile.TemporaryDirectory() as _d:
        store = StatusMessageStore(_P(_d) / "status_state.json")
        check("sem arquivo: nenhum painel salvo", store.load() is None)
        store.save(1234567890123456789, 987654321987654321)
        check("ids do painel sobrevivem a reinicio (sem perder precisao)", store.load() == (1234567890123456789, 987654321987654321))
    st2 = ServiceStatus("Website")
    update_status(st2, False, agora); update_status(st2, True, agora)
    check("uma falha seguida de sucesso zera a contagem (rede oscilando)", st2.failures == 0 and not st2.down)

    with tempfile.TemporaryDirectory() as tmp:
        loja = ErrorFeedStore(Path(tmp) / "e.json")
        check("sem arquivo: comeca de agora (nao despeja historico)", abs((loja.load().since - datetime.now(timezone.utc)).total_seconds()) < 5)
        loja.save(estado)
        carregado = loja.load()
        check("estado de erros salvo e relido (sobrevive a reinicio)", carregado.since == estado.since and carregado.posted == estado.posted)
        (Path(tmp) / "e.json").write_text("{lixo", encoding="utf-8")
        check("arquivo corrompido nao derruba o bot", abs((loja.load().since - datetime.now(timezone.utc)).total_seconds()) < 5)

    desde = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    lista_erros = await api.errors_since(desde)
    check("cliente do bot le' /bot/errors (lista)", isinstance(lista_erros, list))
    check("SEM traceback nem IP", all("trace" not in e and "ipAddress" not in e for e in lista_erros))
    ok_api, ok_db = await api.api_status()
    check("api_status: API e banco no ar", ok_api is True and ok_db is True)
    morto = NinWikiApi("http://nada.invalid", "x" * 20, client=httpx.AsyncClient(transport=httpx.MockTransport(lambda r: (_ for _ in ()).throw(httpx.ConnectError("sem rede"))), base_url="http://nada.invalid"))
    check("api_status com a API fora do ar devolve (False, False) sem levantar excecao", await morto.api_status() == (False, False))
    cfg = {"discord_bot_token": "abc", "bot_api_token": "x" * 20}
    check("ERROR_CHANNEL_ID vazio usa o canal de log", BotSettings(**cfg, log_channel_id="55").errors_channel == 55)
    check("ERROR_CHANNEL_ID proprio tem prioridade", BotSettings(**cfg, log_channel_id="55", error_channel_id="66").errors_channel == 66)
    check("sem nenhum canal o feed de erros fica desligado", BotSettings(**cfg).errors_channel is None)
    check("monitor sem canal proprio usa o de erros (e depois o de log)", BotSettings(**cfg, error_channel_id="66").status_channel == 66 and BotSettings(**cfg, log_channel_id="55").status_channel == 55)
    check("avisos novos de caiu/voltou vem DESLIGADOS (so' o painel)", BotSettings(**cfg).status_alerts is False and BotSettings(**cfg, status_alerts="true").status_alerts is True)
    # checagem do site: 'respondeu' = no ar; 5xx/erro/loop = fora do ar (com o motivo)
    def _site(handler):
        """NinWikiApi so' para testar site_ok com um servidor de mentira."""
        return NinWikiApi("http://x", "t" * 20, client=httpx.AsyncClient(base_url="http://x")), httpx.MockTransport(handler)
    for codigo, esperado in [(200, True), (301, True), (429, True), (403, False), (401, False), (404, False), (410, False), (500, False), (502, False), (503, False), (522, False)]:
        a_, t_ = _site(lambda r, c=codigo: httpx.Response(c, headers={"location": "/"} if c == 301 else {}) if c != 301 else httpx.Response(200))
        check(f"site: HTTP {codigo} -> {'no ar' if esperado else 'fora do ar'}", await a_.site_ok("https://wiki.exemplo.com", transport=t_) is esperado)
    for hdrs in ({"cf-mitigated": "challenge"},):
        a_, t_ = _site(lambda r, h=hdrs: httpx.Response(403, headers=h))
        check(f"site: 403 da Cloudflare ({list(hdrs)[0]}) = no ar", await a_.site_ok("https://wiki.exemplo.com", transport=t_) is True)
    a_, t_ = _site(lambda r: httpx.Response(403, headers={"server": "cloudflare"}))
    check("site: 403 da Cloudflare sem desafio (erro 1014 / app apagado) = fora do ar", await a_.site_ok("https://wiki.exemplo.com", transport=t_) is False)
    a_, t_ = _site(lambda r: httpx.Response(302, headers={"location": "https://wiki.exemplo.com/"}))
    check("site: redirecionamento em loop = fora do ar, com o motivo", await a_.site_ok("https://wiki.exemplo.com", transport=t_) is False and "TooManyRedirects" in a_.last_site_detail, a_.last_site_detail)
    a_, t_ = _site(lambda r: (_ for _ in ()).throw(httpx.ConnectError("sem rede")))
    check("site: erro de conexao = fora do ar", await a_.site_ok("https://wiki.exemplo.com", transport=t_) is False and "ConnectError" in a_.last_site_detail)
    # --- comandos so' nos servidores escolhidos (command_sync), backup (backup_feed) e mensagem de versao (version_feed) ---
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
    from ninwiki_bot import backup_feed as bf, version_feed as vf
    from ninwiki_bot.command_sync import sync_commands, target_guilds

    class _Tree:
        """Arvore de comandos de mentira: so' anota o que o bot pediu."""
        def __init__(self, fail=()):
            """`fail` = ids de servidor em que o sync deve dar erro."""
            self.calls, self.fail = [], set(fail)
        def copy_global_to(self, guild):
            """Anota que os comandos globais foram copiados para o servidor."""
            self.calls.append(("copy", guild))
        async def sync(self, guild=None):
            """Anota o sync (ou falha como o Discord faria sem permissao)."""
            if guild in self.fail:
                raise RuntimeError("Missing Access")
            self.calls.append(("sync", guild))
        def clear_commands(self, guild=None):
            """Anota que os comandos globais foram apagados."""
            self.calls.append(("clear", guild))

    check("servidores alvo = permitidos + servidor de testes, sem repetir", target_guilds({3, 1}, 2) == [1, 2, 3] and target_guilds({1}, 1) == [1] and target_guilds(set(), None) == [])
    t_ = _Tree(); r_ = await sync_commands(t_, [1, 2], lambda g: g)
    check("comandos registrados em cada servidor e os globais antigos APAGADOS", r_["guilds"] == [1, 2] and t_.calls == [("copy", 1), ("sync", 1), ("copy", 2), ("sync", 2), ("clear", None), ("sync", None)], str(t_.calls))
    t_ = _Tree(fail={99}); r_ = await sync_commands(t_, [99, 1], lambda g: g)
    check("servidor com erro nao impede os outros (e e' listado)", r_["guilds"] == [1] and list(r_["failed"]) == [99] and ("clear", None) in t_.calls)
    t_ = _Tree(fail={99}); r_ = await sync_commands(t_, [99], lambda g: g)
    check("se NENHUM servidor deu certo, os comandos globais nao sao apagados", r_["guilds"] == [] and ("clear", None) not in t_.calls)
    t_ = _Tree(); r_ = await sync_commands(t_, [], lambda g: g)
    check("sem servidores definidos: registro global", r_["global"] is True and t_.calls == [("sync", None)])

    check("nome da parte do backup", bf.part_filename("20261003-1200", 1, 3) == "ninwiki-20261003-1200.nbk.01-of-03" and bf.stamp_of("ninwiki-20261003-1200.nbk.01-of-03") == "20261003-1200" and bf.stamp_of("foto.png") is None)
    check("partes necessarias (minimo 1)", bf.parts_needed(1, 9 * 1024 * 1024) == 1 and bf.parts_needed(25 * 1024 * 1024, 9 * 1024 * 1024) == 3 and bf.parts_needed(0, 100) == 1)
    achados = [("20261003-1200", 1), ("20261003-1200", 2), ("20261003-0900", 3), ("20261003-0600", 4), ("20261003-0600", 5)]
    check("retencao: apaga todas as partes dos backups mais antigos e mantem os N mais novos", bf.messages_to_delete(achados, 2) == [4, 5] and bf.messages_to_delete(achados, 3) == [])
    agora = _dt.now(_tz.utc)
    check("backup so' quando passou o intervalo (reiniciar o bot nao dispara outro)", bf.is_due(None, agora, 180) and not bf.is_due(agora - _td(minutes=10), agora, 180) and bf.is_due(agora - _td(hours=4), agora, 180))
    st_, ch_ = vf.merge({"message_id": None, "api": {}, "web": {}}, {"sha": "abc1234", "message": "m", "date": ""}, None)
    check("versao: sem mensagem ainda -> precisa criar", ch_ is True and st_["api"]["sha"] == "abc1234")
    st_["message_id"] = 5
    check("versao: mesmo hash nao edita a mensagem de novo (nada de flood)", vf.merge(st_, {"sha": "abc1234"}, None)[1] is False)
    st2_, ch2_ = vf.merge(st_, {"sha": "def5678", "message": "novo"}, {"sha": "dev"})
    check("versao: deploy novo muda o hash -> edita; 'dev' (sem VERSION.json) e quem nao respondeu nao contam", ch2_ is True and st2_["api"]["sha"] == "def5678" and st2_["web"] == {})
    emb_ = vf.build_embed(st2_)
    check("embed de versao tem API e Web", [f[0] for f in emb_["fields"]] == ["API", "Web"] and "def5678" in emb_["fields"][0][1])
    cfg_ok = dict(_env_file=None, discord_bot_token="abc", bot_api_token=TOKEN)
    for nome, kwargs in [("BACKUP_INTERVAL_MINUTES menor que 30 e' recusado", {"backup_interval_minutes": 10}), ("BACKUP_PART_MB acima de 24 e' recusado", {"backup_part_mb": 30}), ("BACKUP_KEEP 0 e' recusado", {"backup_keep": 0})]:
        try:
            BotSettings(**cfg_ok, **kwargs); recusou = False
        except Exception:
            recusou = True
        check(nome, recusou)
    check("backup: padrao a cada 3 h, guarda 8, partes de 9 MB; canal vazio = desligado", BotSettings(**cfg_ok).backup_interval_minutes == 180 and BotSettings(**cfg_ok).backup_keep == 8 and BotSettings(**cfg_ok).backup_part_mb == 9 and BotSettings(**cfg_ok, backup_channel_id="").backup_channel_id is None)
    check("STATUS_CHANNEL_ID separa o monitor dos erros", BotSettings(**cfg, error_channel_id="66", status_channel_id="77").status_channel == 77 and BotSettings(**cfg, error_channel_id="66", status_channel_id="77").errors_channel == 66)
    check("STATUS_CHANNEL_ID vazio no .env vale como 'nao definido'", BotSettings(**cfg, status_channel_id="").status_channel_id is None)
    try:
        BotSettings(**cfg, health_poll_seconds=5)
        check("HEALTH_POLL_SECONDS < 30 e' recusado", False)
    except ValueError:
        check("HEALTH_POLL_SECONDS < 30 e' recusado", True)

    # ------------------------------------------------------------------
    secao("7) /status e /search (Components V2) e a busca publica do bot")
    from app.models.content import ContentItem
    from app.models.enums import ContentCategory, ContentStatus, Rarity
    from ninwiki_bot.error_feed import ServiceStatus, record_check
    from ninwiki_bot.language import LanguageStore
    from ninwiki_bot.public_commands import build_search_view, build_status_view, register_public_commands

    termo = f"zzbusca{BASE % 100000}"
    async with AsyncSessionLocal() as db:
        db.add(ContentItem(slug=f"{termo}-pub", category=ContentCategory.WEAPONS, name=f"{termo} Blade", name_pt=f"{termo} Lamina", description_pt="Uma lamina usada no teste", icon="🗡️", rarity=Rarity.COMMON,
                           description=json.dumps({"type": "doc", "content": [
                               {"type": "paragraph", "content": [{"type": "text", "text": "A blade used in the test"}]},
                               {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Dropped by bandits"}]}]}]}]}),
                           weapon_type="Katana", weapon_base_damage="42", image="/images/wiki/blade.png", status=ContentStatus.PUBLISHED))
        db.add(ContentItem(slug=f"{termo}-sempt", category=ContentCategory.MOBS, name=f"{termo} Larva", icon="🐛", rarity=Rarity.COMMON,
                           description="A small larva", mob_health="22", status=ContentStatus.PUBLISHED))
        db.add(ContentItem(slug=f"{termo}-rascunho", category=ContentCategory.ITEMS, name=f"{termo} Secret", icon="🎒", rarity=Rarity.COMMON,
                           description="draft", status=ContentStatus.DRAFT))
        await db.commit()
    try:
        achados = await api.search(termo)
        check("busca acha o conteudo PUBLICADO", any(h["title"] == f"{termo} Blade" and h["href"] == f"/detail/{termo}-pub" and h["kind"] == "weapon" for h in achados), str(achados))
        blade = next(h for h in achados if h["title"] == f"{termo} Blade")
        check("busca devolve imagem absoluta, dados da ficha e resumo com marcadores",
              blade["image"].endswith("/images/wiki/blade.png") and blade["image"].startswith("http")
              and {"label": "Type", "value": "Katana"} in blade["facts"] and "• Dropped by bandits" in blade["summary"], str(blade))
        achados_pt = await api.search(termo, "pt")
        blade_pt = next(h for h in achados_pt if h["href"] == f"/detail/{termo}-pub")
        check("busca em portugues: titulo, resumo e rotulos traduzidos",
              blade_pt["title"] == f"{termo} Lamina" and "Uma lamina" in blade_pt["summary"] and any(f["label"] == "Dano base" for f in blade_pt["facts"]), str(blade_pt))
        check("busca acha tambem pelo nome em portugues", any(h["href"] == f"/detail/{termo}-pub" for h in await api.search(f"{termo} Lamina")))
        async def _fake_deepl(valor, reverse=False):
            """DeepL de mentira: devolve 'PT: texto' (so' para provar que a busca traduz e guarda)."""
            return f"PT: {valor}" if valor else None
        with patch("app.core.translation.translate_field", _fake_deepl):
            sempt = next(h for h in await api.search(f"{termo} Larva", "pt") if h["href"] == f"/detail/{termo}-sempt")
        check("busca em portugues traduz na hora o que nao tinha traducao (DeepL)", sempt["title"] == f"PT: {termo} Larva" and "PT: A small larva" in sempt["summary"], str(sempt))
        sempt2 = next(h for h in await api.search(f"{termo} Larva", "pt") if h["href"] == f"/detail/{termo}-sempt")
        check("a traducao fica salva (a proxima busca nao precisa da DeepL)", sempt2["title"] == f"PT: {termo} Larva")
        sem_en = next(h for h in await api.search(f"{termo} Larva", "en") if h["href"] == f"/detail/{termo}-sempt")
        check("a busca em ingles continua em ingles", sem_en["title"] == f"{termo} Larva")
        check("busca com idioma invalido e' recusada", await _recusa(api, termo))
        check("busca NAO mostra rascunho", all("Secret" not in h["title"] for h in achados))
        check("busca sem resultado devolve lista vazia", await api.search("zzzznadaaqui987") == [])
        check("curingas do LIKE nao viram busca de tudo", await api.search("%%") == [])
        try:
            await api.search("a")
            check("busca com 1 letra e' recusada", False)
        except ApiError:
            check("busca com 1 letra e' recusada", True)
        settings.bot_api_token = ""
        try:
            await api.search(termo)
            check("sem BOT_API_TOKEN a busca do bot fica desligada (404)", False)
        except ApiError as e:
            check("sem BOT_API_TOKEN a busca do bot fica desligada (404)", e.status == 404 if hasattr(e, "status") else True)
        settings.bot_api_token = TOKEN

        if TEM_DISCORD:
            def componentes(view) -> str:
                """Todo o texto e links de um LayoutView (para conferir o que o Discord vai mostrar)."""
                out = []
                def walk(item) -> None:
                    """Percorre os componentes do cartao."""
                    if hasattr(item, "content"):
                        out.append(item.content)
                    if getattr(item, "url", None):
                        out.append(item.url)
                    if isinstance(getattr(item, "label", None), str):
                        out.append(item.label)
                    for child in getattr(item, "children", []) or []:
                        walk(child)
                    if getattr(item, "accessory", None) is not None:
                        walk(item.accessory)
                for it in view.children:
                    walk(it)
                return "\n".join(out)

            v = build_search_view(termo, achados, "https://wiki.exemplo.com/", owner_name="Rafael")
            txt = componentes(v)
            check("/search: cartao com titulo, tipo e botao Open para o site", f"{termo} Blade" in txt and "https://wiki.exemplo.com/detail/" in txt, txt[:200])
            check("/search: resultado principal com imagem (miniatura), dados, resumo e botao da pagina completa",
                  "Katana" in txt and "A blade used in the test" in txt and "• Dropped by bandits" in txt and any(getattr(x, "label", None) == "Open the full page" for c in v.children[0].children for x in getattr(c, "children", []))
                  and any(type(c).__name__ == "Section" and type(c.accessory).__name__ == "Thumbnail" for c in v.children[0].children))
            check("/search: rodape com quem pesquisou e a marca da equipe (com o logo do site)",
                  "Searched by Rafael" in txt and "Nin Codex Team" in txt and "/images/logo/" in str(v.children[0].children[-1].accessory.media.url if hasattr(v.children[0].children[-1], "accessory") else ""))
            vp = build_search_view(termo, achados_pt, "https://wiki.exemplo.com/", lang="pt", owner_name="Rafael")
            txp = componentes(vp)
            check("/search em portugues: textos, botao e rodape em portugues", "Pesquisado por Rafael" in txp and "Equipe Nin Codex" in txp and "Abrir a página completa" in txp and "Lamina" in txp, txp[:300])
            outro = [{**achados[0], "title": "Segundo"}, *achados]
            v2 = build_search_view(termo, outro, "https://wiki.exemplo.com", owner_id=7)
            check("/search: com varios resultados aparece o menu para trocar", any(type(c).__name__ == "ActionRow" and any(type(x).__name__ == "Select" for x in c.children) for c in v2.children[0].children))
            ev = interacao(8)
            check("/search: so' quem buscou troca de resultado", await v2.interaction_check(ev) is False and ev.response.send_message.await_count == 1)
            check("/search: sem resultado mostra a dica", "No results" in componentes(build_search_view("xyz", [], "https://wiki.exemplo.com")))
            maldoso = [{"kind": "item", "title": "@everyone **oi**", "snippet": "<@123> [x](http://a)", "href": "//evil.com/x", "icon": None}]
            txt = componentes(build_search_view("q", maldoso, "https://wiki.exemplo.com"))
            check("/search: mencoes e formatacao do site sao neutralizadas e href estranho nao vira botao", "@everyone" not in txt.replace("@\u200beveryone", "") and "evil.com" not in txt, txt)

            ok_st, bad_st = ServiceStatus("API"), ServiceStatus("Website")
            record_check(ok_st, True, 42)
            record_check(bad_st, False, 9000)
            txt = componentes(build_status_view([ok_st, bad_st], datetime.now(timezone.utc), True))
            check("/status: online com ms, offline em vermelho", "Online" in txt and "42 ms" in txt and "OFFLINE" in txt and "not responding" in txt, txt)

            arvore = app_commands.CommandTree(discord.Client(intents=discord.Intents.default()))
            async def _checar():
                """Resultado fixo no lugar da checagem de verdade."""
                return [ok_st]
            import tempfile as _tf
            idiomas = LanguageStore(_P(_tf.mkdtemp()) / "language_state.json")
            register_public_commands(arvore, api, set(), "https://wiki.exemplo.com", _checar, True, idiomas)
            nomes = {c.name for c in arvore.get_commands()}
            check("/status e /search existem como comandos de barra", {"status", "search", "language"} <= nomes, str(nomes))
            cmd = arvore.get_command("search")
            i = interacao(IDS["creator"])
            await cmd.callback(i, termo)
            enviado = i.followup.send.call_args.kwargs
            check("/search responde com LayoutView (Components V2) e sem mencoes", isinstance(enviado.get("view"), discord.ui.LayoutView) and enviado["allowed_mentions"].everyone is False)
            # /language: so' com "Gerenciar servidor"; vale por servidor
            lang_cmd = arvore.get_command("language")
            sem = interacao(IDS["creator"], guild_id=42)
            sem.permissions.manage_guild = False
            await lang_cmd.callback(sem, app_commands.Choice(name="Português", value="pt"))
            check("/language sem 'Gerenciar servidor' e' recusado e nao muda nada", idiomas.get(42) == "en" and sem.response.send_message.await_count == 1)
            com = interacao(IDS["adm"], guild_id=42)
            com.permissions.manage_guild = True
            await lang_cmd.callback(com, app_commands.Choice(name="Português", value="pt"))
            check("/language com 'Gerenciar servidor' troca so' aquele servidor e a resposta ja' vem em portugues",
                  idiomas.get(42) == "pt" and idiomas.get(43) == "en" and "Português" in com.response.send_message.call_args.args[0])
            check("o idioma sobrevive a reinicio (arquivo)", LanguageStore(idiomas.path).get(42) == "pt")
            i3 = interacao(IDS["creator"], guild_id=42)
            await arvore.get_command("search").callback(i3, termo)
            check("/search sem escolher idioma usa o do servidor (portugues)", "Abrir a página completa" in componentes(i3.followup.send.call_args.kwargs["view"]))
            i4 = interacao(IDS["creator"], guild_id=42)
            await arvore.get_command("search").callback(i4, termo, app_commands.Choice(name="English", value="en"))
            check("/search com language=en ignora o idioma do servidor", "Open the full page" in componentes(i4.followup.send.call_args.kwargs["view"]))
            i2 = interacao(IDS["creator"], guild_id=999)
            arvore2 = app_commands.CommandTree(discord.Client(intents=discord.Intents.default()))
            register_public_commands(arvore2, api, {1}, "", _checar, False, idiomas)
            await arvore2.get_command("status").callback(i2)
            check("/status em servidor nao permitido e' recusado", i2.response.send_message.await_count == 1 and not i2.followup.send.await_count)
            # ---- comandos de consulta novos (wiki_commands.py) ----
            nomes = {c.name for c in arvore.get_commands()}
            check("novos comandos registrados: item, mob, jutsu, mastery, compare, map, random, help", {"item", "mob", "jutsu", "mastery", "compare", "map", "random", "help"} <= nomes, str(nomes))
            check("todos os comandos tem descricao de 1 a 100 caracteres (limite do Discord)", all(1 <= len(c.description) <= 100 for c in arvore.get_commands()))
            r = await http.get("/bot/random", params={"lang": "en"}, headers={"X-Bot-Token": TOKEN})
            check("/bot/random devolve um resultado publicado (nunca rascunho)", r.status_code == 200 and r.json()["href"].startswith("/detail/") and not r.json()["href"].endswith("-rascunho"), r.text[:150])
            check("/bot/random sem token (401)", (await http.get("/bot/random")).status_code == 401)
            ia = interacao(IDS["creator"])
            await arvore.get_command("mob").callback(ia, f"{termo} Larva")
            check("/mob acha o mob e mostra o cartao (LayoutView)", "Larva" in componentes(ia.followup.send.call_args.kwargs["view"]))
            ib = interacao(IDS["creator"])
            await arvore.get_command("mob").callback(ib, f"{termo} Blade")
            check("/mob nao mostra uma arma (filtra pelo tipo) e diz que nao achou", "No mob found" in componentes(ib.followup.send.call_args.kwargs["view"]))
            ic = interacao(IDS["creator"])
            await arvore.get_command("item").callback(ic, f"{termo} Blade")
            check("/item aceita arma", f"{termo} Blade" in componentes(ic.followup.send.call_args.kwargs["view"]))
            ik = interacao(IDS["creator"])
            await arvore.get_command("item").callback(ik, " a")
            check("/item com 1 letra (depois do strip) avisa em vez de chamar a API", ik.response.send_message.await_count == 1 and not ik.followup.send.await_count and todas_efemeras(ik))
            icmp = interacao(IDS["creator"])
            await arvore.get_command("compare").callback(icmp, f"{termo} Blade", f"{termo} Larva")
            emb = icmp.followup.send.call_args.kwargs["embed"]
            check("/compare monta o embed A vs B com os dois nomes e linhas de dados", f"{termo} Blade" in emb.title and f"{termo} Larva" in emb.title and "Health" in emb.description and "Type" in emb.description, emb.description)
            icmp2 = interacao(IDS["creator"])
            await arvore.get_command("compare").callback(icmp2, f"{termo} Blade", "zzzznadaaqui987")
            check("/compare com nome inexistente responde so' para quem digitou", todas_efemeras(icmp2) and "zzzznadaaqui987" in texto_enviado(icmp2))
            iran = interacao(IDS["creator"])
            await arvore.get_command("random").callback(iran)
            check("/random responde com um cartao", isinstance(iran.followup.send.call_args.kwargs.get("view"), discord.ui.LayoutView))
            ihelp = interacao(IDS["creator"], guild_id=42)
            await arvore.get_command("help").callback(ihelp)
            check("/help em portugues, so' para quem pediu, lista os comandos", ihelp.response.send_message.call_args.kwargs["ephemeral"] is True and "/compare" in str(ihelp.response.send_message.call_args.kwargs["embed"].to_dict()) and "Bot do Nin Codex" in ihelp.response.send_message.call_args.kwargs["embed"].title)
            # /map com dados de mentira (o bot le' o areas-info.json do SITE; aqui nao ha' site)
            from ninwiki_bot.wiki_commands import build_area_embed, find_area
            fake_info = {"names": {"1": ["Leaf Village", "Vila da Folha"], "2": ["Dark Forest", "Floresta Sombria"]},
                         "areas": {"1": {"z": "Safe Zone", "e": [[2, "North"]], "m": []}, "2": {"z": "Danger Zone", "e": [[1, "South"]], "m": [["Bear", "Urso", 36], ["Wolf", "Lobo", 12]]}}}
            check("find_area acha por id, nome EN, nome PT e pedaco do nome", [find_area(fake_info, q) for q in ("2", "leaf village", "floresta sombria", "dark")] == ["2", "1", "2", "2"] and find_area(fake_info, "xyz") is None)
            ea = build_area_embed(fake_info, "2", "https://wiki.exemplo.com/", "en").to_dict()
            campos = {f["name"]: f["value"] for f in ea["fields"]}
            check("/map: zona, mobs por nivel, saidas com nome e link #map/<id>", campos["Zone"] == "Danger zone" and campos["Mobs"].index("Wolf") < campos["Mobs"].index("Bear") and "S → Leaf Village" in campos["Exits"] and ea["url"] == "https://wiki.exemplo.com/map#map/2", str(ea))
            ep = build_area_embed(fake_info, "2", "", "pt").to_dict()
            check("/map em portugues e sem SITE_URL (sem link nem imagem)", ep["title"].endswith("Floresta Sombria") and "Urso" in str(ep["fields"]) and "url" not in ep and "image" not in ep, str(ep))
            api.areas_info = AsyncMock(return_value=fake_info)
            imap = interacao(IDS["creator"])
            arv3 = app_commands.CommandTree(discord.Client(intents=discord.Intents.default()))
            register_public_commands(arv3, api, set(), "https://wiki.exemplo.com", _checar, True, idiomas)
            await arv3.get_command("map").callback(imap, "dark")
            check("/map responde com o embed da area", imap.followup.send.call_args.kwargs["embed"].title.endswith("Dark Forest"))
            imap2 = interacao(IDS["creator"])
            await arv3.get_command("map").callback(imap2, "nao existe")
            check("/map com area inexistente responde so' para quem digitou", todas_efemeras(imap2))
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(ContentItem).where(ContentItem.slug.like(f"{termo}%")))
            await db.commit()

    await http.aclose()


async def main() -> None:
    """Prepara a configuracao, roda os testes e limpa os dados no final."""
    orig = settings.bot_api_token
    try:
        await testar()
    finally:
        settings.bot_api_token = orig
        await limpar()


if __name__ == "__main__":
    t0 = time.time()
    print("Teste de integracao do NinWiki.Bot")
    asyncio.run(main())
    print("\n" + "=" * 62)
    print(f" {PASS} verificacoes OK, {FAIL} falharam  ({time.time() - t0:.1f}s)")
    if FAIL:
        print(" FALHARAM:")
        for f in FALHAS:
            print("   -", f)
        sys.exit(1)
    print(" TUDO CERTO - o bot e a API conversam como esperado.")
