"""
Preenche os jutsus (hoje rascunhos so' com o nome, vindos do cliente do jogo) com os dados do Nin Online Wiki (Fandom): maestria, tier, nivel e atributo
exigidos, loja, nivel maximo, tempo de conjuracao, classe, alcance, efeitos, custo de chakra, recarga e dano por nivel, mais a descricao do texto da pagina.

Regras (para nao estragar o que a equipe ja' escreveu):
  - So' PREENCHE CAMPO VAZIO; nunca sobrescreve o que ja' existe.
  - So' mexe em jutsu que ja' existe no banco (o nome veio do cliente do jogo, entao o jutsu existe de verdade); pagina do Fandom sem par e' so' listada.
  - Por padrao e' SIMULACAO. `--aplicar` grava; `--publicar-completos` tambem publica os que ficaram com dados suficientes
    (maestria, tier, descricao, dano ou custo de chakra, tempo de conjuracao). Publicar e' so' no banco local; levar para producao e' passo a parte.
  - Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).
  - A traducao PT nao e' feita aqui (a descricao entra so' em ingles; o botao de traducao do painel / DeepL completa depois).

Os valores do Fandom sao da comunidade e mudam a cada atualizacao do jogo: revise no painel antes de levar para producao.

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/importar_jutsus_fandom.py                          # simulacao + relatorio
    python scripts/importar_jutsus_fandom.py --aplicar                # grava os campos (continua rascunho)
    python scripts/importar_jutsus_fandom.py --aplicar --publicar-completos
"""
import argparse
import asyncio
import json
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.slug import slugify
from app.models.enums import ContentStatus
from app.models.masteries import Jutsu, Mastery
from scripts._guarda_banco import exigir_banco_local

API = "https://ninonline.fandom.com/api.php"
CABECALHOS = {"User-Agent": "Mozilla/5.0 NinWikiBot", "Referer": "https://ninonline.fandom.com/"}
CATEGORIAS = ("Techniques", "Jutsu", "Advanced Jutsu")
ROMANOS = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}


def _get(params: dict) -> dict:
    """GET na API MediaWiki do Fandom (precisa de User-Agent e Referer, senao ele bloqueia)."""
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=CABECALHOS), timeout=40).read())


def _titulos_da_categoria(nome: str) -> list[str]:
    """Titulos de todas as paginas de uma categoria (segue a paginacao)."""
    titulos, cont = [], {}
    while True:
        r = _get({"action": "query", "list": "categorymembers", "cmtitle": f"Category:{nome}", "cmlimit": 500, "cmtype": "page", **cont})
        titulos += [m["title"] for m in r["query"]["categorymembers"]]
        if "continue" not in r:
            return titulos
        cont = r["continue"]


