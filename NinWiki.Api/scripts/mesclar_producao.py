"""
Mescla o banco de PRODUCAO (restaurado num banco temporario) dentro de uma COPIA do banco LOCAL, para o local virar a base da producao
sem perder os dados VIVOS que so' existem la' (equipe/cargos, log, comentarios, posts da Steam, edicoes de staff...).

NUNCA toca no `ninwiki` principal nem em nada remoto: so' LE `--prod` (e `--base`) e so' ESCREVE em `--destino`.
Recusa: destino chamado `ninwiki`, qualquer host que nao seja localhost, e bancos que nao comecem com `ninwiki_`.
Por padrao e' SIMULACAO (faz tudo numa transacao e desfaz no fim, so' mostra o plano). Use --aplicar para gravar no destino temporario.

PASSOS (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`, Docker ligado):
  1. Restaure o backup da producao num banco temporario (copia do restaurar_backup.py apontando para ele) -> ex. `ninwiki_prod_copy`.
  2. (Opcional, recomendado) `--base ninwiki_baseline` = o banco que foi ENVIADO a' producao da ultima vez (envio/ninwiki-producao.dump
     restaurado num banco temporario). Com ele a mescla e' "3 vias": so' aplica a edicao da producao onde o local NAO mexeu na mesma coluna.
  3. `py scripts/mesclar_producao.py --prod ninwiki_prod_copy --base ninwiki_baseline --destino ninwiki_merged`  (simulacao)
  4. Mesmo comando com `--aplicar` (cria `ninwiki_merged` a partir do `ninwiki` se nao existir -> precisa de ZERO conexoes ativas no `ninwiki`).

REGRAS DE MESCLA (resumo em portugues simples):
  - VIVAS (producao vence): users (cargo, ativo, login...), custom_roles, role_permissions (substitui tudo; --manter-permissoes-local desliga),
    site_maintenance, site_announcement, readers, trafego (traffic_daily/pages/places: substitui pelo da producao, o local so' tem teste;
    --manter-trafego-local junta os dois em vez de substituir), content_reports, notices, comentarios e curtidas.
  - UNIAO (junta os dois): audit_log, content_versions, posts (+ tags e ligacoes): entram as linhas que so' a producao tem.
  - CONTEUDO (local vence): itens, jutsus, masteries, etc. + media_images. Com --base, edicoes da producao so' entram se o local nao mexeu naquela coluna;
    se os dois mexeram, fica o local e o caso e' listado como CONFLITO. Linhas novas so' da producao (e que nao estavam no --base) sao inseridas.
  - Usuarios que so' o local tem ficam (use --desativar-usuarios-so-local para deixa-los inativos, nada e' apagado).
  - error_events e traffic_visitors nao vao no backup da producao: ficam como estao no local (limitacao conhecida).
"""
import argparse
import asyncio
import re
import sys

import asyncpg

from app.core.config import settings

# --- tabelas por estrategia (ordem = maes primeiro) ---
SUBSTITUI_PROD = ["role_permissions", "site_maintenance", "site_announcement", "content_reports", "volunteer_applications", "notice_files", "notices", "post_comments", "post_likes"]
TRAFEGO = ["traffic_daily", "traffic_pages", "traffic_places"]
UPSERT_PROD = ["custom_roles", "users", "readers"]       # prod vence nas linhas em comum; as so' do local ficam
SO_NOVAS_PROD = ["audit_log", "content_versions", "tags", "posts", "post_tag_links"]   # insere so' o que falta
CONTEUDO = ["attributes", "ninja_ranks", "villages", "clans", "organizations", "organization_villages", "story_arcs", "summons", "professions",
            "masteries", "mastery_paths", "mastery_attributes", "mastery_path_attributes", "content_items", "content_item_attributes",
            "content_item_drops", "content_item_attacks", "jutsus", "guide_articles", "media_images"]


def dsn(db: str) -> str:
    """URL do Postgres local (mesmo usuario/senha do .env) apontando para o banco `db`. Recusa host que nao seja localhost."""
    base = re.sub(r"^postgresql\+asyncpg", "postgresql", settings.database_url)
    if not re.search(r"@(localhost|127\.0\.0\.1)(:\d+)?/", base):
        sys.exit("RECUSADO: o DATABASE_URL do .env nao e' localhost.")
    return base.rsplit("/", 1)[0] + "/" + db


def checar_nome(db: str, papel: str) -> None:
    """Bancos temporarios precisam se chamar ninwiki_algo; o `ninwiki` principal nunca pode ser o destino."""
    if db == "ninwiki" or not re.fullmatch(r"ninwiki_[a-z0-9_]+", db):
        sys.exit(f"RECUSADO: {papel} '{db}' invalido (use um temporario tipo ninwiki_merged; o 'ninwiki' principal e' proibido).")


