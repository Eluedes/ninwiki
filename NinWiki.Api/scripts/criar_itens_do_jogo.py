"""
Cria, como RASCUNHO, os itens NOVOS do cliente do jogo (versao mais nova) que ainda nao tem pagina no wiki - e registra no banco de imagens os icones novos.

DE ONDE VEM: `ItemKeys` do English.json do cliente novo MENOS o do cliente antigo (so' o que entrou). A lista mistura nomes e descricoes, entao os textos
longos sao separados (descricao = frase com ponto/quebra de linha) e os itens de teste ("Ueda's Test Nameplate", "Luu PPD") ficam de fora. O nome em portugues
vem do `Entries` do Brazilian Portuguese.json (nome oficial); a descricao em portugues NAO e' criada (a traducao automatica preenche ao editar no painel).
A descricao em ingles vem do proprio cliente: "While equipped, shows a special designed "X"..." (chat bubbles / fundos) e uma tabela curta de descricoes soltas
(botas, tail, pal, vest...). Os textos do jogo trazem marcas <color=...>; aqui viram texto puro. Nao inventa stat nenhum (dano, nivel, requisito ficam vazios).

TIPO: Chat Bubbles, Profile Backgrounds/Name Plates, hairstyles, receitas e apitos = Items `general`; Combat Boots / Shinobi Slides = Shoe; Samurai Vest = Vest;
Pal / Devil Tail / Fairy Wings = Accessory; Kibakuken = categoria Weapons. Nivel fica 0 (so' Ring e Cast tem nivel).

ICONES: o cliente guarda os icones novos em graphics/items/2507-2538.znin, mas NAO diz qual item usa qual (isso mora no servidor). Os que foram identificados
olhando a imagem (ICONES abaixo: bolhas Scroll/Sakura/Cloudy/Bamboo/Lantern/Explosive Tag/Snowy, Kibakuken, as 6 cores de Slides, as 5 de Combat Boots e a Snake Pal)
sao ligados ao item; os ambiguos (outras bolhas, fundos/name plates, cabelo) so' entram no banco de imagens (sem ligar) para a equipe escolher no painel.
Cada icone vira duas imagens novas, `N_item` (sem fundo) e `N_fundo`, no mesmo padrao do sincronizar_imagens_atlas.py. So' ADICIONA: imagem que ja existe nunca e' trocada.
Ao gravar, lista os arquivos novos de uploads/ (para incluir no zip de imagens da producao).

RENOMES (o jogo renomeou, a pagina antiga seria duplicada): "Kuronami Cloak (Style 2)" -> "Kuronami Cloak 2" e o rascunho "Jugo Premium Hairstyle" -> "Fugo ...".
"Green Jacket/Pants/Shorts" viraram "Dark Green ..." mas as paginas antigas estao PUBLICADAS: aqui so' sao apontadas (nao cria duplicata nem renomeia sozinho).
Quem ja existe no wiki (mesmo nome, sem diferenciar maiusculas, em qualquer categoria) e' pulado. Nada e' publicado nem despublicado.

Por padrao e' SIMULACAO; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/criar_itens_do_jogo.py                 # simulacao
    python scripts/criar_itens_do_jogo.py --aplicar       # grava no banco local
    python scripts/criar_itens_do_jogo.py --aplicar --permitir-remoto
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

from sqlalchemy import select

from app.api.content_items import _DEFAULT_ICON_BY_CATEGORY
from app.core.slug import slugify
from app.api.uploads import UPLOAD_DIR
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.media_refs import media_url
from app.models.content import ContentItem
from app.models.enums import ContentCategory, ContentStatus, ItemType, Rarity
from app.models.media import MediaImage
from scripts._guarda_banco import exigir_banco_local
from scripts.sincronizar_imagens_atlas import ler_znin, metades, salvar_png

CLIENTE_NOVO = Path(r"E:\SteamLibrary\steamapps\common\Nin Online\data files")
CLIENTE_ANTIGO = Path(r"E:\Nin Online - Wiki\data files")
USUARIO = "Cliente do jogo"   # aparece em "enviado por" nas imagens criadas aqui
IGNORAR = {"Ueda's Test Nameplate", "Luu PPD"}   # itens de teste da equipe do jogo

# Icone do cliente (items/N.znin) -> categoria da imagem no banco de imagens. Todos os 32 novos entram no banco; so' os de ICONES sao ligados a um item.
CATEGORIA_ICONE = {**{i: "other" for i in range(2507, 2518)}, 2518: "weapon", **{i: "other" for i in range(2519, 2526)},
                   **{i: "gear" for i in range(2526, 2538)}, 2538: "hair_beard"}
# Nome do item -> icone, SO' dos identificados com seguranca olhando as imagens (cor/forma bate com o nome).
ICONES = {"Scroll Chat Bubble": 2510, "Sakura Chat Bubble": 2511, "Cloudy Chat Bubble": 2519, "Bamboo Chat Bubble": 2520, "Lantern Chat Bubble": 2521,
          "Explosive Tag Chat Bubble": 2522, "Snowy Chat Bubble": 2523, "Kibakuken": 2518, "Snake Pal": 2537,
          **{f"{cor} Shinobi Slides": 2526 + k for k, cor in enumerate(["Red", "Black", "Purple", "Blue", "Green", "Pink"])},
          **{f"{cor} Combat Boots": 2532 + k for k, cor in enumerate(["Red", "Black", "Purple", "Blue", "Green"])}}

# Descricoes soltas do cliente (nao ha ligacao item<->texto no arquivo; aqui esta' a ligacao feita pelo sentido do texto).
DESC_FRASE = {
    "Kibakuken": "One of the Seven Blades, capable of triggering explosive tags with each melee strike.\n<color=red>Requires PVP On.</color>",
    "Snake Pal": "A cunning and loyal snake who coils around your shoulder, always watching and ready to strike.",
    "Reinforced Bo Staff Recipe": "A crafting recipe that teaches you how to forge a reinforced Bo Staff with improved durability and strength.\n <color=blue>Requires 10 Carpentry.</color>",
    "Forsaken Samurai Vest": "A sinister Halloween samurai vest outfit blending protection with dishonor.\n<color=pink>Exclusive to Halloween Events.</color>",
    "Nightfall Heroine Outift": "Only wearable by female ninja. A cute Halloween superheroine outfit with a tight-fitting design and flowing cape!\n<color=pink>Exclusive to Halloween Events.</color>",
    "Red Devil Tail": "A cosmetic devil tail that are worn on your behind to look cute!",
    "Black Devil Tail": "A cosmetic devil tail that are worn on your behind to look cute!",
}
DESC_SUFIXO = {   # sufixo do nome -> descricao (todas as cores de um mesmo item dividem o texto)
    "Shinobi Slides": "Built for the modern shinobi, these open-toed slip-ons blend streetwear comfort with the freedom to move at a moment\u2019s notice.",
    "Combat Boots": "Reinforced boots designed for the modern shinobi, offering rugged protection and a firm foothold in even the toughest encounters.",
}
RENOMES = {"Kuronami Cloak (Style 2)": "Kuronami Cloak 2", "Jugo Premium Hairstyle": "Fugo Premium Hairstyle"}
RENOMES_PUBLICADOS = {"Green Jacket": "Dark Green Jacket", "Green Pants": "Dark Green Pants", "Green Shorts": "Dark Green Shorts"}   # so' avisa
SOBRE_MIM = re.compile(r'"(.+?)" design (chat bubble|profile background|background)')


def carregar(pasta: Path, arquivo: str) -> dict:
    """JSON de idioma do jogo."""
    return json.loads((pasta / "locales" / arquivo).read_text(encoding="utf-8-sig"))


def eh_nome(texto: str) -> bool:
    """True se a entrada de ItemKeys e' um NOME de item (e nao uma descricao: frase com ponto, quebra de linha, {marcador} ou muito longa)."""
    return texto not in IGNORAR and len(texto) <= 50 and not any(c in texto for c in ".\n{") and not texto.startswith("While")


