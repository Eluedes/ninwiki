"""
Corrige DADOS que aparecem em PORTUGUES no site em INGLES: textos em portugues que estavam no campo PRINCIPAL (o ingles) de Attributes, Villages, Ninja Ranks, Organizations, Clans,
Story Arcs, Summons, uma Mastery (+ caminhos) e alguns campos de Jutsu (effect / range / cast_time).

Regra (traducao escrita a mao na tabela abaixo; nada de DeepL, nenhuma chamada de rede):
  - tabela COM campo `_pt` e `_pt` vazio: o texto portugues atual vai para `_pt` e o campo principal recebe o INGLES;
  - tabela COM campo `_pt` ja' preenchido: so' o campo principal e' trocado pelo ingles (o `_pt` fica como esta');
  - campo SEM `_pt` (Organization/StoryArc description, Village element, Jutsu effect/range/cast_time): so' o ingles e' gravado - o portugues SE PERDE, por isso o
    relatorio lista cada texto sobrescrito (guarde a saida e/ou restaure o backup `envio/antes_idioma_dados.dump`).

SO' MEXE COM CERTEZA: antes de trocar, confere que o texto atual e' exatamente o portugues esperado da tabela; se divergir (alguem editou, ou o banco e' outro, como na producao),
a linha e' PULADA com aviso. Se o campo ja' esta' com o ingles novo, diz "ja aplicado". Pode rodar quantas vezes quiser (idempotente). Nao cria migracao nem mexe em outras tabelas.

Por padrao e' SIMULACAO (antes -> depois). Grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes: pg_dump -Fc).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/corrigir_idioma_dados.py                 # simulacao
    python scripts/corrigir_idioma_dados.py --aplicar       # grava no banco local
    python scripts/corrigir_idioma_dados.py --aplicar --permitir-remoto
"""
import argparse
import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.guide import NinjaRank, StoryArc, Summon
from app.models.masteries import Attribute, Jutsu, Mastery, MasteryPath
from app.models.villages import Clan, Organization, Village
from scripts._guarda_banco import exigir_banco_local

