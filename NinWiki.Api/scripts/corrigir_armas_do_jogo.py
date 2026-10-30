"""
Corrige as ARMAS do wiki que ficaram para tras dos patches do jogo (posts da Steam v5.12 a v6.0.2.4 + textos do cliente novo) e preenche a velocidade de ataque.

SO' MEXE COM EVIDENCIA: cada correcao abaixo cita o post (ou o texto do cliente). Valor so' e' trocado se o campo ainda esta' com o valor ANTIGO conhecido (`de`);
se alguem ja' ajustou na mao (valor diferente do antigo e do novo), a linha e' pulada e avisada. Nunca despublica nada: o status nao e' tocado.
  - dano base / requisito: valores citados nos posts (Jakuma, Wooden Boomerang, Hisui Fans, Nitoryu Fan).
  - descricao: so' se o texto atual for IGUAL ao texto antigo do cliente (Jinbu Fans, Shinboku Pipe, Blood Iron Fan); o novo vem do English.json do cliente 6.0.2.4.
    O numero de dano que aparece na descricao de Jakuma/Boomerang acompanha o dano base.
  - weapon_speed (vazio em quase todas): SO' preenche vazio. Valor do post quando o post cita a arma (POSTS_VELOCIDADE); senao o `spd` do Nin Atlas (em ms).
    Velocidade ja preenchida (Bo Staff, Metal Knuckle Blades) nunca e' trocada.
NAO mexe em: bonus (+4% critico do Jinbu, +3 Int da Dark Steel Kunai Dagger), efeitos (snare, sem bleed) e receitas - o wiki nao tem campo para eles.

Por padrao e' SIMULACAO (tabela antes -> depois com a citacao); grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/corrigir_armas_do_jogo.py                 # simulacao
    python scripts/corrigir_armas_do_jogo.py --aplicar       # grava no banco local
    python scripts/corrigir_armas_do_jogo.py --aplicar --permitir-remoto
Opcao: --atlas arquivo.js (usa uma copia local do atlas.js em vez de baixar).
"""
import argparse
import asyncio
import json
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.enums import ContentCategory
from scripts._guarda_banco import exigir_banco_local
from scripts.sincronizar_imagens_atlas import carregar_atlas

# (arma, campo, valor antigo esperado, valor novo, citacao)
CORRECOES = [
    ("Jakuma", "weapon_base_damage", "52", "50", 'post v6.0.2.4 (29/10/2026): "Jakuma: Base damage reduced to 50"'),
    ("Wooden Boomerang", "weapon_base_damage", "28", "40", 'post v6.0.2.4: "Wooden Boomerang: Base damage adjusted to 40."'),
    ("Hisui Fans", "weapon_requirement", "60 Strength", "60 Strength\n25 Intellect",
     'post v6.0.2.4: "Hisui Fans: Stat requirement changed from 20 Agility to 25 Intellect." (a Strength 60 vem do post v5.12.5: "changed from 70 to 60")'),
    ("Nitoryu Fan", "weapon_requirement", "95 Strength", "100 Strength", 'post v6.0.2.4: "Nitoryu Fan: Stat requirement changed to 100 Strenght"'),
]
# (arma, texto antigo do cliente 6.0.1.7, texto novo do cliente 6.0.2.4); {itemDamage} = dano base da pagina
DESCRICOES = [
    ("Jinbu Fans", "A fan made using feathers from the wings of a demon. Attacks twice and deals {itemDamage} damage per hit and applies bleeding.",
     "A fan made using feathers from the wings of a demon capable piercing throught an enemy and snaring them. Shoots two projectiles, dealing {itemDamage} damage each.",
     'English.json 6.0.2.4 + post v6.0.2.4: "Jinbu Fans: Bleeding effect removed. / Attacks now apply Snare."'),
    ("Shinboku Pipe", "This bamboo  pipe can be used to perform bubble-smoke ninjutsu. Crafted from sturdy bamboo and reinforced with polished Oni horns, it fires a bubble projectile that applies burn.",
     "This bamboo  pipe can be used to perform bubble-smoke ninjutsu. Crafted from sturdy bamboo and reinforced with polished Oni horns, it can create explosive bubbles.",
     'English.json 6.0.2.4 + post v6.0.2.4: "Shinboku Pipe: Bubbles are no longer projectiles. / Bubbles now explode."'),
    ("Blood Iron Fan", "Made of Iron and blood colored fabric. Shoots a wind projectile with 8 range that deals {itemDamage} base damage, able to snare enemies with wind for 0.5 second.",
     "Made of Iron and blood colored fabric. Shoots a wind projectile with 8 range that deals {itemDamage} base damage, able to snare enemies with wind.",
     "English.json 6.0.2.4 (texto novo do item)"),
]
# arma -> (velocidade em segundos, citacao). Vence o Atlas (que ainda traz o valor antigo em varias).
POSTS_VELOCIDADE = {
    "Jakuma": ("1.3", 'post v6.0.2.4: "Jakuma: Attack speed changed to 1.3"'),
    "Shinboku Pipe": ("2.8", 'post v6.0.2.4: "Shinboku Pipe: Attack speed adjusted to 2.8s"'),
    "Adamantine Staff": ("2.1", 'post v6.0.2.4: "Adamantine Staff: Attack speed changed to 2.1."'),
    "Reinforced Bo Staff": ("2.2", 'post v6.0.2.4: "Reinforced Bo Staff: Attack speed changed to 2.2."'),
    "Hisui Fans": ("2.1", 'post v5.12.5: "Hisui Fans attack speed reverted back to 2.1s from 2.4s"'),
    "Dark Steel Kunai Dagger": ("1.1", 'post v5.13.6.4: "Dark Steel Kunai Dagger attack speed adjusted from 1.2 to 1.1"'),
    "Poison Kunai Dagger": ("1.4", 'post v5.13.5: "Poison Kunai Dagger attack speed increased from 1.2s to 1.4s"'),
    "Wooden Knuckle Blades": ("0.8", 'post v5.13.0: "Wooden Knuckle Blades attack speed decreased from 0.7s to 0.8s"'),
    "Blood Knuckle Blades": ("0.7", 'post v5.13.0: "Blood Knuckle Blades attack speed decreased from 0.6s to 0.7s"'),
    "Metal Tonfa": ("1", 'post v5.13.0: "Metal Tonfa attack speed decreased from 0.9s to 1s"'),
    "Wooden Tonfa": ("1", 'post v5.13.0: "Wooden Tonfa attack speed decreased from 0.9s to 1s"'),
    "Blood Tonfa": ("1.1", 'post v5.13.0: "Blood Tonfa attack speed decreased from 0.9s to 1.1s"'),
}


