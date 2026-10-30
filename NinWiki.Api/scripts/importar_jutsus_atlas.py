"""
Completa os jutsus de JOGADOR com o que o jogo e a comunidade trazem: Nin Atlas (data/atlas.js: os "Manuals" - pergaminhos de tecnica - com nivel
exigido, atributo exigido e texto), nomes do cliente do jogo (locales/English.json -> JutsuKeys) e, como complemento, a ficha do Nin Online Wiki (Fandom,
mesmas funcoes de scripts/importar_jutsus_fandom.py) para tier, tempo de conjuracao, custo de chakra, recarga e dano por nivel.

O que cada fonte realmente traz (conferido): o Atlas NAO tem aba de dados de jutsu (a pagina #/jutsus e' "em breve"); so' os itens Manual trazem
nivel (lvl), atributo exigido (req = [[id do atributo, valor]]; 1=Strength, 3=Intellect, 4=Agility, 5=Chakra) e a descricao do pergaminho. O cliente do
jogo so' tem os NOMES. Por isso dano/custo/tempo de conjuracao/tier so' vem do Fandom.

Regras (para nao estragar o que a equipe ja' escreveu):
  - So' PREENCHE CAMPO VAZIO; nunca sobrescreve texto curado. Jutsu NPC (is_npc) nunca e' tocado. Lixo interno (buff, montaria, GM, debuff) nao tem
    pergaminho nem pagina e por isso nunca e' tocado nem publicado.
  - Cria como RASCUNHO o jutsu que o jogo tem (Manual no Atlas ou nome no cliente) e o banco nao (ex.: 16 Palms, Soap Bubble Shark).
  - Mastery: a da ficha do Fandom; senao deduzida do texto do pergaminho ("Fire Ninjutsu", "Fan", "Gentle Fist", "Bubble", "weapon mastery"...).
    Pergaminho sem mastery no texto ("basic technique", Genjutsu) e' jutsu de UTILIDADE (mastery_id vazio).
  - A descricao do pergaminho ("A scroll containing the knowledge of ... that allows the user to X") vira "Allows the user to X". So' em ingles, no
    campo sem sufixo; `_pt` fica para a traducao automatica.
  - CRITERIO DE "COMPLETO" (so' estes sao publicados, e so' com --publicar-completos): descricao + tempo de conjuracao + (dano OU custo de chakra)
    + (mastery, ou utilidade) + tier conhecido (vindo da fonte; exigido so' quando tem mastery - utilidade nao tem tier).
    Isso e' o mesmo criterio do importador do Fandom, so' que sem aceitar o tier 1 padrao de rascunho como se fosse dado.
  - Por padrao e' SIMULACAO. `--aplicar` grava. Recusa banco nao-local, a menos que use --permitir-remoto (faca backup antes).

Uso (pasta NinWiki.Api, venv, `$env:PYTHONPATH="."`):
    python scripts/importar_jutsus_atlas.py                          # simulacao + relatorio
    python scripts/importar_jutsus_atlas.py --aplicar                # grava os campos (continua rascunho)
    python scripts/importar_jutsus_atlas.py --aplicar --publicar-completos
    python scripts/importar_jutsus_atlas.py --atlas caminho\\atlas.js --sem-fandom   # offline / so' o Atlas
"""
import argparse
import asyncio
import json
import re
import sys
from collections import Counter
from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.enums import ContentStatus
from app.models.masteries import Jutsu, Mastery
from scripts._guarda_banco import exigir_banco_local
from scripts.criar_jutsus_do_jogo import ICONE_PADRAO, normalizar, parece_nome_de_jutsu, slug
from scripts.importar_jutsus_fandom import CATEGORIAS, _doc, _titulos_da_categoria, _wikitexto, ler_template, montar
from scripts.sincronizar_imagens_atlas import carregar_atlas

CLIENTE = Path(r"E:\SteamLibrary\steamapps\common\Nin Online\data files\locales\English.json")
ATRIBUTOS = {1: "Strength", 2: "Fortitude", 3: "Intellect", 4: "Agility", 5: "Chakra"}   # ids do Atlas (conferido com jutsus ja' publicados)
TIPO_MANUAL = 12
# Nome curto do pergaminho (Atlas) -> nome com que o jutsu ja' esta' no wiki (conferido pelo nivel e pelo texto); evita criar duplicata
APELIDOS = {"kunai clone": "kunai shadow clone", "bubble solution spit": "bubble solution spitting", "lightning beast": "lightning beast fang",
            "soap bubble shark": "great bubble shark"}