# (Modelo, id, campo, portugues esperado hoje, ingles novo). O campo `<campo>_pt` e' usado quando existir no modelo.
LINHAS = [
    (Attribute, "agility", "description", "Escala o caminho padrão de Taijutsu.", "Scales the default Taijutsu path."),
    (Attribute, "chakra", "description", "No caminho de suporte Médico, mais Chakra aumenta o dano e a cura.",
     "On the Medical support path, more Chakra increases damage and healing."),
    (Attribute, "fortitude", "description", "Aumenta a vida máxima e a resistência a dano.", "Increases maximum health and damage resistance."),
    (Attribute, "intellect", "description", "Aumenta o dano de jutsus elementais, o dano mágico Médico e os arremessos de Arma à distância.",
     "Increases elemental jutsu damage, Medical magic damage and ranged Weapon throws."),

    (Village, "mist", "element", "Água", "Water"),
    (Village, "mist", "motto", "Sob a névoa, o silêncio mata", "In the mist, silence kills"),
    (Village, "mist", "description", "Uma vila insular envolta em névoa perpétua. Conhecida por seus shinobis implacáveis e pelo antigo regime de graduação sangrento.",
     "An island village shrouded in perpetual mist. Known for its ruthless shinobi and its former bloody graduation system."),
    (Village, "mist", "long_description",
     "A Vila Oculta da Névoa (Kirigakure) ergue-se nas ilhas do País da Água, permanentemente coberta por uma névoa espessa. No passado, era chamada de \"Vila da Névoa Sangrenta\" devido ao seu brutal exame de graduação. Hoje, sob nova liderança, busca reconstrução e redenção, mas mantém a reputação de formar os shinobis mais letais do mundo.",
     "The Hidden Mist Village (Kirigakure) rises on the islands of the Land of Water, permanently covered by a thick mist. In the past it was called the \"Village of the Bloody Mist\" because of its brutal graduation exam. Today, under new leadership, it seeks reconstruction and redemption, but it keeps its reputation for training the deadliest shinobi in the world."),
    (Village, "mist", "climate", "Úmido, ilhas nebulosas", "Humid, misty islands"),
    (Village, "sand", "motto", "O deserto não perdoa os fracos", "The desert does not forgive the weak"),
    (Village, "sand", "description", "Situada no coração do País do Vento, esta vila prospera em um ambiente hostil. Seus shinobis dominam o vento e a areia.",
     "Located in the heart of the Land of Wind, this village thrives in a hostile environment. Its shinobi master the wind and the sand."),
    (Village, "sand", "long_description",
     "A Vila Oculta da Areia (Sunagakure) localiza-se no vasto deserto do País do Vento. A sobrevivência em um ambiente tão inóspito forjou shinobis resilientes e estrategistas astutos. A vila é conhecida por seus manipuladores de areia e vento, e por uma aliança histórica com a Vila da Folha. Seu Kage comanda com sabedoria, equilibrando diplomacia e força militar.",
     "The Hidden Sand Village (Sunagakure) lies in the vast desert of the Land of Wind. Surviving in such an inhospitable environment forged resilient shinobi and cunning strategists. The village is known for its sand and wind manipulators, and for a historic alliance with the Leaf Village. Its Kage rules with wisdom, balancing diplomacy and military strength."),
    (Village, "sand", "climate", "Desértico, seco e quente", "Desert, dry and hot"),

    (NinjaRank, "academy-student", "description",
     "Ainda não é considerado parte das forças ninja. Compõe o corpo estudantil da Academia, onde aprende as técnicas básicas e o funcionamento do mundo shinobi.",
     "Not yet considered part of the ninja forces. Makes up the Academy's student body, where they learn the basic techniques and how the shinobi world works."),
    (NinjaRank, "genin", "description", "Primeiro rank ao se formar na Academia e ingressar nas forças ninja regulares da vila.",
     "First rank after graduating from the Academy and joining the village's regular ninja forces."),
    (NinjaRank, "chunin", "description", "Rank intermediário. Chunin e acima podem hospedar missões de RP (interpretação de papel).",
     "Intermediate rank. Chunin and above can host RP (roleplay) missions."),
    (NinjaRank, "jonin", "description", "Rank avançado, com autoridade considerável dentro da vila.", "Advanced rank, with considerable authority within the village."),
    (NinjaRank, "kage", "description", "O ninja mais talentoso da vila, e seu líder. Topo da hierarquia normal de ranks.",
     "The village's most talented ninja, and its leader. Top of the normal rank hierarchy."),

    (Organization, "hunter-nin", "description", "Especializados em caçar shinobis desertores e proteger os segredos da vila, evitando que técnicas caiam em mãos inimigas.",
     "Specialized in hunting down deserter shinobi and protecting the village's secrets, keeping techniques from falling into enemy hands."),
    (Organization, "sand-assassins", "description", "Corporação de especialistas em assassinato exclusiva da Vila da Areia.",
     "A corps of assassination specialists exclusive to the Sand Village."),

    (StoryArc, "kinsen-arc", "description", "Arco de progressão inicial, referenciado nos guias oficiais de leveling como marco pra continuar farmando mobs de nível 15 a 25.",
     "Early progression arc, referenced in the official leveling guides as the milestone to keep farming level 15 to 25 mobs."),
    (StoryArc, "land-of-spirits", "description",
     "Arco mais recente. Level cap elevado a 70, com Jutsu Avançado liberado para cada mastery e um reino espiritual corrompido para restaurar, guiado pela Lady Kitsune.",
     "Most recent arc. Level cap raised to 70, with Advanced Jutsu unlocked for each mastery and a corrupted spirit realm to restore, guided by Lady Kitsune."),

    (Summon, "monkey", "stage_young", "Filhote ágil", "Agile cub"),
    (Summon, "slug", "stage_adult", "Lesma adulta, cura em área", "Adult slug, area healing"),
    (Summon, "toad", "stage_teen", "Sapo de combate médio", "Medium-sized battle toad"),

    (Mastery, "medical", "long_description",
     "Mastery Médica has a magic damage track that scales with Intellect and a damage and support track. Support healing scales with Chakra.",
     "The Medical Mastery has a magic damage path that scales with Intellect and a damage and support path. Support healing scales with Chakra."),
    (Clan, "yagyu", "name", "Clã Yagyu", "Clan Yagyu"),
    (Clan, "yagyu", "description", "Começou como sobreviventes de guerra e se tornou uma família de senhores feudais, com riqueza suficiente para treinar shinobis poderosos rapidamente.",
     "Began as war survivors and became a family of feudal lords, wealthy enough to train powerful shinobi quickly."),
    (Clan, "hayashi", "name", "Clã Hayashi", "Clan Hayashi"),
    (Clan, "hayashi", "description", "Um dos clãs oferecidos na criação de personagem da Vila da Areia.",
     "One of the clans offered during character creation for the Village of the Sand."),

    # Caminhos de mastery (MasteryPath nao tem campo _pt: o portugues se perde, fica listado no relatorio)
    (MasteryPath, "medical-chakra", "description", "Quanto mais Chakra, maior o dano e a cura. O foco deste caminho é suporte.", "The more Chakra, the greater the damage and healing. This path focuses on support."),
    (MasteryPath, "medical-intellect", "description", "Caminho de dano mágico escalado com Intelecto.", "Magic damage path scaled by Intellect."),
    (MasteryPath, "taijutsu-agility", "description", "Caminho padrão escalado com Agilidade.", "Default path scaled by Agility."),
    (MasteryPath, "taijutsu-strength", "description", "Caminho de Força.", "Strength path."),
    (MasteryPath, "taijutsu-strength", "requirement", "Requer ativação de Punho Gentil GF.", "Requires Gentle Fist activation."),
    (MasteryPath, "water-elemental", "description", "Caminho elemental sem arma.", "Elemental path without a weapon."),
    (MasteryPath, "water-pipe", "description", "Caminho de arma Pipe-Cachimbo.", "Pipe weapon path."),
    (MasteryPath, "weapon-intellect", "description", "Caminho de armas arremessadas e alcance.", "Path of thrown weapons and range."),
    (MasteryPath, "weapon-strength", "description", "Caminho de armas corpo a corpo.", "Melee weapons path."),
    (MasteryPath, "wind-elemental", "description", "Caminho elemental sem arma.", "Elemental path without a weapon."),
    (MasteryPath, "wind-fan", "description", "Caminho de arma Fan-Leque.", "Fan weapon path."),
]