def texto_do_doc(valor: str | None) -> str:
    """Texto puro do campo rico (JSON do Tiptap): junta os textos de todos os nos."""
    try:
        doc = json.loads(valor or "")
    except ValueError:
        return (valor or "").strip()
    partes: list[str] = []

    def andar(no) -> None:
        if isinstance(no, dict):
            if isinstance(no.get("text"), str):
                partes.append(no["text"])
            for filho in no.get("content") or []:
                andar(filho)
    andar(doc)
    return "".join(partes).strip()


def doc_simples(texto: str) -> str:
    """Campo rico com um paragrafo so' (o mesmo formato que o editor do painel grava)."""
    return json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": texto}]}]}, ensure_ascii=False)


async def main() -> None:
    """Simula (ou grava com --aplicar) as correcoes de armas."""
    ap = argparse.ArgumentParser(description="Corrige armas que divergem dos patches do jogo e preenche a velocidade de ataque.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    spd_atlas = {i["name"].lower(): i["spd"] for i in atlas["items"].values() if atlas["itemTypes"].get(str(i["type"])) == "Weapon" and i.get("spd")}
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        armas = {c.name.lower(): c for c in (await db.execute(select(ContentItem).where(ContentItem.category == ContentCategory.WEAPONS))).scalars().all()}
        linhas: list[tuple[str, str, str, str, str]] = []   # arma, campo, antes, depois, citacao
        pulos: list[str] = []

        def mudar(arma: ContentItem, campo: str, depois: str, citacao: str) -> None:
            """Registra (e, com --aplicar, faz) a troca de um campo."""
            antes = getattr(arma, campo)
            linhas.append((arma.name, campo, (antes or "").replace("\n", " / ") or "(vazio)", depois.replace("\n", " / "), citacao))
            if args.aplicar:
                setattr(arma, campo, depois)

        for nome, campo, de, para, citacao in CORRECOES:
            arma = armas.get(nome.lower())
            if arma is None:
                pulos.append(f"{nome}: nao existe no wiki")
                continue
            atual = (getattr(arma, campo) or "").strip()
            if atual == para:
                continue
            if atual != de:
                pulos.append(f"{nome}.{campo}: esta' '{atual}' (esperado '{de}') - mexido na mao, ignorado")
                continue
            mudar(arma, campo, para, citacao)
            # o dano tambem aparece escrito na descricao ("deals 52 damage"): acompanha o dano base
            if campo == "weapon_base_damage":
                bruto = arma.description or ""
                for trecho in (f"{de} damage", f"{de} base damage"):
                    if bruto.count(trecho) == 1:
                        linhas.append((arma.name, "description", f"...{trecho}...", f"...{trecho.replace(de, para)}...", "acompanha o dano base"))
                        if args.aplicar:
                            arma.description = bruto.replace(trecho, trecho.replace(de, para))
                        break

        for nome, velho, novo, citacao in DESCRICOES:
            arma = armas.get(nome.lower())
            if arma is None:
                pulos.append(f"{nome}: nao existe no wiki")
                continue
            dano = arma.weapon_base_damage or ""
            if texto_do_doc(arma.description) == novo.replace("{itemDamage}", dano):
                continue
            if texto_do_doc(arma.description) != velho.replace("{itemDamage}", dano):
                pulos.append(f"{nome}.description: texto diferente do antigo do cliente - editado na mao, ignorado")
                continue
            mudar(arma, "description", doc_simples(novo.replace("{itemDamage}", dano)), citacao)
            linhas[-1] = (*linhas[-1][:2], "(texto antigo do cliente)", novo.replace("{itemDamage}", dano)[:70] + "...", citacao)

        for chave, arma in sorted(armas.items()):   # velocidade: so' preenche vazio
            if (arma.weapon_speed or "").strip():
                continue
            if arma.name in POSTS_VELOCIDADE:
                valor, citacao = POSTS_VELOCIDADE[arma.name]
            elif chave in spd_atlas:
                valor, citacao = f"{spd_atlas[chave] / 1000:g}", f"Nin Atlas: spd={spd_atlas[chave]} ms"
            else:
                pulos.append(f"{arma.name}: sem velocidade nos posts nem no Atlas - fica vazio")
                continue
            mudar(arma, "weapon_speed", valor, citacao)

        print(f"\n{'ARMA':<26}{'CAMPO':<20}{'ANTES':<42}{'DEPOIS':<42}CITACAO")
        for a, c, antes, depois, cit in linhas:
            print(f"{a:<26}{c:<20}{antes[:40]:<42}{depois[:40]:<42}{cit}")
        print(f"\n{len(linhas)} alteracoes em {len({l[0] for l in linhas})} armas.")
        for p in pulos:
            print("  AVISO:", p)
        if args.aplicar:
            await db.commit()
    print("\nGravado." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
