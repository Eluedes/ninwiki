"""
Gera `NinWiki.Web/data/missions.json`: as MISSOES do Nin Online com ficha (nivel, rank, quem da', onde, objetivos, recompensas), lidas do Nin Online Wiki
(Fandom: categorias Missions / Story Mission / B-Rank Missions) e conferidas com os textos do cliente do jogo (English.json -> MissionKeys).

Por que um arquivo e nao o banco? A tabela de conteudo (content_items) so' tem campos de mob/item/arma - nao tem lugar para objetivos, recompensas, tipo
(diaria/repetivel/historia) nem rank. Uma tabela de missoes pede migracao (a producao esta' a frente do banco local), entao a ficha mora neste json
estatico, que o site le' em /missions. Rode de novo quando a comunidade atualizar as paginas; o arquivo e' sobrescrito inteiro.

Regras: nada e' inventado - cada campo vem da pagina do Fandom (ou fica vazio); `inClient` diz se o NOME da missao existe no texto do cliente do jogo.
Os valores sao da comunidade (CC-BY-SA) e mudam a cada atualizacao do jogo: o site mostra o aviso e o link da fonte.

Uso (pasta NinWiki.Api, python do venv):
    python scripts/importar_missoes_fandom.py                 # baixa do Fandom e grava data/missions.json
    python scripts/importar_missoes_fandom.py --cliente "E:/.../locales/English.json"   # outro caminho do cliente
"""
import argparse
import difflib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://ninonline.fandom.com/api.php"
CABECALHOS = {"User-Agent": "Mozilla/5.0 NinWikiBot", "Referer": "https://ninonline.fandom.com/"}
CATEGORIAS = ("Missions", "Story Mission", "Story mission", "B-Rank Missions")
# Paginas que sao indices/hubs (nao uma missao): ficam de fora.
HUBS = {"Missions", "Story Lines", "Mission Assignments (Leaf)", "Mission Assignments (Mist)", "Mission Assignments (Sand)"}
# Categorias do Fandom que dizem a REGIAO/aldeia da missao.
REGIOES = {"Land of Spirits": "land-of-spirits", "Land of iron": "land-of-iron", "Takumi Village": "takumi", "Leaf Village": "leaf"}
CLIENTE_PADRAO = r"E:\SteamLibrary\steamapps\common\Nin Online\data files\locales\English.json"
DESTINO = Path(__file__).resolve().parents[2] / "NinWiki.Web" / "data" / "missions.json"


def _get(params: dict) -> dict:
    """GET na API MediaWiki do Fandom (precisa de User-Agent e Referer)."""
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=CABECALHOS), timeout=60).read())


def baixar_paginas() -> dict[str, dict]:
    """Baixa o wikitext e as categorias de todas as paginas das categorias de missao."""
    titulos: set[str] = set()
    for cat in CATEGORIAS:
        d = _get({"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}", "cmlimit": "500", "cmnamespace": "0"})
        titulos |= {m["title"] for m in d["query"]["categorymembers"]}
    titulos -= HUBS
    ordenados = sorted(titulos)
    paginas: dict[str, dict] = {}
    for i in range(0, len(ordenados), 40):
        d = _get({"action": "query", "prop": "revisions|categories", "rvprop": "content", "rvslots": "main", "cllimit": "max",
                  "titles": "|".join(ordenados[i:i + 40])})
        for p in d["query"]["pages"]:
            if "revisions" in p:
                paginas[p["title"]] = {"wikitext": p["revisions"][0]["slots"]["main"]["content"], "cats": [c["title"][9:] for c in p.get("categories", [])]}
    return paginas


# ---------------- limpeza de wikitext ----------------

def _sem_modelos(t: str) -> str:
    """Remove {{modelos}} (inclusive aninhados) - a caixa da missao e' lida antes, em separado."""
    while True:
        novo = re.sub(r"\{\{[^{}]*\}\}", "", t)
        if novo == t:
            return t
        t = novo