# Trecho do texto do pergaminho -> mastery (a ordem importa: "weapon" antes de "lightning puppet ... weapon mastery users")
PALAVRAS_MASTERY = (("weapon", "weapon"), ("gentle fist", "taijutsu"), ("taijutsu", "taijutsu"), ("medical", "medical"), ("fire", "fire"),
                    ("water", "water"), ("bubble", "water"), ("fan ", "wind"), ("wind", "wind"), ("lightning", "lightning"), ("earth", "earth"))


def limpar_descricao(desc: str) -> str:
    """'A scroll containing the knowledge of a Fire technique allowing the user to spit fire.' -> 'Allows the user to spit fire.'; se nao casar, devolve como veio."""
    m = re.search(r"\b(?:technique|ninjutsu|jutsu)\s+(?:that\s+|which\s+)?(?:allows?|allowing|enables?)\s+(?:the\s+|its\s+)?(?:user|users|it's user)\s+to\s+(.+)$",
                  desc.strip(), re.I | re.S)
    if m and desc.lower().startswith("a scroll"):
        resto = m.group(1).strip()
        return "Allows the user to " + resto[0].lower() + resto[1:] if resto else desc
    return desc.strip()


def deduzir_mastery(desc: str) -> str | None:
    """Mastery pelo texto do pergaminho; None = utilidade (basic/Genjutsu/sem mastery citada)."""
    m = re.search(r"knowledge of (?:an?|the)\s+(.+?)\s+(?:technique|ninjutsu|jutsu)", desc, re.I)
    alvo = (m.group(1) if m else "").lower() + " "
    if "summoning" in alvo and "weapon mastery" in desc.lower():
        return "weapon"
    for palavra, mastery in PALAVRAS_MASTERY:
        if palavra in alvo:
            return mastery
    return None


def do_manual(item: dict) -> dict:
    """Campos do Jutsu que um item Manual do Atlas permite preencher (mastery pode vir None = utilidade; chave 'utilidade' avisa isso)."""
    d: dict = {}
    if item.get("lvl"):
        d["required_level"] = str(item["lvl"])
    reqs = [f"{v} {ATRIBUTOS[i]}" for i, v in item.get("req", []) if i in ATRIBUTOS]
    if reqs:
        d["required_stat"] = " / ".join(reqs)[:100]
    texto = limpar_descricao(item.get("desc", ""))
    if texto:
        d["description"] = texto
        d["long_description"] = _doc([texto])
    mastery = deduzir_mastery(item.get("desc", ""))
    if mastery:
        d["mastery_id"] = mastery
    return d


def nomes_do_cliente() -> dict[str, str]:
    """{chave normalizada: nome} dos JutsuKeys do cliente que parecem nome de jutsu e nao sao de NPC; vazio se o cliente nao esta' instalado."""
    if not CLIENTE.exists():
        return {}
    chaves = json.loads(CLIENTE.read_text(encoding="utf-8-sig")).get("JutsuKeys", [])
    return {normalizar(n): n for n in chaves if parece_nome_de_jutsu(n) and "(NPC)" not in n.upper()}


def carregar_fandom() -> dict[str, dict]:
    """{chave normalizada: campos montados} de todas as fichas {{Jutsu}} do Fandom (mesma leitura do importador do Fandom)."""
    titulos = sorted({t for c in CATEGORIAS for t in _titulos_da_categoria(c)})
    out: dict[str, dict] = {}
    for t, txt in _wikitexto(titulos).items():
        r = ler_template(txt)
        if r:
            out[normalizar(t)] = {"_titulo": t, **montar(*r)}
    return out


def completo(d: dict, utilidade: bool) -> bool:
    """Criterio de publicacao (ver docstring do arquivo): descricao, tempo de conjuracao, dano ou chakra, mastery/utilidade e tier conhecido."""
    return all([d.get("description"), d.get("cast_time"), d.get("damage_by_level") or d.get("chakra_cost"), d.get("mastery_id") or utilidade,
                utilidade or d.get("tier_conhecido")])