def _wikitexto(titulos: list[str]) -> dict[str, str]:
    """Wikitexto de cada pagina (em lotes de 40 titulos)."""
    out: dict[str, str] = {}
    for i in range(0, len(titulos), 40):
        r = _get({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": "|".join(titulos[i:i + 40])})
        for p in r["query"]["pages"].values():
            if "revisions" in p:
                out[p["title"]] = p["revisions"][0]["slots"]["main"]["*"]
    return out


def _limpar(v: str) -> str:
    """Tira marcacao wiki de um valor: [[a|b]] -> b, [[a]] -> a, <br> -> quebra de linha, negrito/italico, tags e arquivos."""
    v = re.sub(r"\[\[File:[^\]]*\]\]", "", v, flags=re.I)
    v = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", v)
    v = re.sub(r"<br\s*/?>", "\n", v, flags=re.I)
    v = re.sub(r"<ref[^>]*>.*?</ref>|<[^>]+>", "", v, flags=re.S)
    v = re.sub(r"\{\{[^{}]*\}\}", "", v)
    v = v.replace("'''", "").replace("''", "")
    return v.strip()


def ler_template(txt: str) -> tuple[dict[str, str], str] | None:
    """
    Le o primeiro {{Jutsu|...}}: devolve (campos, texto_da_pagina_depois_do_template). Os campos vem separados por "|" na mesma linha, entao
    a divisao so' conta "|" fora de [[...]] e {{...}}.
    """
    m = re.search(r"\{\{\s*Jutsu\s*\|", txt, re.I)
    if not m:
        return None
    i, nivel, partes, atual = m.end(), 1, [], []
    while i < len(txt) and nivel > 0:
        dois = txt[i:i + 2]
        if dois in ("{{", "[["):
            nivel += 1
            atual.append(dois)
            i += 2
        elif dois in ("}}", "]]"):
            nivel -= 1
            if nivel > 0:
                atual.append(dois)
            i += 2
        elif txt[i] == "|" and nivel == 1:
            partes.append("".join(atual))
            atual = []
            i += 1
        else:
            atual.append(txt[i])
            i += 1
    partes.append("".join(atual))
    campos = {}
    for p in partes:
        if "=" in p:
            k, v = p.split("=", 1)
            campos[k.strip().lower()] = v.strip()
    return campos, txt[i:]


def _por_nivel(valor: str) -> list[str]:
    """'Level 1 - 34 <br> Level 2 - 36' -> ['34','36']; valor unico ('22 Seconds') -> ['22 Seconds']."""
    linhas = [l.strip() for l in re.split(r"<br\s*/?>|\n", valor) if l.strip()]
    return [re.sub(r"^level\s*\d+\s*[-:]\s*", "", l, flags=re.I).strip() for l in linhas]


def _numero(s: str) -> int | None:
    """Primeiro numero inteiro do texto, ou None."""
    m = re.search(r"\d+", s or "")
    return int(m.group()) if m else None


def _segundos(s: str) -> str:
    """'22 Seconds' / '1 second' / '12s' -> '22s'. Se nao for so' segundos, devolve o texto como veio."""
    m = re.fullmatch(r"\s*([\d.]+)\s*(?:s|sec|secs|second|seconds)?\s*", s, re.I)
    return f"{m.group(1)}s" if m else s.strip()


def _danos(itens: list[str]) -> list[str]:
    """Dano por nivel sem enfeite: '28 Base Damage' -> '28'; '30/31/31 (per rank)' -> 30, 31, 31; sem numero ('None (scales...)') e' descartado."""
    out: list[str] = []
    for d in itens:
        d = re.sub(r"\s*base damage", "", d, flags=re.I).strip()
        if not re.search(r"\d", d):
            continue
        if re.fullmatch(r"[\d.]+(?:\s*/\s*[\d.]+)+\s*(?:\(.*\))?", d):
            out += re.findall(r"[\d.]+", d.split("(")[0])
        else:
            out.append(d)
    return out


def _descricao(resto: str) -> tuple[str, list[str]]:
    """Paragrafos do texto da pagina ate' o primeiro titulo (== ... ==) ou lista: (primeiro paragrafo, todos). Sem marcacao."""
    paragrafos = []
    for bloco in re.split(r"\n\s*\n", resto.strip()):
        b = bloco.strip()
        if b.startswith("=="):
            break
        if not b or b.startswith(("*", "#", "{|", "[[Category", "[[File")):
            continue
        t = _limpar(b)
        # aviso fixo das paginas de Advanced Jutsu (nao e' descricao) e restos de marcacao wiki
        if t and not t.startswith("Advanced Jutsu are") and not re.search(r"[\[\]{}|]", t):
            paragrafos.append(t)
    return (paragrafos[0] if paragrafos else ""), paragrafos


def _doc(paragrafos: list[str]) -> str:
    """Documento Tiptap (JSON em texto) com um paragrafo por texto."""
    return json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": p}]} for p in paragrafos]}, ensure_ascii=False)


def montar(campos: dict[str, str], resto: str) -> dict:
    """Converte os campos do Fandom nos campos do nosso Jutsu (so' os que existirem)."""
    out: dict = {}
    mast = re.search(r"\[\[(\w+) Mastery", campos.get("mastery", ""))
    if mast:
        out["mastery_id"] = mast.group(1).lower()
    tier = _limpar(campos.get("tier", ""))
    m = re.search(r"^(.*?)\s+(I{1,3}|IV|V)$", tier)
    if m:
        out["tier"] = ROMANOS[m.group(2)]
        out["scroll_type"] = m.group(1).strip()
    nivel = _numero(_limpar(campos.get("level_req", "")))
    if nivel:
        out["required_level"] = str(nivel)
    for fandom, nosso in (("stat_req", "required_stat"), ("shop", "shop"), ("cast_time", "cast_time"), ("cast_type", "cast_type"),
                          ("class", "jutsu_class")):
        v = _limpar(campos.get(fandom, ""))
        if v:
            out[nosso] = v.replace("\n", " ")[:100]
    # alcance pode vir por nivel ("Level 1 - 10 Tiles / Level 2 - 11 Tiles"): vira "10 Tiles / 11 Tiles" (sem repetir valores iguais)
    alcances = list(dict.fromkeys(a.strip("* ").replace("Tiles", " Tiles").replace("  ", " ") for a in _por_nivel(_limpar(campos.get("range", "")))
                                  if re.search(r"\d", a)))
    if alcances:
        out["range"] = " / ".join(re.sub(r"\s+", " ", a) for a in alcances)[:100]
    efeitos = [e.strip(" *") for e in _limpar(campos.get("special_effect", "")).split("\n") if e.strip(" *")]
    if efeitos:
        out["effect"] = ", ".join(efeitos)[:100]
    maximo = _numero(campos.get("maximum_jutsu_level", ""))
    if maximo:
        out["max_level"] = maximo
    custos = _por_nivel(_limpar(campos.get("chakra_cost", "")))
    if custos and _numero(custos[0]) is not None:
        out["chakra_cost"] = _numero(custos[0])
    danos = _danos(_por_nivel(_limpar(campos.get("base_damage", ""))))
    if danos:
        out["damage_by_level"] = danos
    recargas = [_segundos(c) for c in _por_nivel(_limpar(campos.get("cooldown", ""))) if c]
    if recargas:
        out["cooldown"] = recargas[0][:100]
        if len(recargas) > 1:
            out["cooldown_by_level"] = recargas
    # o nivel maximo declarado as vezes e' menor que a quantidade de niveis com dano/recarga listados: vale o maior
    niveis = max(len(danos), len(recargas), out.get("max_level", 0))
    if niveis:
        out["max_level"] = niveis
    curta, todos = _descricao(resto)
    if curta:
        out["description"] = curta
        out["long_description"] = _doc(todos)
    return out


def _chave(nome: str) -> str:
    """Chave de comparacao entre o nome do Fandom e o do jogo: slug sem a palavra final 'technique'/'jutsu'."""
    return re.sub(r"-(technique|jutsu)$", "", slugify(nome))


def completo(d: dict) -> bool:
    """Dados suficientes para publicar: maestria, tier, descricao, dano ou custo de chakra e tempo de conjuracao."""
    return all([d.get("mastery_id"), d.get("tier"), d.get("description"), d.get("damage_by_level") or d.get("chakra_cost"), d.get("cast_time")])


async def main() -> None:
    """Baixa o Fandom, cruza com os jutsus do banco e mostra (ou grava) o que seria preenchido."""
    ap = argparse.ArgumentParser(description="Preenche os jutsus com os dados do Nin Online Wiki (Fandom).")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--publicar-completos", action="store_true", help="publica os jutsus que ficaram com dados suficientes")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}{' + publicar completos' if args.publicar_completos else ''}")

    titulos = sorted({t for c in CATEGORIAS for t in _titulos_da_categoria(c)})
    textos = _wikitexto(titulos)
    fandom = {}
    sem_template = []
    for t, txt in textos.items():
        r = ler_template(txt)
        if r:
            fandom[_chave(t)] = (t, montar(*r))
        else:
            sem_template.append(t)
    print(f"Fandom: {len(textos)} paginas, {len(fandom)} com ficha de jutsu")

    contagem, sem_dados = Counter(), []
    async with AsyncSessionLocal() as db:
        maestrias = set((await db.execute(select(Mastery.id))).scalars().all())
        jutsus = (await db.execute(select(Jutsu))).scalars().all()
        usados = set()
        for j in jutsus:
            if j.is_npc:   # a versao de NPC tem numeros proprios (a pagina do Fandom e' do jutsu do jogador): nao mexe
                contagem["NPC ignorados"] += 1
                continue
            par = fandom.get(_chave(j.name))
            if not par:
                sem_dados.append(j.name)
                continue
            usados.add(_chave(j.name))
            _, dados = par
            if dados.get("mastery_id") not in maestrias:
                dados.pop("mastery_id", None)
            mudou = []
            for campo, valor in dados.items():
                atual = getattr(j, campo)
                # tier 1 e nivel maximo 1 sao o padrao de um rascunho recem-criado: contam como vazios enquanto nao ha' descricao
                vazio = atual in (None, "", [], 0) or (campo in ("tier", "max_level") and atual == 1 and not j.description)
                if vazio and valor not in (None, "", []):
                    mudou.append(campo)
                    if args.aplicar:
                        setattr(j, campo, valor)
            if mudou:
                contagem["jutsus preenchidos"] += 1
                for c in mudou:
                    contagem[f"campo {c}"] += 1
            # simulacao: olha o que ficaria depois do preenchimento (valor atual, ou o do Fandom se o campo estava vazio)
            efetivo = {c: (getattr(j, c) or dados.get(c)) for c in ("mastery_id", "tier", "description", "damage_by_level", "chakra_cost", "cast_time")}
            if completo(efetivo):
                contagem["completos (podem publicar)"] += 1
                if args.publicar_completos and args.aplicar and j.status == ContentStatus.DRAFT and not j.is_npc:
                    j.status = ContentStatus.PUBLISHED
                    contagem["publicados agora"] += 1
        sem_par = [t for k, (t, _) in fandom.items() if k not in usados]
        if args.aplicar:
            await db.commit()

    print("\nResumo:")
    for k, v in sorted(contagem.items()):
        print(f"  {k}: {v}")
    print(f"\nJutsus do banco sem pagina no Fandom: {len(sem_dados)} (ficam como estavam)")
    print(f"Paginas do Fandom sem jutsu no banco: {len(sem_par)} -> {', '.join(sem_par[:40])}{' ...' if len(sem_par) > 40 else ''}")
    print(f"Paginas sem ficha {{Jutsu}}: {len(sem_template)} -> {', '.join(sem_template[:20])}")
    print("\nGravado." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