def limpar(t: str) -> str:
    """Texto de wiki -> texto simples. Mantem [[Alvo|Rotulo]] (o site vira link/miniatura quando o alvo e' um item do wiki)."""
    t = _sem_modelos(t)
    t = re.sub(r"\[\[(?:File|Image|Category|Arquivo):[^\]]*\]\]", "", t, flags=re.I)
    t = re.sub(r"<br\s*/?>", " ", t, flags=re.I)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"</?(?:span|small|div|big|u|sup|sub|center|nowiki|ref)[^>]*>", "", t, flags=re.I)
    t = t.replace("'''", "").replace("''", "")
    t = html.unescape(t)
    t = t.replace("\xa0", " ").replace("\ufffd", "")
    return re.sub(r"[ \t]+", " ", t).strip()


def _caixa(wikitext: str) -> dict[str, str]:
    """Campos da caixa MissionBox / Mission_Infobox_Template (nome do parametro -> valor limpo)."""
    m = re.search(r"\{\{\s*Mission[_ ]?(?:Box|Infobox_Template|Infobox Template)", wikitext, re.I)
    if not m:
        return {}
    i, nivel = m.start(), 0
    j = i
    while j < len(wikitext) - 1:
        if wikitext[j:j + 2] == "{{":
            nivel += 1
            j += 2
        elif wikitext[j:j + 2] == "}}":
            nivel -= 1
            j += 2
            if nivel == 0:
                break
        else:
            j += 1
    corpo = wikitext[i + 2:j - 2]
    campos = {}
    for parte in re.split(r"\n?\|(?=\s*[a-z_0-9]+\s*=)", corpo)[1:]:
        k, _, v = parte.partition("=")
        campos[k.strip()] = limpar(v)
    return campos


def _linhas(bloco: str, so_listas: bool = False) -> list[str]:
    """Itens de um bloco: listas (* #), tabelas ({| ... |}) e linhas de texto viram uma lista de textos.
    `so_listas`: devolve so' listas/tabelas; so' se NAO houver nenhuma cai nas linhas curtas (<= 160 letras) - paragrafos de comentario ficam de fora."""
    itens: list[str] = []
    soltas: list[str] = []
    cabecalho: list[str] = []
    for bruta in bloco.splitlines():
        l = bruta.strip()
        if not l or l.startswith(("{|", "|}", "|-", ":''", "----")):
            continue
        if l.startswith("!"):
            cabecalho = [limpar(c) for c in re.split(r"!!|\|\|", l.lstrip("!"))]
            continue
        if l.startswith("|"):
            cel = [limpar(c) for c in re.split(r"\|\|", l.lstrip("|"))]
            cel = [c for c in cel if c]
            if len(cel) >= 2 and re.fullmatch(r"[\d,.]+", cel[1].replace(" ", "")):
                itens.append(f"{cel[0]} x{cel[1]}")
            elif cel:
                itens.append(" - ".join(cel))
            continue
        e_lista = l[0] in "*#"
        l = limpar(re.sub(r"^[*#:]+\s*", "", l))
        if l and not l.startswith("=") and len(l) > 1:
            (itens if e_lista else soltas).append(l)
    if not so_listas:
        return itens + soltas
    return itens or [x for x in soltas if len(x) <= 160]


def _secoes(wikitext: str) -> list[tuple[str, str]]:
    """[(titulo da secao em minusculas, texto)] - o trecho antes da primeira secao tem titulo ''."""
    partes = re.split(r"^(==+)\s*(.*?)\s*\1\s*$", wikitext, flags=re.M)
    saida = [("", partes[0])]
    for k in range(1, len(partes) - 2, 3):
        saida.append((limpar(partes[k + 1]).lower(), partes[k + 2]))
    return saida


def _numero(txt: str) -> int | None:
    m = re.search(r"\d[\d,]*", txt or "")
    return int(m.group(0).replace(",", "")) if m else None


def _tipo(texto: str, cats: list[str]) -> str:
    """daily / repeatable / story / side - so' pelo que a propria pagina diz."""
    t = texto.lower()
    if "daily" in t[:900]:
        return "daily"
    if "repeatable" in t[:900]:
        return "repeatable"
    if any(c.lower() == "story mission" for c in cats) or re.search(r"story mission|story arc|\barc\b|questline", t[:900]):
        return "story"
    return "side"