# Jutsus: troca por VALOR exato em todos os jutsus (campo -> {portugues: ingles}). Esses 3 campos nao tem `_pt`.
JUTSU_VALORES = {
    "effect": {
        "Dano perfurante massivo": "Massive piercing damage", "Bloqueio de ataques": "Blocks attacks",
        "Dano físico massivo + auto-dano": "Massive physical damage + self-damage", "Dano + atordoamento curto": "Damage + short stun",
        "Dano em cone + repulsao": "Cone damage + knockback", "Imobilizacao parcial + dano": "Partial immobilization + damage",
        "Dano de corte critico": "Critical slashing damage", "Dano + derrubada": "Damage + knockdown", "Cura ao longo do tempo": "Healing over time",
        "Multiplos hits de dano fisico": "Multiple physical damage hits", "Cura massiva instantanea": "Massive instant healing",
        "Dano + deslocamento do alvo": "Damage + target displacement", "Dano de corte": "Slashing damage",
    },
    "range": {
        "Corpo a corpo": "Melee", "Curto (proximo ao usuario)": "Short (close to the user)", "Curto": "Short", "Médio (8m)": "Medium (8m)",
        "Médio (5-12m)": "Medium (5-12m)", "Médio (5-10m)": "Medium (5-10m)", "Longo (10-15m)": "Long (10-15m)",
    },
    "cast_time": {"Instantâneo": "Instant", "1 selo": "1 hand seal", "2 selos": "2 hand seals", "3 selos": "3 hand seals"},
}


async def main() -> None:
    """Percorre a tabela, mostra antes -> depois e (com --aplicar) grava."""
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra banco que nao e' local (faca backup antes)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    perdidos: list[str] = []   # portugues sobrescrito sem `_pt` para guardar
    contagem = {"mudou": 0, "ja": 0, "pulou": 0}

    def trocar(rotulo: str, obj, campo: str, esperado: str, novo: str) -> None:
        """Faz (ou simula) a troca de um campo, respeitando a regra do `_pt`."""
        atual = getattr(obj, campo)
        if atual == novo:
            contagem["ja"] += 1
            return
        if atual != esperado:
            contagem["pulou"] += 1
            print(f"  PULOU {rotulo}.{campo}: texto atual diferente do esperado ({(atual or '')[:60]!r})")
            return
        campo_pt = f"{campo}_pt"
        tem_pt = hasattr(obj, campo_pt)
        if tem_pt and not (getattr(obj, campo_pt) or "").strip():
            print(f"  {rotulo}.{campo}: {atual[:70]!r} -> {novo[:70]!r}  (PT movido para {campo_pt})")
            if args.aplicar:
                setattr(obj, campo_pt, atual)
        elif tem_pt:
            print(f"  {rotulo}.{campo}: {atual[:70]!r} -> {novo[:70]!r}  ({campo_pt} ja' preenchido, mantido)")
        else:
            print(f"  {rotulo}.{campo}: {atual[:70]!r} -> {novo[:70]!r}  (SEM _pt: portugues perdido)")
            perdidos.append(f"{rotulo}.{campo} = {atual!r}")
        if args.aplicar:
            setattr(obj, campo, novo)
        contagem["mudou"] += 1

    async with AsyncSessionLocal() as db:
        for modelo, id_, campo, esperado, novo in LINHAS:
            obj = await db.get(modelo, id_)
            rotulo = f"{modelo.__name__}[{id_}]"
            if obj is None:
                contagem["pulou"] += 1
                print(f"  PULOU {rotulo}: nao existe neste banco")
                continue
            trocar(rotulo, obj, campo, esperado, novo)
        for j in (await db.execute(select(Jutsu))).scalars().all():
            for campo, mapa in JUTSU_VALORES.items():
                valor = getattr(j, campo)
                if valor in mapa:
                    trocar(f"Jutsu[{j.id}]", j, campo, valor, mapa[valor])
        if args.aplicar:
            await db.commit()

    print(f"\nResumo: {contagem['mudou']} troca(s), {contagem['ja']} ja aplicada(s), {contagem['pulou']} pulada(s). {'GRAVADO.' if args.aplicar else 'Nada foi gravado (use --aplicar).'}")
    if perdidos:
        print("\nPortugues SOBRESCRITO em campos sem `_pt` (para reverter pelo backup ou na mao):")
        for p in perdidos:
            print("  -", p)


if __name__ == "__main__":
    asyncio.run(main())