async def main() -> None:
    """Cruza Atlas + cliente + Fandom com o banco e mostra (ou grava) o que seria preenchido, criado e publicado."""
    ap = argparse.ArgumentParser(description="Completa/cria os jutsus de jogador com Atlas + cliente do jogo + Fandom.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--publicar-completos", action="store_true", help="publica os rascunhos de jogador que ficaram completos")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--atlas", help="atlas.js local (padrao: baixa do Nin Atlas)")
    ap.add_argument("--sem-fandom", action="store_true", help="nao consulta o Fandom (so' Atlas + cliente)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}{' + publicar completos' if args.publicar_completos else ''}")

    atlas = carregar_atlas(args.atlas)
    manuais = {}
    for i in atlas["items"].values():
        if i.get("type") == TIPO_MANUAL:
            n = normalizar(re.sub(r"\s*Manual$", "", i["name"]))
            manuais[APELIDOS.get(n, n)] = i
    cliente = nomes_do_cliente()
    fandom = {} if args.sem_fandom else carregar_fandom()
    print(f"Atlas: {len(manuais)} manuais de jutsu | cliente: {len(cliente)} nomes | Fandom: {len(fandom)} fichas")

    contagem: Counter = Counter()
    por_mastery: dict[str, Counter] = {}
    incompletos: list[str] = []
    async with AsyncSessionLocal() as db:
        maestrias = set((await db.execute(select(Mastery.id))).scalars().all())
        jutsus = list((await db.execute(select(Jutsu))).scalars().all())
        ids = {j.id for j in jutsus}
        existentes = {normalizar(j.name) for j in jutsus if not j.is_npc}

        # 1) cria (rascunho) o que o jogo tem e o banco nao: tem Manual no Atlas ou nome no cliente COM ficha no Fandom/Manual (evita lixo interno)
        for chave in sorted(set(manuais) | {c for c in cliente if c in fandom}):
            if chave in existentes or not chave:
                continue
            nome = (fandom.get(chave, {}).get("_titulo") or cliente.get(chave) or re.sub(r"\s*Manual$", "", manuais[chave]["name"])).strip()
            base, n = slug(nome), 2
            novo_id = base
            while novo_id in ids:
                novo_id, n = f"{base}-{n}", n + 1
            ids.add(novo_id)
            novo = Jutsu(id=novo_id, name=nome, mastery_id=None, path_id=None, tier=1, chakra_cost=0, description="", long_description="", effect="", range="",
                         cast_time="", cooldown="", icon=ICONE_PADRAO, is_npc=False, status=ContentStatus.DRAFT)
            jutsus.append(novo)
            contagem["jutsus criados (rascunho)"] += 1
            print(f"   novo: {novo_id}  ({nome})")
            if args.aplicar:
                db.add(novo)

        # 2) preenche so' campos vazios dos jutsus que tem fonte
        for j in jutsus:
            if j.is_npc:
                contagem["NPC ignorados"] += 1
                continue
            chave = normalizar(j.name)
            manual, ficha = manuais.get(chave), fandom.get(chave)
            if not manual and not ficha:
                continue
            dados = do_manual(manual) if manual else {}
            utilidade_atlas = bool(manual) and "mastery_id" not in dados
            if ficha:   # a ficha do Fandom e' mais detalhada que o texto do pergaminho: vence quando traz o campo
                dados = {**dados, **{k: v for k, v in ficha.items() if not k.startswith("_")}}
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
            for c in mudou:
                contagem[f"campo {c}"] += 1
            contagem["jutsus preenchidos"] += bool(mudou)
            # situacao efetiva depois do preenchimento (simulacao inclusive)
            ef = {c: (getattr(j, c) or dados.get(c)) for c in ("mastery_id", "description", "damage_by_level", "chakra_cost", "cast_time")}
            ef["tier_conhecido"] = j.tier > 1 or bool(j.scroll_type) or "tier" in dados
            utilidade = not ef["mastery_id"] and (utilidade_atlas or bool(ficha and not ficha.get("mastery_id")))
            rotulo = ef["mastery_id"] or ("utility" if utilidade else "(sem mastery)")
            linha = por_mastery.setdefault(rotulo, Counter())
            linha["no banco"] += 1
            if j.status == ContentStatus.PUBLISHED:
                linha["ja publicados"] += 1
            elif completo(ef, utilidade):
                linha["completos (publicar)"] += 1
                contagem["completos (podem publicar)"] += 1
                if args.publicar_completos and args.aplicar:
                    j.status = ContentStatus.PUBLISHED
                    if utilidade:
                        j.mastery_id = None
                    contagem["publicados agora"] += 1
            else:
                linha["ficam rascunho"] += 1
                faltam = [n for n, ok in (("descricao", ef["description"]), ("cast_time", ef["cast_time"]), ("dano/chakra", ef["damage_by_level"] or ef["chakra_cost"]),
                                          ("mastery", ef["mastery_id"] or utilidade), ("tier", utilidade or ef["tier_conhecido"])) if not ok]
                incompletos.append(f"{j.name} [{rotulo}] falta: {', '.join(faltam)}")
        if args.aplicar:
            await db.commit()

    print("\nResumo:")
    for k, v in sorted(contagem.items()):
        print(f"  {k}: {v}")
    print("\nPor mastery (jutsus de jogador que tem fonte):")
    for m, c in sorted(por_mastery.items()):
        print(f"  {m:<14} {dict(c)}")
    print(f"\nFicam rascunho por falta de dado ({len(incompletos)}):")
    for linha in incompletos:
        print("  -", linha)
    print("\nGravado." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