def tipo_e_categoria(nome: str) -> tuple[ContentCategory, ItemType | None]:
    """Categoria e tipo do item pelas regras do projeto (so' o que da' para afirmar pelo nome)."""
    if nome == "Kibakuken":
        return ContentCategory.WEAPONS, None
    if nome.endswith(("Combat Boots", "Shinobi Slides")):
        return ContentCategory.ITEMS, ItemType.SHOE
    if nome.endswith("Samurai Vest"):
        return ContentCategory.ITEMS, ItemType.VEST
    if nome.endswith(("Pal", "Devil Tail", "Fairy Wings")):
        return ContentCategory.ITEMS, ItemType.ACCESSORY
    return ContentCategory.ITEMS, ItemType.GENERAL   # bolhas, fundos, hairstyles, receitas, apitos


def limpar(texto: str) -> str:
    """Tira as marcas <color=...> do texto do jogo."""
    return re.sub(r"</?color[^>]*>", "", texto).strip()


def doc(texto: str) -> str:
    """Campo rico (Tiptap) com um paragrafo por linha - o mesmo formato que o editor do painel grava."""
    paragrafos = [{"type": "paragraph", "content": [{"type": "text", "text": linha.strip()}]} for linha in texto.splitlines() if linha.strip()]
    return json.dumps({"type": "doc", "content": paragrafos}, ensure_ascii=False)