async def conectar(db: str) -> asyncpg.Connection:
    """Conecta e faz json/jsonb virarem texto (ida e volta sem conversao)."""
    c = await asyncpg.connect(dsn(db))
    for t in ("json", "jsonb"):
        await c.set_type_codec(t, encoder=str, decoder=str, schema="pg_catalog")
    return c


async def pk_cols(c, t: str) -> list[str]:
    """Colunas da chave primaria da tabela."""
    rows = await c.fetch("select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) "
                         "where i.indrelid=$1::regclass and i.indisprimary", f'"{t}"')
    return [r[0] for r in rows]


def norm(v):
    """JSON 'null' e SQL NULL sao tratados como iguais (o restore grava um ou outro); resto compara como texto."""
    return None if v is None or v == "null" else str(v)


async def ler(c, t: str, pk: list[str]) -> dict:
    """Le a tabela inteira como {chave: linha}."""
    return {tuple(str(r[p]) for p in pk): dict(r) for r in await c.fetch(f'select * from "{t}"')}


async def inserir(c, t: str, row: dict) -> None:
    """Insere uma linha (colunas que o destino conhece)."""
    cols = list(row)
    await c.execute(f'insert into "{t}" ({",".join(chr(34)+k+chr(34) for k in cols)}) values ({",".join(f"${i+1}" for i in range(len(cols)))})', *row.values())


async def atualizar(c, t: str, pk: list[str], row: dict, cols: list[str]) -> None:
    """Atualiza so' as colunas `cols` da linha de mesma chave."""
    sets = ",".join(f'"{k}"=${i+1}' for i, k in enumerate(cols))
    where = " and ".join(f'"{p}"=${len(cols)+j+1}' for j, p in enumerate(pk))
    await c.execute(f'update "{t}" set {sets} where {where}', *[row[k] for k in cols], *[row[p] for p in pk])