def converter(titulo: str, pag: dict, nomes_cliente: set[str]) -> dict:
    """Pagina do Fandom -> ficha de missao."""
    wt = pag["wikitext"]
    caixa = _caixa(wt)
    secoes = _secoes(wt)
    corpo_lead = limpar(secoes[0][1]) if secoes else ""
    nome = re.sub(r"\s*\(mission\)$", "", caixa.get("title1") or titulo, flags=re.I).strip()
    nome = re.sub(r"^Mission:\s*", "", nome)

    objetivos: list[str] = []
    recompensas: list[str] = []
    descricao_sec = ""
    requisitos: list[str] = []
    notas: list[dict] = []
    for sec, txt in secoes[1:]:
        if sec in ("objectives", "mission objectives", "objective"):
            objetivos += _linhas(txt, so_listas=True)
        elif sec in ("rewards", "reward"):
            recompensas += _linhas(txt, so_listas=True)
        elif sec in ("mission description", "description"):
            descricao_sec = descricao_sec or " ".join(_linhas(txt))
        elif sec in ("prerequisites", "unlocking", "level requirement", "level gate", "starting npc"):
            requisitos += _linhas(txt)
        elif sec in ("dialogue", "see also", "change history", "mission card", "mission cards", "mission details") or not sec:
            continue
        else:
            linhas = _linhas(txt)
            if linhas:
                notas.append({"title": limpar(re.sub(r"\[\[|\]\]", "", sec)).title(), "lines": linhas[:12]})

    citacao = ""
    for m in re.finditer(r"^:''\"(.+?)\"''\s*$", wt, re.M):
        citacao = limpar(m.group(1))
        break
    paragrafos = [limpar(p) for p in re.split(r"\n\s*\n", secoes[0][1]) if limpar(p) and not limpar(p).startswith(("=", ":"))]
    resumo = paragrafos[0] if paragrafos else ""
    resumo = re.sub(r"\s+", " ", resumo.split("----")[0]).strip()
    if resumo.endswith(":"):   # "... A tela da missao diz:" - a frase seguinte e' a citacao, que ja' e' mostrada a parte
        resumo = resumo.rsplit(". ", 1)[0].rstrip(".") + "." if ". " in resumo else resumo.rstrip(":")
    if len(resumo) > 320:
        corte = resumo[:320].rsplit(". ", 1)[0]
        resumo = (corte if len(corte) > 80 else resumo[:320]).rstrip(" ,;") + ("." if not corte.endswith(".") else "")

    lvl = _numero(caixa.get("level_range") or caixa.get("level") or "")
    if lvl is None:
        m = re.search(r"^Level\s+(\d+)\s*$", re.sub(r"\[\[.*?\]\]", "", wt), re.M) or re.search(r"Level\s+(\d+)\s*(?://|$)", caixa.get("caption1", ""))
        lvl = int(m.group(1)) if m else None
    rank = re.sub(r"-?\s*rank", "", caixa.get("mission_rank") or caixa.get("rank") or "", flags=re.I).strip().upper() or None
    if rank == "MAIN":
        rank = "Main"
    if rank not in (None, "Main", "S", "A", "B", "C", "D", "A/B"):   # "Information needed", tabelas de tiers... nao sao um rank so'
        rank = None
    exp = caixa.get("reward") or caixa.get("exp") or ""
    exp = re.sub(r"\s*EXP.*$", "", exp, flags=re.I).strip()
    ryo = caixa.get("ryo") or ""
    extra = caixa.get("additional_reward") or ""
    if not recompensas:
        if exp:
            recompensas.append(f"{exp} EXP")
        if ryo:
            recompensas.append(f"{ryo} Ryo")
        if extra:
            recompensas.append(extra)

    regioes = sorted({REGIOES[c] for c in pag["cats"] if c in REGIOES})
    topo = (titulo + " " + corpo_lead[:500]).lower()
    for chave, rotulo in (("leaf", "leaf"), ("sand", "sand"), ("mist", "mist"), ("takumi", "takumi")):
        if re.search(rf"\b{chave}\b", topo) and rotulo not in regioes:
            regioes.append(rotulo)

    npc = caixa.get("npc", "")
    base = re.sub(r"\s*[\(\-].*$", "", nome).strip().lower()
    return {
        "id": re.sub(r"[^a-z0-9]+", "-", nome.lower()).strip("-"),
        "name": nome,
        "level": lvl,
        "rank": rank,
        "type": _tipo(corpo_lead + " " + descricao_sec, pag["cats"]),
        "areas": regioes,
        "npc": npc or None,
        "location": caixa.get("mission_location") or None,
        "quote": citacao or None,
        "summary": resumo or None,
        "description": (descricao_sec or None) if descricao_sec != resumo else None,
        "objectives": objetivos,
        "requirements": requisitos,
        "rewards": {"exp": exp or None, "ryo": ryo or None, "extra": extra or None, "list": recompensas},
        "sections": notas[:5],
        "inClient": nome.lower() in nomes_cliente or base in nomes_cliente,
        "source": "https://ninonline.fandom.com/wiki/" + urllib.parse.quote(titulo.replace(" ", "_")),
    }