def descricao_de(nome: str, sobre_mim: dict[str, str]) -> str:
    """Descricao em ingles do item (texto do cliente, sem marcas) ou '' se o cliente nao trouxe."""
    if nome in DESC_FRASE:
        return limpar(DESC_FRASE[nome])
    for sufixo, texto in DESC_SUFIXO.items():
        if nome.endswith(sufixo):
            return texto
    chave = nome[: -len(" Chat Bubble")] if nome.endswith(" Chat Bubble") else nome.removesuffix(" Profile Background")
    return sobre_mim.get(chave.lower(), "")


async def main() -> None:
    """Simula (ou grava com --aplicar) os renomes, as imagens novas e os itens em rascunho."""
    ap = argparse.ArgumentParser(description="Cria como rascunho os itens novos do cliente do jogo e registra os icones novos.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--cliente-novo", default=str(CLIENTE_NOVO), help="pasta 'data files' do cliente novo (padrao: %(default)s)")
    ap.add_argument("--cliente-antigo", default=str(CLIENTE_ANTIGO), help="pasta 'data files' do cliente antigo (padrao: %(default)s)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)

    novo_dir, antigo_dir = Path(args.cliente_novo), Path(args.cliente_antigo)
    chaves = carregar(novo_dir, "English.json")["ItemKeys"]
    entrou = sorted(set(chaves) - set(carregar(antigo_dir, "English.json")["ItemKeys"]))
    pt = carregar(novo_dir, "Brazilian Portuguese.json").get("Entries", {})
    # '"X" design chat bubble' -> descricao de X (chave minuscula): serve a bolhas e a fundos
    sobre_mim = {m.group(1).lower(): limpar(t) for t in chaves if (m := SOBRE_MIM.search(t))}
    nomes = [n for n in entrou if eh_nome(n)]
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'} | entradas novas em ItemKeys: {len(entrou)} -> {len(nomes)} nomes de item")

    async with AsyncSessionLocal() as db:
        todos = (await db.execute(select(ContentItem))).scalars().all()
        por_nome = {c.name.lower(): c for c in todos}
        slugs = {c.slug for c in todos}

        # 1) renomes de paginas que o jogo renomeou (so' o nome; o endereco/slug nao muda)
        for antigo, novo in RENOMES.items():
            pagina = por_nome.get(antigo.lower())
            if pagina is None or novo.lower() in por_nome:
                continue
            print(f"RENOMEAR [{pagina.status.value}]: '{antigo}' -> '{novo}' (pt: {pt.get(novo) or pagina.name_pt})")
            if args.aplicar:
                pagina.name, pagina.name_pt = novo, pt.get(novo) or pagina.name_pt
            por_nome[novo.lower()] = pagina
        for antigo, novo in RENOMES_PUBLICADOS.items():
            if antigo.lower() in por_nome:
                print(f"AVISO: '{antigo}' (publicada) virou '{novo}' no jogo - renomeie no painel se quiser; nao foi criada pagina duplicada.")

        # 2) imagens: os 32 icones novos, so' os que o banco ainda nao tem (nome N_item)
        no_banco = {n for (n,) in (await db.execute(select(MediaImage.name).where(MediaImage.name.like("25%_item")))).all()}
        pasta_icones = novo_dir / "graphics" / "items"
        criar_img: list[tuple[int, str, object, object]] = []
        for icone, categoria in sorted(CATEGORIA_ICONE.items()):
            arquivo = pasta_icones / f"{icone}.znin"
            img = ler_znin(arquivo) if arquivo.is_file() and f"{icone}_item" not in no_banco else None
            if img is not None:
                criar_img.append((icone, categoria, *metades(img)))
        print(f"Icones novos para o banco de imagens: {len(criar_img)} de {len(CATEGORIA_ICONE)} ({2 * len(criar_img)} imagens: N_item + N_fundo)")

        # 3) itens novos
        ligar: dict[str, int] = {}   # nome do item -> icone (a url so' existe depois de gravar as imagens)
        itens: list[ContentItem] = []
        for nome in nomes:
            antigos = [a for a, n in RENOMES_PUBLICADOS.items() if n == nome]   # pagina antiga publicada: nao duplica
            if nome.lower() in por_nome or any(a.lower() in por_nome for a in antigos):
                continue
            categoria, tipo = tipo_e_categoria(nome)
            texto = descricao_de(nome, sobre_mim)
            base = slug = slugify(nome, fold_accents=False) or "item"
            k = 2
            while slug in slugs:
                slug, k = f"{base}-{k}", k + 1
            slugs.add(slug)
            traduzido = pt.get(nome)
            itens.append(ContentItem(slug=slug, category=categoria, name=nome, name_pt=traduzido if traduzido and traduzido != nome else None,
                                     icon=_DEFAULT_ICON_BY_CATEGORY.get(categoria.value, "\u2754"), rarity=Rarity.COMMON, description=doc(texto) if texto else "",
                                     status=ContentStatus.DRAFT, item_type=tipo, level=0))
            if nome in ICONES:
                ligar[nome] = ICONES[nome]
        print(f"\nItens novos (rascunho): {len(itens)}  | com icone ligado: {len(ligar)}  | com descricao do cliente: {sum(bool(i.description) for i in itens)}")
        for i in itens:
            print(f"   {i.category.value:<8} {(i.item_type.value if i.item_type else '-'):<10} {i.name:<38} {'icone ' + str(ligar[i.name]) if i.name in ligar else ''}")

        if not args.aplicar:
            print("\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")
            return
        gravados: list[str] = []   # PNGs criados agora: se o banco recusar, sao apagados (sem arquivo orfao)
        try:
            for icone, categoria, esquerda, direita in criar_img:
                for sufixo, parte in (("item", esquerda), ("fundo", direita)):
                    arquivo, w, h, tam = salvar_png(parte)
                    gravados.append(arquivo)
                    db.add(MediaImage(filename=arquivo, name=f"{icone}_{sufixo}", category=categoria, width=w, height=h, bytes=tam, uploaded_by=USUARIO))
            await db.flush()
            imagens = {n: f for n, f in (await db.execute(select(MediaImage.name, MediaImage.filename).where(MediaImage.name.like("25%_item")))).all()}
            for item in itens:
                if item.name in ligar and f"{ligar[item.name]}_item" in imagens:
                    item.image = media_url(imagens[f"{ligar[item.name]}_item"])
            db.add_all(itens)
            await db.commit()
        except Exception:
            await db.rollback()
            for arquivo in gravados:
                (UPLOAD_DIR / arquivo).unlink(missing_ok=True)
            raise
    print("\nGravado. Arquivos NOVOS em uploads/ (inclua no zip de imagens da producao):")
    for arquivo in gravados:
        print("  ", arquivo)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