async def main() -> None:
    ap = argparse.ArgumentParser(description="Mescla producao (temporario) em copia do local (temporario).")
    ap.add_argument("--prod", required=True, help="banco temporario com a producao restaurada")
    ap.add_argument("--base", help="banco temporario com o que foi enviado a' producao da ultima vez (3 vias)")
    ap.add_argument("--destino", required=True, help="banco temporario que recebe a mescla (copia do ninwiki)")
    ap.add_argument("--aplicar", action="store_true", help="grava no destino (sem isso: simulacao, nada e' gravado)")
    ap.add_argument("--manter-permissoes-local", action="store_true")
    ap.add_argument("--manter-trafego-local", action="store_true")
    ap.add_argument("--desativar-usuarios-so-local", action="store_true")
    a = ap.parse_args()
    for db, papel in ((a.prod, "--prod"), (a.destino, "--destino")):
        checar_nome(db, papel)
    if a.base:
        checar_nome(a.base, "--base")

    adm = await asyncpg.connect(dsn("postgres"))
    if not await adm.fetchval("select 1 from pg_database where datname=$1", a.destino):
        if not a.aplicar:
            sys.exit(f"Simulacao: o destino '{a.destino}' nao existe. Rode com --aplicar para cria-lo a partir do 'ninwiki'.")
        await adm.execute(f'create database "{a.destino}" template ninwiki')   # falha se houver conexoes ativas no ninwiki
        print(f"Criado {a.destino} (copia do ninwiki).")
    await adm.close()

    P, M = await conectar(a.prod), await conectar(a.destino)
    B = await conectar(a.base) if a.base else None
    tr = M.transaction()
    await tr.start()
    await M.execute("set session_replication_role = replica")   # ordem das FKs nao importa durante a mescla; conferimos no fim
    resumo: list[str] = []
    conflitos: list[str] = []
    try:
        # 1) substitui tabelas VIVAS pelas da producao
        lista = [t for t in SUBSTITUI_PROD if not (a.manter_permissoes_local and t == "role_permissions")]
        if not a.manter_trafego_local:
            lista += TRAFEGO
        for t in lista:
            if await P.fetchval("select to_regclass($1)", t) is None:   # backup antigo, de antes de a tabela existir (ex.: voluntarios)
                resumo.append(f"substitui {t}: tabela ainda nao existe na producao (mantida como esta no local)"); continue
            pk = await pk_cols(M, t)
            antes = await M.fetchval(f'select count(*) from "{t}"')
            await M.execute(f'delete from "{t}"')
            rows = await P.fetch(f'select * from "{t}"')
            for r in rows:
                await inserir(M, t, dict(r))
            resumo.append(f"substitui {t}: local {antes} -> producao {len(rows)}")
        if a.manter_trafego_local:
            lista_u = TRAFEGO
        else:
            lista_u = []
        # 2) producao vence nas linhas em comum; mantem as so' do local
        for t in UPSERT_PROD + lista_u:
            pk = await pk_cols(M, t)
            loc, prod = await ler(M, t, pk), await ler(P, t, pk)
            novas = alt = 0
            for k, r in prod.items():
                if k not in loc:
                    await inserir(M, t, r); novas += 1
                elif any(norm(r[c]) != norm(loc[k].get(c)) for c in r):
                    await atualizar(M, t, pk, r, [c for c in r if c not in pk]); alt += 1
            extra = f", so' no local (mantidas): {len(set(loc) - set(prod))}"
            resumo.append(f"upsert {t}: +{novas} novas, {alt} atualizadas pela producao{extra}")
        if a.desativar_usuarios_so_local:
            prod_ids = {str(r["id"]) for r in await P.fetch("select id from users")}
            n = 0
            for r in await M.fetch("select id from users where is_active"):
                if str(r["id"]) not in prod_ids:
                    await M.execute("update users set is_active=false where id=$1", r["id"]); n += 1
            resumo.append(f"usuarios so' do local desativados: {n}")
        # 3) uniao: so' o que falta
        for t in SO_NOVAS_PROD:
            pk = await pk_cols(M, t)
            loc, prod = await ler(M, t, pk), await ler(P, t, pk)
            novas = [r for k, r in prod.items() if k not in loc]
            for r in novas:
                await inserir(M, t, r)
            resumo.append(f"uniao {t}: +{len(novas)} linhas so' da producao")
        # 4) conteudo: local vence; com --base aplica edicao da producao onde o local nao mexeu
        for t in CONTEUDO:
            pk = await pk_cols(M, t)
            loc, prod = await ler(M, t, pk), await ler(P, t, pk)
            base = await ler(B, t, pk) if B else None
            aplic = confl = novas = 0
            for k, r in prod.items():
                if k not in loc:
                    if base is None or k not in base:      # nova na producao; se estava no base e sumiu do local, o local apagou de proposito
                        await inserir(M, t, r); novas += 1
                    continue
                if base is None or k not in base:
                    continue
                cols = [c for c in r if c in base[k] and c in loc[k] and c not in pk and c != "updated_at" and norm(r[c]) != norm(base[k][c])]
                livres = [c for c in cols if norm(loc[k][c]) == norm(base[k][c])]
                if livres:
                    await atualizar(M, t, pk, r, livres); aplic += 1
                    conflitos.append(f"APLICADO  {t} {k}: colunas {livres} (editado so' na producao)")
                for c in cols:
                    if c not in livres and norm(loc[k][c]) != norm(r[c]):
                        confl += 1
                        conflitos.append(f"CONFLITO  {t} {k}: coluna {c} (local e producao mudaram; fica o LOCAL)")
            if novas or aplic or confl:
                resumo.append(f"conteudo {t}: +{novas} novas da producao, {aplic} linhas com edicao da producao aplicada, {confl} conflitos")
        # 5) contadores (sequences) e integridade referencial
        for r in await M.fetch("select c.relname, a.attname, pg_get_serial_sequence(quote_ident(c.relname), a.attname) s from pg_class c "
                               "join pg_attribute a on a.attrelid=c.oid and a.attnum>0 where c.relkind='r' and c.relnamespace='public'::regnamespace "
                               "and pg_get_serial_sequence(quote_ident(c.relname), a.attname) is not null"):
            await M.execute(f'select setval($1, coalesce((select max("{r["attname"]}") from "{r["relname"]}"),1))', r["s"])
        orfas = 0
        for fk in await M.fetch("select conrelid::regclass::text t, pg_get_constraintdef(oid) d from pg_constraint where contype='f' and connamespace='public'::regnamespace"):
            m = re.match(r"FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)", fk["d"])
            if not m:
                continue
            n = await M.fetchval(f'select count(*) from {fk["t"]} x where x."{m[1]}" is not null and not exists (select 1 from "{m[2]}" y where y."{m[3]}" = x."{m[1]}")')
            if n:
                orfas += n; resumo.append(f"ATENCAO FK orfa: {fk['t']}.{m[1]} -> {m[2]}: {n} linhas")
        resumo.append(f"integridade referencial: {orfas} linhas orfas")
    except Exception:
        await tr.rollback()
        raise
    await M.execute("set session_replication_role = origin")
    print("\n".join(resumo)); print("\n".join(conflitos))
    if a.aplicar:
        await tr.commit(); print(f"\nGRAVADO em {a.destino}.")
    else:
        await tr.rollback(); print("\nSIMULACAO: nada foi gravado (use --aplicar).")


if __name__ == "__main__":
    asyncio.run(main())
