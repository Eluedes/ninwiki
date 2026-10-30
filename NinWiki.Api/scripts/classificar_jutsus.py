"""
Classifica os jutsus de JOGADOR que ficaram sem mastery/caminho e publica os que tem EVIDENCIA, mesmo com a ficha parcial (sem dano/custo/cast: campo
desconhecido fica vazio, nada e inventado). Complementa importar_jutsus_fandom.py e importar_jutsus_atlas.py (rode-os antes para preencher os campos).

POR QUE AS MASTERIES "PARECIAM VAZIAS": (1) a pagina publica so' lista PUBLICADOS; (2) masteries COM CAMINHOS (medical, taijutsu, water, weapon, wind) so'
mostravam o jutsu cujo path_id batesse com um caminho, e quase nenhum jutsu importado tinha path_id; (3) varios jutsus reais estavam sem mastery.

O QUE ESTE SCRIPT FAZ (tudo idempotente, so' preenche vazio, ignora NPC):
  1. CAMINHO: jutsu de mastery com caminhos e sem path_id recebe o caminho pelo atributo exigido (o mesmo atributo que define o caminho nas paginas de
     mastery do Fandom: Weapon Strength=Swords / Intellect=Tools; Taijutsu Strength=Gentle Fist / Agility; Medical Chakra / Intellect; Water Strength=
     Bubble / Intellect=Balanced; Wind Strength=Fan / Intellect=Offensive). Sem atributo conhecido fica sem caminho (a pagina mostra em "Outros jutsus").
  2. MASTERY por tabela (TABELA abaixo), cada linha com a evidencia (pagina do Fandom, pergaminho Manual do Atlas, posts da Steam ou o nome).
  3. Fichas das invocacoes animais (Toad, Slug...) a partir da pagina "Summoning Technique" do Fandom (um jutsu generico ensinado a todos).
  4. PUBLICAR (--publicar): so' linhas da tabela marcadas `publicar` E que ja' tem descricao (rode o importador do Atlas antes). O resto
     fica rascunho: entra no relatorio como INCERTO para o dono decidir.

Por padrao e' SIMULACAO. `--aplicar` grava. Banco nao-local so' com --permitir-remoto (faca backup antes).

Uso (pasta NinWiki.Api, venv, `$env:PYTHONPATH="."`):
    python scripts/classificar_jutsus.py                      # simulacao
    python scripts/classificar_jutsus.py --aplicar            # grava mastery/caminho (continua rascunho)
    python scripts/importar_jutsus_atlas.py --aplicar         # preenche descricao/nivel/atributo
    python scripts/classificar_jutsus.py --aplicar --publicar # publica os com evidencia
"""
import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.enums import ContentStatus
from app.models.masteries import Jutsu
from scripts._guarda_banco import exigir_banco_local
from scripts.criar_jutsus_do_jogo import normalizar
from scripts.importar_jutsus_fandom import _get, ler_template, montar

# Caminho de cada mastery por atributo exigido (ids de mastery_paths).
CAMINHO_POR_ATRIBUTO = {
    "medical": {"chakra": "medical-chakra", "intellect": "medical-intellect"},
    "taijutsu": {"strength": "taijutsu-strength", "agility": "taijutsu-agility"},
    "weapon": {"strength": "weapon-strength", "intellect": "weapon-intellect"},
    "water": {"strength": "water-pipe", "intellect": "water-elemental"},
    "wind": {"strength": "wind-fan", "intellect": "wind-elemental"},
}

# Evidencias (siglas): FANDOM = pagina do Nin Online Wiki; ATLAS = pergaminho Manual do Nin Atlas (texto do item no jogo); STEAM = post de update.
F_BAS = "Fandom 'Basic Techniques' / 'Universal Learnable Jutsu's' (qualquer um aprende)"
F_W = "Fandom 'Weapon Mastery' (lista de tecnicas, Lv.60 Oct 2026)"
A_PUP = "Atlas Manual (Lv.28): 'summoning technique que permite a weapon mastery users chamar um puppet'; OBS: o Fandom 'Sand Puppeteering' diz que e' dos Sand shinobi 'regardless of masteries'"