def nomes_do_cliente(caminho: str) -> set[str]:
    """Todos os textos curtos de MissionKeys do cliente (nomes de missao entre eles), em minusculas."""
    try:
        dados = json.loads(Path(caminho).read_text(encoding="utf-8-sig"), strict=False)
    except OSError:
        print("Aviso: cliente do jogo nao encontrado; 'inClient' fica falso.", file=sys.stderr)
        return set()
    return {x.strip("\x00").strip().lower() for x in dados.get("MissionKeys", []) if x.strip("\x00").strip()}


def _nk(t: str) -> str:
    """Normaliza para comparar: minusculas, sem pontuacao, aspas curvas viram retas."""
    t = (t or "").replace("\x00", "").replace("\u2019", "'").replace("\u2018", "'").replace("\n", " ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", t.lower())).strip()


def _sem_links(t: str) -> str:
    """Tira a marcacao [[A|B]] do wiki (fica so' B)."""
    return re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", t or "")


def conferir_com_cliente(fichas: list[dict], caminho: str) -> None:
    """Compara cada missao com o cliente do jogo e grava nela `clientStatus` (confirmed / partial / divergent / fandom-only),
    `clientName` (nome que o jogo usa, se for diferente do Fandom) e `clientNote` (motivo, em ingles).
    O cliente so' tem NOMES e TEXTOS (pedido, objetivos); nivel, rank, EXP e recompensas nunca sao conferidos aqui."""
    dados = json.loads(Path(caminho).read_text(encoding="utf-8-sig"), strict=False)
    chaves = [x.replace("\x00", "").strip() for x in dados.get("MissionKeys", [])]
    chaves = [c for c in chaves if c]
    por_nk = {_nk(c): c for c in chaves}
    longas = [_nk(c) for c in chaves if len(c) > 20]
    for f in fichas:
        nome = re.sub(r"\.png$", "", f["name"].strip())
        base = re.sub(r"\s*-?\s*\(.*$", "", nome).strip()  # tira "- (Leaf Seals)" etc.
        alvo, achou = None, None
        for cand in (nome, base, "the " + base):
            if _nk(cand) in por_nk:
                achou = por_nk[_nk(cand)]; break
        if not achou:  # serie "X" -> "X I/II/III..." ou nome quase igual (erro de digitacao)
            for r in ("i", "ii", "iii", "iv", "v"):
                if _nk(base) + " " + r in por_nk:
                    achou = por_nk[_nk(base) + " " + r]; break
        if not achou and len(_nk(base).split()) >= 2:  # pagina de agrupamento: o jogo tem variantes ("X (Leaf)", "Enter the X...")
            achou = next((c for c in chaves if len(c) < 60 and re.search(r"\b" + re.escape(_nk(re.sub(r"\s+mission$", "", base, flags=re.I))) + r"\b", _nk(c))), None)
            if achou:
                f["clientStatus"], f["clientNote"] = "partial", f"Grouping page: the game has variants such as \"{achou}\"."
                continue
        if not achou:
            alvo = difflib.get_close_matches(_nk(base), [k for k in por_nk if len(k) < 45], 1, 0.93)
            if alvo:
                f["clientName"] = por_nk[alvo[0]]
                if difflib.SequenceMatcher(None, _nk(base), alvo[0]).ratio() >= 0.975:  # erro de digitacao do Fandom: vale o nome do jogo
                    f["name"], f["clientNote"], f["clientStatus"] = por_nk[alvo[0]], f"Name fixed from the Fandom spelling \"{nome}\" to the game's.", "partial"
                    f.pop("clientName"); continue
        if not achou and not f.get("clientName"):
            dep = [c for c in chaves if _nk(c).startswith(_nk(base)) and "deprecated" in c.lower()]
            f["clientStatus"], f["clientNote"] = "fandom-only", ("The game marks this mission as deprecated." if dep else "No mission with this name exists in the game files (removed, renamed or a Fandom grouping page).")
            continue
        if not achou:
            f["clientStatus"], f["clientNote"] = "divergent", f"The game calls it \"{f['clientName']}\"."
            continue
        if _nk(achou) != _nk(f["name"]) and _nk(achou) != _nk(base) and not f.get("clientName") and not _nk(achou).startswith(_nk(base)):
            f["clientName"] = achou
        # texto: pedido/resumo/objetivos do Fandom x textos do cliente
        textos = [_sem_links(f.get("quote")), _sem_links(f.get("summary"))] + [_sem_links(re.sub(r"\s*\(\d+/\d+\w*\)", "", o)) for o in f["objectives"]]
        melhor, trecho = 0.0, ""
        for t in textos:
            n = _nk(t)
            if len(n) < 25:
                continue
            if any(k in n for k in longas if len(k) > 25) or n in longas:
                melhor, trecho = 1.0, t; break
            for k in longas:
                if abs(len(k) - len(n)) < 0.4 * max(len(k), len(n)):
                    r = difflib.SequenceMatcher(None, n, k).ratio()
                    if r > melhor:
                        melhor, trecho = r, k
        if melhor >= 0.92:
            f["clientStatus"] = "confirmed"
        elif melhor >= 0.65:
            f["clientStatus"], f["clientNote"] = "divergent", "The request text on the wiki differs from the game text: " + trecho[:200]
        else:
            f["clientStatus"] = "partial"
    f_ok = sum(1 for f in fichas if f["clientStatus"] == "confirmed")
    print("Conferencia com o cliente:", {k: sum(1 for f in fichas if f["clientStatus"] == k) for k in ("confirmed", "partial", "divergent", "fandom-only")}, f"(confirmed={f_ok})")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--cliente", default=CLIENTE_PADRAO)
    ap.add_argument("--so-verificar", action="store_true", help="nao baixa o Fandom: so' reconfere o missions.json atual com o cliente")
    args = ap.parse_args()
    if args.so_verificar:
        dados = json.loads(DESTINO.read_text(encoding="utf-8"))
        conferir_com_cliente(dados["missions"], args.cliente)
        DESTINO.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
        return
    cliente = nomes_do_cliente(args.cliente)
    paginas = baixar_paginas()
    fichas = [converter(t, p, cliente) for t, p in sorted(paginas.items())]
    vistos: set[str] = set()
    unicas = []
    for f in fichas:
        if f["id"] and f["id"] not in vistos:
            vistos.add(f["id"])
            unicas.append(f)
    conferir_com_cliente(unicas, args.cliente)
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps({"source": "Nin Online Wiki (Fandom), CC-BY-SA", "missions": unicas}, ensure_ascii=False, indent=1), encoding="utf-8")
    com_obj = sum(1 for f in unicas if f["objectives"])
    print(f"{len(unicas)} missoes gravadas em {DESTINO} ({com_obj} com objetivos, {sum(1 for f in unicas if f['inClient'])} confirmadas no cliente).")


if __name__ == "__main__":
    main()
