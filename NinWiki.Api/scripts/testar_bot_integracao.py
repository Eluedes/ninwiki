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
import random
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
from sqlalchemy import delete, select

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "NinWiki.Bot"))

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enums import StaffRole  # noqa: E402
from app.models.users import AuditLogEntry, User  # noqa: E402
from ninwiki_bot.api_client import ApiError, NinWikiApi  # noqa: E402
from ninwiki_bot.config import BotSettings  # noqa: E402

try:
    import discord
    from discord import app_commands
    from ninwiki_bot.staff_commands import StaffGroup
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
    i.guild_id = guild_id
    i.response.defer = AsyncMock()
    i.response.send_message = AsyncMock()
    i.followup.send = AsyncMock()
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
    lista = await api.list_staff(IDS["sadm"])
    check("S.Adm lista a equipe pelo cliente do bot", any(m["discordId"] == str(IDS["sadm"]) for m in lista))
    check("Discord ID chega como TEXTO", all(isinstance(m["discordId"], str) for m in lista))
    novo = await api.add_staff(IDS["sadm"], IDS["alvo"], "creator", "TESTE_alvo")
    check("S.Adm cadastra Creator", novo["role"] == "creator" and novo["discordId"] == str(IDS["alvo"]))
    try:
        await api.add_staff(IDS["adm"], IDS["alvo2"], "admin", "x")
        check("Adm cadastrar Adm e' barrado", False)
    except ApiError as e:
        check("Adm cadastrar Adm e' barrado (403, msg em portugues)", e.status_code == 403 and ("permiss" in e.detail.lower() or "cargo" in e.detail.lower()), e.detail)
    try:
        await api.list_staff(IDS["estranho"])
        check("quem nao e' da equipe e' barrado", False)
    except ApiError as e:
        check("quem nao e' da equipe e' barrado (403)", e.status_code == 403 and "equipe" in e.detail, e.detail)
    try:
        await api.list_staff(IDS["creator"])
        check("Creator listar e' barrado", False)
    except ApiError as e:
        check("Creator listar e' barrado (403)", e.status_code == 403)
    try:
        await api.add_staff(IDS["sadm"], IDS["alvo"], "creator", "x")
        check("cadastro repetido e' barrado", False)
    except ApiError as e:
        check("cadastro repetido (409)", e.status_code == 409, e.detail)
    alt = await api.change_role(IDS["sadm"], IDS["alvo"], "admin")
    check("S.Adm promove alvo a Adm", alt["role"] == "admin")
    off = await api.set_active(IDS["sadm"], IDS["alvo"], False)
    check("S.Adm desativa", off["isActive"] is False)
    on = await api.set_active(IDS["sadm"], IDS["alvo"], True)
    check("S.Adm reativa", on["isActive"] is True)

    errado = NinWikiApi("http://test", "token-errado-1234567890", client=http)
    try:
        await errado.list_staff(IDS["sadm"])
        check("token do bot errado e' barrado", False)
    except ApiError as e:
        check("token do bot errado (401) com mensagem clara", e.status_code == 401 and "BOT_API_TOKEN" in e.detail, e.detail)
    settings.bot_api_token = ""
    try:
        await api.list_staff(IDS["sadm"])
        check("API com bot desligado", False)
    except ApiError as e:
        check("API com bot desligado (404) explica o motivo", e.status_code == 404 and "BOT_API_TOKEN" in e.detail, e.detail)
    settings.bot_api_token = TOKEN
    limiter.reset()
    for i in range(10):
        try:
            await NinWikiApi("http://test", f"chute-numero-{i}-xxxxxxxxxx", client=http).list_staff(IDS["sadm"])
        except ApiError:
            pass
    try:
        await api.list_staff(IDS["sadm"])
        check("bloqueio por forca bruta", False)
    except ApiError as e:
        check("apos muitos tokens errados a API bloqueia e o bot mostra a mensagem (429)", e.status_code == 429 and "Muitas tentativas" in e.detail, e.detail)
    limiter.reset()
    fora = NinWikiApi("http://127.0.0.1:9", TOKEN)
    try:
        await fora.list_staff(IDS["sadm"])
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

    secao("3) Comandos de barra /equipe (Discord simulado)")
    grupo = StaffGroup(api, allowed_guilds=set())
    cmd = {c.name: c for c in grupo.commands}
    check("os 5 comandos existem", set(cmd) == {"listar", "adicionar", "cargo", "desativar", "reativar"})
    check("grupo so' funciona em servidor (nao em DM)", grupo.guild_only is True)
    adm_cargo_creator = app_commands.Choice(name="Creator", value="creator")
    adm_cargo_admin = app_commands.Choice(name="Adm", value="admin")

    i = interacao(IDS["sadm"])
    await cmd["listar"].callback(grupo, i)
    check("/equipe listar mostra a equipe (embed)", "TESTE_adm" in texto_enviado(i) and "Adm" in texto_enviado(i))
    check("resposta e' efemera (so' quem digitou ve)", todas_efemeras(i))

    i = interacao(IDS["creator"])
    await cmd["listar"].callback(grupo, i)
    check("Creator em /equipe listar recebe recusa clara", texto_enviado(i).startswith("❌") and "permiss" in texto_enviado(i).lower(), texto_enviado(i))

    i = interacao(IDS["sadm"])
    await cmd["adicionar"].callback(grupo, i, fake_user("alvo2"), adm_cargo_creator)
    u = await buscar(IDS["alvo2"])
    check("/equipe adicionar cria a pessoa no banco como Creator", u is not None and u.role == StaffRole.CREATOR and u.created_by_id is not None)
    check("...e confirma com ✅", texto_enviado(i).startswith("✅") and "Creator" in texto_enviado(i), texto_enviado(i))

    i = interacao(IDS["adm"])
    await cmd["adicionar"].callback(grupo, i, fake_user("estranho"), adm_cargo_admin)
    check("Adm tentando cadastrar Adm: ❌ e NADA foi criado", texto_enviado(i).startswith("❌") and await buscar(IDS["estranho"]) is None, texto_enviado(i))

    i = interacao(IDS["sadm"])
    await cmd["adicionar"].callback(grupo, i, fake_user("estranho", bot=True), adm_cargo_creator)
    check("cadastrar um BOT e' recusado antes de chamar a API", "Bots" in texto_enviado(i) and await buscar(IDS["estranho"]) is None)

    i = interacao(IDS["estranho"])
    await cmd["adicionar"].callback(grupo, i, fake_user("estranho"), adm_cargo_creator)
    check("quem nao e' da equipe nao consegue cadastrar (nem a si mesmo)", texto_enviado(i).startswith("❌") and await buscar(IDS["estranho"]) is None, texto_enviado(i))

    i = interacao(IDS["adm"])
    await cmd["cargo"].callback(grupo, i, fake_user("alvo2"), adm_cargo_admin)
    u = await buscar(IDS["alvo2"])
    check("Adm NAO promove Creator a Adm (❌, cargo continua Creator)", texto_enviado(i).startswith("❌") and u.role == StaffRole.CREATOR, texto_enviado(i))

    i = interacao(IDS["sadm"])
    await cmd["cargo"].callback(grupo, i, fake_user("alvo2"), adm_cargo_admin)
    u = await buscar(IDS["alvo2"])
    check("S.Adm promove pelo comando (✅, cargo mudou e sessao invalidada)", texto_enviado(i).startswith("✅") and u.role == StaffRole.ADMIN and u.token_version >= 1, texto_enviado(i))

    i = interacao(IDS["sadm"])
    await cmd["desativar"].callback(grupo, i, fake_user("alvo2"))
    u = await buscar(IDS["alvo2"])
    check("/equipe desativar desativa", texto_enviado(i).startswith("✅") and u.is_active is False)
    i = interacao(IDS["sadm"])
    await cmd["reativar"].callback(grupo, i, fake_user("alvo2"))
    u = await buscar(IDS["alvo2"])
    check("/equipe reativar reativa", texto_enviado(i).startswith("✅") and u.is_active is True)

    i = interacao(IDS["adm"])
    await cmd["desativar"].callback(grupo, i, fake_user("sadm"))
    check("Adm NAO desativa S.Adm (❌)", texto_enviado(i).startswith("❌") and (await buscar(IDS["sadm"])).is_active)

    i = interacao(IDS["sadm"])
    await cmd["desativar"].callback(grupo, i, fake_user("sadm"))
    check("ninguem se desativa a si mesmo (❌)", texto_enviado(i).startswith("❌") and (await buscar(IDS["sadm"])).is_active, texto_enviado(i))

    # o invoker enviado a' API e' SEMPRE quem digitou o comando (interaction.user), nunca o "alvo"
    async with AsyncSessionLocal() as db:
        logs = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.source == "bot", AuditLogEntry.actor_name.like("TESTE_%")))).scalars().all()
    check("acoes pelo bot ficam no log com source=bot e o nome de QUEM digitou",
          len(logs) >= 4 and {l.actor_name for l in logs} <= {"TESTE_adm", "TESTE_sadm"}, str({l.actor_name for l in logs}))

    secao("4) Restricao por servidor (ALLOWED_GUILD_IDS)")
    restrito = StaffGroup(api, allowed_guilds={555})
    i = interacao(IDS["sadm"], guild_id=999)
    check("servidor nao permitido: comando recusado", await restrito.interaction_check(i) is False and "não está disponível" in texto_enviado(i))
    i = interacao(IDS["sadm"], guild_id=555)
    check("servidor permitido: comando liberado", await restrito.interaction_check(i) is True)
    check("sem lista: qualquer servidor", await grupo.interaction_check(interacao(IDS["sadm"], guild_id=42)) is True)

    # ------------------------------------------------------------------
    secao("5) Feed do log geral no Discord")
    import tempfile
    from datetime import datetime, timedelta, timezone
    from ninwiki_bot.log_feed import FeedState, LogFeedStore, format_entry, pick_new, query_since
    desde = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    linhas = await api.audit_log_since(desde)
    check("API devolve as acoes recentes (lista)", isinstance(linhas, list) and len(linhas) >= 1)
    check("SEM IP nem dados sensiveis nas linhas", all("ipAddress" not in l and "ip_address" not in l for l in linhas))
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
    check("embed: titulo diz quem fez o que", "Rafa (Adm) editou um post" in f["title"], f["title"])
    check("embed: mostra o que mudou (nome antigo -> novo)", "Velho" in f["description"] and "Novo" in f["description"])
    check("embed NUNCA mostra conteudo de texto nem IP", "SECRETO" not in f["description"] and "1.2.3.4" not in f["description"])
    check("acao desconhecida nao quebra", format_entry({**exemplo, "action": "xyz", "entityType": "abc", "diff": None})["title"].startswith("Rafa"))
    check("login nao cita alvo", format_entry({**exemplo, "action": "login"})["title"].endswith("entrou no painel"))
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