# nome (como no banco) -> (mastery ou None=Utility, publicar?, evidencia). Para quem ja' tem mastery a linha so' confirma e libera a publicacao.
TABELA: dict[str, tuple[str | None, bool, str]] = {
    # ---- Weapon ----
    "Fire Puppet Summoning": ("weapon", True, A_PUP), "Water Puppet Summoning": ("weapon", True, A_PUP), "Wind Puppet Summoning": ("weapon", True, A_PUP),
    "Earth Puppet Summoning": ("weapon", True, A_PUP), "Lightning Puppet Summoning": ("weapon", True, A_PUP), "Poison Puppet Summoning": ("weapon", True, A_PUP),
    "Shadow Chain Technique": ("weapon", True, F_W + " (Swords) + Atlas Manual Lv.60 Weapon technique"),
    "Shuriken Cascade Technique": ("weapon", True, F_W + " (Tools) + Atlas Manual Lv.60 Weapon technique"),
    # ---- Fire / Lightning / Earth / Wind / Water / Medical / Taijutsu (Lv.60 e outros, ja' com mastery: so' libera publicar) ----
    "Flame Orbs Technique": ("fire", True, "Fandom 'Jutsu' (Fire, Lv.60) + Atlas Manual 'Fire Ninjutsu'"),
    "Lightning Palm Technique": ("lightning", True, "Fandom 'Jutsu' (Lightning, Lv.60) + Atlas Manual 'Lightning Ninjutsu'; post Steam v6.0.1.2/6.0.1.7"),
    "Mud Dragon Technique": ("earth", True, "Atlas Manual 'Earth Ninjutsu' Lv.60"),
    "Maelstrom Technique": ("wind", True, "Fandom 'Jutsu' (Wind, Lv.60) + Atlas Manual 'Wind Ninjutsu'"),
    "Slicing Wind Technique": ("wind", True, "Fandom 'Jutsu' (Fan Style) + Atlas Manual 'Fan Ninjutsu' Lv.20"),
    "Dancing Tornadoes Technique": ("wind", True, "Fandom 'Jutsu' (Fan Style, Lv.60) + Atlas Manual"),
    "Bouncing Bubble Technique": ("water", True, "Fandom 'Jutsu' (lista Lv.60, estilo Bubble) + Atlas Manual Lv.60 req 80 Strength (atributo dos Bubble)"),
    "Bubble Coat Technique": ("water", True, "Fandom 'Jutsu' (Bubble, Mist) + Atlas Manual Lv.70"),
    "Twin Lion Fists Technique": ("taijutsu", True, "Fandom 'Jutsu' (Gentle Fist, Lv.60) + Atlas Manual Lv.70"),
    "Shatter Step Technique": ("taijutsu", True, "Fandom 'Jutsu' (Taijutsu, Lv.60) + Atlas Manual; post Steam v6.0.0.2 (dash jutsu)"),
    "64 Palms Technique": ("taijutsu", True, "Fandom 'Jutsu' (Gentle Fist, Lv.60) + Atlas Manual Lv.60"),
    "16 Palms Technique": ("taijutsu", True, "Fandom 'Jutsu' (Gentle Fist) + Atlas Manual Lv.35"),
    "Chakra Transfer": ("medical", True, "Fandom 'Jutsu' (Medical) + Atlas Manual 'Medical technique' Lv.35"),
    "Poisonous Spiral Technique": ("medical", True, "Fandom 'Jutsu' (Medical, Lv.60) + Atlas Manual"),
    "Status Extraction Technique": ("medical", True, "Fandom 'Jutsu' (Medical) + Atlas Manual Lv.25"),
    "Sticky Venom Technique": ("medical", True, "Fandom 'Jutsu' (Medical) + Atlas Manual Lv.30"),
    # ---- Utility (sem mastery): lista 'Learnable Jutsu's' do Fandom, o Atlas e a invocacao ----
    "Body Flicker Technique": (None, True, F_BAS), "Clone Technique": (None, True, F_BAS), "Substitution Technique": (None, True, F_BAS),
    "Chakra Seal": (None, True, F_BAS + " ('Chakra Seal Technique')"), "Fuuma Wind Shuriken Technique": (None, True, F_BAS),
    "Flash Flicker Technique": (None, True, "Fandom 'Flash Flicker Technique' + Atlas Manual Lv.25 'basic technique'; post Steam v6.0.0.2"),
    "Shuriken Barrage Technique": (None, True, "Fandom 'Shuriken Barrage Technique' + Atlas Manual Lv.5 'Ninjutsu' (sem mastery citada)"),
    "Toad Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Toad, Leaf) - contrato aprendido por qualquer um"),
    "Slug Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Slug, Leaf)"),
    "Clam Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Clam, Mist)"),
    "Panda Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Panda, Mist)"),
    "Weasel Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Weasel, Sand)"),
    "Hawk Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Hawk, Sand)"),
    "Ninken Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Ninken, nao exclusivo)"),
    "Monkey Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Monkey); post Steam v5.12.9 cita o jutsu"),
    "Snake Summoning Technique": (None, True, "Fandom 'Summoning Technique' (Snake, Cursed Laboratory)"),
    # ---- Mastery atribuida pelo NOME, SEM evidencia de que seja um jutsu aprendivel (sub-efeito/combo de um jutsu real): fica RASCUNHO ----
    **{n: ("weapon", False, "so' pelo nome (ataque/estagio de arma); sem pagina no Fandom nem Manual") for n in (
        "Boomerang Attack", "Boomerang Attack (Weapon)", "Double Kunai Attack", "Explosive Tag", "Kunai Explosion", "Kunai Explosion Big",
        "Shuriken Barrage Technique (1)", "Shuriken Barrage Technique (2)", "Great Shockwave Slash Technique", "Crescent Moon Beheading Slash",
        "Forbidden Puppet Technique", "Puppet Earth Prison", "Great Fire Strike Puppet", "Great Fireball Puppet", "Grand Fire Puppet", "Grand Water Puppet",
        "Grand Wind Puppet", "Grand Earth Puppet", "Grand Lightning Puppet", "Hunter Warglaive Attack", "Warglaive Attack", "Wooden Bow Attack")},
    **{n: ("water", False, "so' pelo nome (estagio/efeito de jutsu Bubble/Water)") for n in (
        "Bubble Prison Technique", "Bubble Clone Explosion", "Bubble Shark Explosion", "Bubble Coat Silence", "Soap Explosion Chain Reaction",
        "Water Prison Multiple Targets", "Water Sword Drill Technique", "Water Arm Technique")},
    **{n: ("wind", False, "so' pelo nome (estagio/efeito de jutsu Wind)") for n in (
        "Vacuum Sphere 2", "Vacuum Sphere 3", "Vacuum Slash Reverse Technique", "Vacum Slash Reverse Technique", "Gale Leap Technique",
        "Wind Drill Technique Ref", "Wind Slash Technique", "Wind Sword Drill Technique", "Maelstrom Pull")},
    **{n: ("taijutsu", False, "so' pelo nome (estagio/efeito de jutsu Taijutsu)") for n in (
        "Drunken Fist Stance", "Drunken Fist Slow", "Controlled Punch Technique", "Dragon Combo", "Ground Shattering Kick Technique", "Spinning Lotus Step Two")},
}
INVOCACOES = [n for n in TABELA if n.endswith("Summoning Technique") and TABELA[n][0] is None]


