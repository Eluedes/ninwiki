"""
Registro dos comandos de barra no Discord: so' nos servidores escolhidos, na hora, sem sobra de comandos antigos.

PROBLEMA QUE ISTO RESOLVE: comandos GLOBAIS demoram ate' 1 h para aparecer e ficam em TODOS os servidores onde o bot esta'. Registrar so' num servidor de testes
(DEV_GUILD_ID) deixava os outros servidores com comandos velhos (ex.: um /team antigo) e sem /search, /status e /language.

REGRA: os servidores = ALLOWED_GUILD_IDS + DEV_GUILD_ID.
  - Com servidores definidos: os comandos sao registrados em CADA um deles (aparecem na hora) e os comandos globais sao APAGADOS (some o /team velho e nada
    aparece em servidor nao autorizado).
  - Sem nenhum definido: registro global (pode levar ate' 1 h e vale para todos os servidores).
Este arquivo nao importa discord.py: recebe a arvore de comandos por parametro (assim da' para testar com uma arvore de mentira).
"""
import logging

log = logging.getLogger("ninwiki_bot")


def target_guilds(allowed: set[int], dev_guild_id: int | None) -> list[int]:
    """Servidores onde os comandos devem existir: os permitidos + o de testes (sem repetir, em ordem estavel)."""
    return sorted(allowed | ({dev_guild_id} if dev_guild_id else set()))


async def sync_commands(tree, guild_ids: list[int], make_guild) -> dict:
    """
    Registra os comandos da arvore nos servidores (ou globalmente se nao houver nenhum). `make_guild(id)` cria o objeto de servidor do discord.py.
    Devolve {"guilds": [ids sincronizados], "failed": {id: erro}, "global": True/False} - um servidor com erro (bot fora dele, sem o escopo de comandos)
    NAO impede os outros.
    """
    result: dict = {"guilds": [], "failed": {}, "global": not guild_ids}
    if not guild_ids:
        await tree.sync()
        log.info("Comandos globais sincronizados (podem levar ate 1h pra aparecer)")
        return result
    for gid in guild_ids:
        try:
            guild = make_guild(gid)
            tree.copy_global_to(guild=guild)
            await tree.sync(guild=guild)
            result["guilds"].append(gid)
        except Exception as exc:  # noqa: BLE001 - servidor errado/sem permissao nao derruba o bot nem os outros servidores
            result["failed"][gid] = f"{type(exc).__name__}: {exc}"[:200]
            log.warning("Nao consegui registrar os comandos no servidor %s: %s", gid, exc)
    if result["guilds"]:
        # Depois de copiar para os servidores, apaga os GLOBAIS: tira o /team velho e impede comandos em servidores fora da lista.
        tree.clear_commands(guild=None)
        await tree.sync()
        log.info("Comandos registrados em %s servidor(es) %s; comandos globais antigos removidos", len(result["guilds"]), result["guilds"])
    return result
