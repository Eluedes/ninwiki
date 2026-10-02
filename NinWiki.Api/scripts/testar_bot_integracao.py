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
    lista = await api.list_staff(IDS["sadm"])
    check("S.Adm lista a equipe pelo cliente do bot", any(m["discordId"] == str(IDS["sadm"]) for m in lista))
    check("Discord ID chega como TEXTO", all(isinstance(m["discordId"], str) for m in lista))
    novo = await api.add_staff(IDS["sadm"], IDS["alvo"], "creator", "TESTE_alvo")
    check("S.Adm cadastra Creator", novo["role"] == "creator" and novo["discordId"] == str(IDS["alvo"]))
    try:
        await api.add_staff(IDS["adm"], IDS["alvo2"], "admin", "x")
        check("Adm cadastrar Adm e' barrado", False)
    except ApiError as e:
        check("Adm cadastrar Adm e' barrado (403, msg em portugues)", e.status_code == 403 and ("permission" in e.detail.lower() or "role" in e.detail.lower()), e.detail)
    try:
        await api.list_staff(IDS["estranho"])
        check("quem nao e' da equipe e' barrado", False)
    except ApiError as e:
        check("quem nao e' da equipe e' barrado (403)", e.status_code == 403 and "team" in e.detail, e.detail)
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
        check("apos muitos tokens errados a API bloqueia e o bot mostra a mensagem (429)", e.status_code == 429 and "Too many attempts" in e.detail, e.detail)
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

    secao("3) Comandos de barra /team (Discord simulado) e o modal /team manage")
    from unittest.mock import PropertyMock, patch
    from ninwiki_bot.staff_commands import ManageStaffModal, run_manage_action
    grupo = StaffGroup(api, allowed_guilds=set())
    cmd = {c.name: c for c in grupo.commands}
    check("os 4 comandos existem: list, manage, status, clearlog", set(cmd) == {"list", "manage", "status", "clearlog"})
    check("grupo so' funciona em servidor (nao em DM)", grupo.guild_only is True)

    i = interacao(IDS["sadm"])
    await cmd["list"].callback(grupo, i)
    check("/team list mostra a equipe (embed)", "TESTE_adm" in texto_enviado(i) and "Adm" in texto_enviado(i))
    check("resposta e' efemera (so' quem digitou ve)", todas_efemeras(i))

    i = interacao(IDS["creator"])
    await cmd["list"].callback(grupo, i)
    check("Creator em /team list recebe recusa clara", texto_enviado(i).startswith("❌") and "permission" in texto_enviado(i).lower(), texto_enviado(i))

    # ---- o modal (componentes novos: selects dentro do modal) ----
    modal = ManageStaffModal(api, set())
    tipos = [type(getattr(modal, n).component).__name__ for n in ("action", "member", "role", "name")]
    check("o modal tem 4 campos: acao (select), pessoa (user select), cargo (select) e nome (texto)",
          tipos == ["Select", "UserSelect", "Select", "TextInput"], str(tipos))
    check("acao e pessoa sao obrigatorias; cargo e nome opcionais",
          modal.action.component.required and modal.member.component.required and not modal.role.component.required and not modal.name.component.required)
    check("o select de acao oferece as 5 acoes", {o.value for o in modal.action.component.options} == {"add", "role", "rename", "deactivate", "reactivate"})
    i = interacao(IDS["sadm"])
    await cmd["manage"].callback(grupo, i, None)
    check("/team manage abre o modal (send_modal)", i.response.send_modal.await_count == 1 and isinstance(i.response.send_modal.call_args.args[0], ManageStaffModal))

    # (cada acao abaixo roda a MESMA funcao que o on_submit do modal chama)
    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "add", fake_user("alvo2"), "creator", "")
    u = await buscar(IDS["alvo2"])
    check("Add: cria a pessoa no banco como Creator (nome do Discord quando o nome vem vazio)", u is not None and u.role == StaffRole.CREATOR and u.created_by_id is not None and u.username == "TESTE_alvo2")
    check("...e confirma com ✅", texto_enviado(i).startswith("✅") and "Creator" in texto_enviado(i), texto_enviado(i))

    i = interacao(IDS["adm"])
    await run_manage_action(api, i, "add", fake_user("estranho"), "admin", "")
    check("Adm tentando cadastrar um Adm: ❌ e NADA foi criado", texto_enviado(i).startswith("❌") and await buscar(IDS["estranho"]) is None, texto_enviado(i))

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "add", fake_user("estranho", bot=True), "creator", "")
    check("cadastrar um BOT e' recusado antes de chamar a API", "Bots cannot" in texto_enviado(i) and await buscar(IDS["estranho"]) is None)

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "add", fake_user("estranho"), None, "")
    check("Add sem escolher o cargo: pede o cargo e nada e' criado", "Pick a role" in texto_enviado(i) and await buscar(IDS["estranho"]) is None, texto_enviado(i))

    i = interacao(IDS["estranho"])
    await run_manage_action(api, i, "add", fake_user("estranho"), "creator", "")
    check("quem nao e' da equipe nao consegue cadastrar (nem a si mesmo)", texto_enviado(i).startswith("❌") and await buscar(IDS["estranho"]) is None, texto_enviado(i))

    i = interacao(IDS["adm"])
    await run_manage_action(api, i, "role", fake_user("alvo2"), "admin", "")
    u = await buscar(IDS["alvo2"])
    check("Adm NAO promove Creator a Adm (❌, cargo continua Creator)", texto_enviado(i).startswith("❌") and u.role == StaffRole.CREATOR, texto_enviado(i))

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "role", fake_user("alvo2"), "admin", "")
    u = await buscar(IDS["alvo2"])
    check("S.Adm promove pelo modal (✅, cargo mudou e sessao invalidada)", texto_enviado(i).startswith("✅") and u.role == StaffRole.ADMIN and u.token_version >= 1, texto_enviado(i))

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "role", fake_user("alvo2"), None, "")
    check("Change role sem escolher o cargo: pede o cargo", "Pick the new role" in texto_enviado(i))

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "rename", fake_user("alvo2"), None, "  Nick   Bot  ")
    u = await buscar(IDS["alvo2"])
    check("Rename: S.Adm troca o nome (espacos limpos) e ele fica travado", texto_enviado(i).startswith("✅") and u.username == "Nick Bot" and u.username_locked is True, texto_enviado(i))
    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "rename", fake_user("alvo2"), None, "")
    check("Rename sem digitar o nome: pede o nome", "Type the new display name" in texto_enviado(i))
    i = interacao(IDS["adm"])
    await run_manage_action(api, i, "rename", fake_user("alvo2"), None, "Hack")
    check("Adm NAO renomeia ninguem (❌, nome intacto)", texto_enviado(i).startswith("❌") and (await buscar(IDS["alvo2"])).username == "Nick Bot", texto_enviado(i))

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "deactivate", fake_user("alvo2"), None, "")
    u = await buscar(IDS["alvo2"])
    check("Deactivate desativa", texto_enviado(i).startswith("✅") and u.is_active is False)
    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "reactivate", fake_user("alvo2"), None, "")
    u = await buscar(IDS["alvo2"])
    check("Reactivate reativa", texto_enviado(i).startswith("✅") and u.is_active is True)

    i = interacao(IDS["adm"])
    await run_manage_action(api, i, "deactivate", fake_user("sadm"), None, "")
    check("Adm NAO desativa S.Adm (❌)", texto_enviado(i).startswith("❌") and (await buscar(IDS["sadm"])).is_active)

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "deactivate", fake_user("sadm"), None, "")
    check("ninguem se desativa a si mesmo (❌)", texto_enviado(i).startswith("❌") and (await buscar(IDS["sadm"])).is_active, texto_enviado(i))

    i = interacao(IDS["sadm"])
    await run_manage_action(api, i, "inexistente", fake_user("alvo2"), None, "")
    check("acao desconhecida e' recusada", "Unknown action" in texto_enviado(i))

    # servidor nao permitido no on_submit do modal
    m = ManageStaffModal(api, {555})
    i = interacao(IDS["sadm"], guild_id=999)
    with patch.object(type(m.action.component), "values", new_callable=PropertyMock, return_value=["add"]):
        await m.on_submit(i)
    check("modal enviado em servidor nao permitido e' recusado", "not available" in texto_enviado(i))

    # /team status
    i = interacao(IDS["sadm"])
    await cmd["status"].callback(grupo, i)
    check("/team status mostra API e banco", "NinWiki status" in texto_enviado(i) and "API" in texto_enviado(i) and "Database" in texto_enviado(i), texto_enviado(i))

    # ---- /team clearlog (so' S.Adm, com confirmacao; limpa o log do painel e/ou as mensagens do canal do Discord) ----
    from ninwiki_bot.staff_commands import ConfirmClearView, run_clear_log
    clear_both = app_commands.Choice(name="Panel audit log + Discord log channel", value="both")
    i = interacao(IDS["adm"])
    await cmd["clearlog"].callback(grupo, i, clear_both, 3650)
    check("Adm em /team clearlog: recusa ANTES de perguntar (nada apagado)", texto_enviado(i).startswith("❌") and "permission" in texto_enviado(i).lower(), texto_enviado(i))
    async def contar_limpezas() -> int:
        """Quantas linhas 'clear_log' existem agora no log."""
        async with AsyncSessionLocal() as db:
            return len((await db.execute(select(AuditLogEntry).where(AuditLogEntry.action == "clear_log"))).scalars().all())

    antes = await contar_limpezas()
    i = interacao(IDS["sadm"])
    await cmd["clearlog"].callback(grupo, i, clear_both, 3650)
    enviado = i.followup.send.call_args
    check("S.Adm em /team clearlog recebe a pergunta com os botoes Confirmar/Cancelar (efemera)",
          "Clear" in str(enviado.args[0]) and isinstance(enviado.kwargs.get("view"), ConfirmClearView) and enviado.kwargs.get("ephemeral") is True)
    check("so' perguntar (conferir a permissao) NAO grava nada no log", await contar_limpezas() == antes)
    async with AsyncSessionLocal() as db:
        db.add(AuditLogEntry(action="create", entity_type="content_item", entity_id="teste-bot-velho", actor_name="TESTE_velho",
                             source="panel", created_at=datetime.now(timezone.utc) - timedelta(days=4000)))
        await db.commit()
    canal = MagicMock()
    canal.purge = AsyncMock(return_value=[1, 2, 3])
    texto = await run_clear_log(api, IDS["sadm"], "both", 3650, canal, bot_user_id=777)
    check("clearlog 'both': apaga o log antigo do painel e as mensagens do bot no canal", "✅" in texto and "3** messages" in texto and canal.purge.await_count == 1, texto)
    kw = canal.purge.call_args.kwargs
    fake_msg_bot, fake_msg_outro = MagicMock(), MagicMock()
    fake_msg_bot.author.id, fake_msg_outro.author.id = 777, 123
    check("o canal so' perde as mensagens do PROPRIO bot, uma a uma (sem exigir permissao de moderacao)",
          kw["check"](fake_msg_bot) is True and kw["check"](fake_msg_outro) is False and kw["bulk"] is False and kw["before"] is not None)
    async with AsyncSessionLocal() as db:
        velho = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.entity_id == "teste-bot-velho"))).scalars().first()
        marca = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.action == "clear_log", AuditLogEntry.source == "bot").order_by(AuditLogEntry.created_at.desc()))).scalars().first()
    check("a linha antiga sumiu e a limpeza ficou registrada (source=bot, com o canal)", velho is None and marca is not None and marca.diff.get("discord_channel") is True)
    canal2 = MagicMock()
    canal2.purge = AsyncMock(return_value=[])
    texto = await run_clear_log(api, IDS["sadm"], "channel", None, canal2, bot_user_id=777)
    check("clearlog 'channel': so' o canal (nao toca no banco) e sem data apaga tudo do bot", "✅" in texto and "panel log" not in texto and canal2.purge.call_args.kwargs["before"] is None, texto)
    texto = await run_clear_log(api, IDS["sadm"], "channel", None, None, bot_user_id=777)
    check("sem canal de log configurado: avisa em vez de quebrar", "no Discord log channel" in texto, texto)
    try:
        await run_clear_log(api, IDS["adm"], "both", 3650, canal, bot_user_id=777)
        check("Adm nao consegue limpar nem chamando direto", False)
    except ApiError as e:
        check("Adm nao consegue limpar nem chamando direto (403) e o canal nao e' tocado", e.status_code == 403 and canal.purge.await_count == 1, e.detail)

    # o invoker enviado a' API e' SEMPRE quem digitou o comando (interaction.user), nunca o "alvo"
    async with AsyncSessionLocal() as db:
        logs = (await db.execute(select(AuditLogEntry).where(AuditLogEntry.source == "bot", AuditLogEntry.actor_name.like("TESTE_%")))).scalars().all()
    check("acoes pelo bot ficam no log com source=bot e o nome de QUEM digitou",
          len(logs) >= 4 and {l.actor_name for l in logs} <= {"TESTE_adm", "TESTE_sadm"}, str({l.actor_name for l in logs}))

    secao("4) Restricao por servidor (ALLOWED_GUILD_IDS)")
    restrito = StaffGroup(api, allowed_guilds={555})
    i = interacao(IDS["sadm"], guild_id=999)
    check("servidor nao permitido: comando recusado", await restrito.interaction_check(i) is False and "not available" in texto_enviado(i))
    i = interacao(IDS["sadm"], guild_id=555)
    check("servidor permitido: comando liberado", await restrito.interaction_check(i) is True)
    check("sem lista: qualquer servidor", await grupo.interaction_check(interacao(IDS["sadm"], guild_id=42)) is True)

    # ------------------------------------------------------------------
    secao("5) Feed do log geral no Discord")
    import tempfile
    from ninwiki_bot.log_feed import FeedState, LogFeedStore, format_entry, pick_new, query_since
    desde = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    linhas = await api.audit_log_since(desde)
    check("API devolve as acoes recentes (lista)", isinstance(linhas, list) and len(linhas) >= 1)
    check("SEM IP nem dados sensiveis nas linhas (padrao)", all("ipAddress" not in l and "ip_address" not in l for l in linhas))
    com_ip = await api.audit_log_since(desde, include_ip=True)
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
                  "Searched by Rafael" in txt and "Nin Online Wiki Team" in txt and "/images/logo/" in str(v.children[0].children[-1].accessory.media.url if hasattr(v.children[0].children[-1], "accessory") else ""))
            vp = build_search_view(termo, achados_pt, "https://wiki.exemplo.com/", lang="pt", owner_name="Rafael")
            txp = componentes(vp)
            check("/search em portugues: textos, botao e rodape em portugues", "Pesquisado por Rafael" in txp and "Equipe Nin Online Wiki" in txp and "Abrir a página completa" in txp and "Lamina" in txp, txp[:300])
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
            check("/team fica escondido de quem nao gerencia o servidor", StaffGroup(api).default_permissions is not None and StaffGroup(api).default_permissions.manage_guild)
            i2 = interacao(IDS["creator"], guild_id=999)
            arvore2 = app_commands.CommandTree(discord.Client(intents=discord.Intents.default()))
            register_public_commands(arvore2, api, {1}, "", _checar, False, idiomas)
            await arvore2.get_command("status").callback(i2)
            check("/status em servidor nao permitido e' recusado", i2.response.send_message.await_count == 1 and not i2.followup.send.await_count)
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