def atributo_exigido(texto: str) -> str | None:
    """'60 Intellect' / '35 chakra' / '60 Strength / 20 Agility' -> primeiro atributo em minusculo, ou None."""
    for palavra in (texto or "").lower().replace("/", " ").split():
        if palavra in {"strength", "intellect", "agility", "chakra"}:
            return palavra
    return None


def ficha_invocacao() -> dict:
    """Campos montados da pagina 'Summoning Technique' do Fandom (nivel 25+, loja, conjuracao, recarga, custo...); {} se o Fandom nao responder."""
    try:
        r = _get({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": "Summoning Technique"})
        txt = next(iter(r["query"]["pages"].values()))["revisions"][0]["slots"]["main"]["*"]
        lido = ler_template(txt)
        return montar(*lido) if lido else {}
    except Exception as erro:   # sem rede: so' pula esta etapa
        print(f"  (aviso) ficha da invocacao indisponivel: {erro}")
        return {}


async def main() -> None:
    """Simula (ou grava) caminho, mastery, ficha das invocacoes e publicacao."""
    ap = argparse.ArgumentParser(description="Classifica jutsus sem mastery/caminho e publica os com evidencia.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--publicar", action="store_true", help="publica as linhas da tabela com evidencia (e descricao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--sem-fandom", action="store_true", help="nao busca a ficha das invocacoes no Fandom")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}{' + publicar' if args.publicar else ''}")
    tabela = {normalizar(k): (k, *v) for k, v in TABELA.items()}
    ficha = {} if args.sem_fandom else ficha_invocacao()

    cont = {"caminho": 0, "mastery": 0, "ficha invocacao": 0, "publicados": 0}
    sem_desc, incertos, publicados = [], [], []
    async with AsyncSessionLocal() as db:
        for j in (await db.execute(select(Jutsu).order_by(Jutsu.name))).scalars().all():
            if j.is_npc:
                continue
            achado = tabela.get(normalizar(j.name))
            if achado:
                _, mastery, publicar, _ev = achado
                if mastery and not j.mastery_id:
                    cont["mastery"] += 1
                    if args.aplicar:
                        j.mastery_id = mastery
                if j.name in INVOCACOES and ficha:
                    mudou = False
                    for campo, valor in ficha.items():
                        if campo in ("mastery_id", "tier", "scroll_type") or valor in (None, "", []):
                            continue
                        if getattr(j, campo) in (None, "", [], 0) or (campo == "max_level" and j.max_level == 1 and not j.description):
                            mudou = True
                            if args.aplicar:
                                setattr(j, campo, valor)
                    cont["ficha invocacao"] += mudou
            # caminho pelo atributo exigido
            mapa = CAMINHO_POR_ATRIBUTO.get(j.mastery_id or (achado[1] if achado else None) or "")
            if mapa and not j.path_id:
                caminho = mapa.get(atributo_exigido(j.required_stat) or "")
                if caminho:
                    cont["caminho"] += 1
                    if args.aplicar:
                        j.path_id = caminho
            if achado and achado[2] and j.status == ContentStatus.DRAFT:
                if not (j.description or "").strip() and not (ficha.get("description") and j.name in INVOCACOES):
                    sem_desc.append(j.name)
                elif args.publicar:
                    cont["publicados"] += 1
                    publicados.append((j.name, achado[1] or "utility", achado[3]))
                    if args.aplicar:
                        j.status = ContentStatus.PUBLISHED
            elif achado and not achado[2] and j.status == ContentStatus.DRAFT:
                incertos.append(f"{j.name} -> {achado[1]} ({achado[3]})")
        if args.aplicar:
            await db.commit()

    print("\nResumo:", cont)
    if publicados:
        print("\nPublicados (nome | mastery | evidencia):")
        for n, m, e in publicados:
            print(f"  {n} | {m} | {e}")
    print(f"\nCom evidencia mas SEM descricao (rode importar_jutsus_atlas.py antes): {sem_desc}")
    print(f"\nIncertos (mastery sugerida so' pelo nome; continuam rascunho): {len(incertos)}")
    for i in incertos:
        print("  -", i)
    print("\nGravado." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
