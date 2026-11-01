"""
Cria o post de APRESENTACAO do Nin Codex no blog ("Welcome to Nin Codex"): o que e' o wiki, as ferramentas, os torneios, o bot e como ajudar.
Texto em ingles (principal) e em portugues, o "por/by" e' "Nin Codex Team" (campo author_label) e a capa e' a imagem de compartilhamento do site.

  - Cria como RASCUNHO (revise o texto e publique no painel: Blog Posts > abrir o post > Publicar). Com --publicar ele ja' entra no ar.
  - NAO sobrescreve: se o post (slug `welcome-to-nin-codex`) ja' existe, so' avisa. Pode rodar quantas vezes quiser.
  - Por padrao e' SIMULACAO (mostra o que faria). Grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto
    (faca um backup antes: pg_dump -Fc). Liga so' as tags que ja' existem no banco (Guide e New).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/criar_post_apresentacao.py                         # simulacao
    python scripts/criar_post_apresentacao.py --aplicar               # cria o rascunho no banco local
    python scripts/criar_post_apresentacao.py --aplicar --publicar    # ja' publica
    python scripts/criar_post_apresentacao.py --aplicar --permitir-remoto   # producao (DATABASE_URL de producao)
"""
import argparse
import asyncio
import json
import re
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.enums import ContentStatus
from app.models.posts import Post, Tag
from scripts._guarda_banco import exigir_banco_local

SLUG = "welcome-to-nin-codex"
AUTOR = "Nin Codex Team"
CAPA = "/images/logo/og-nin-codex.png"
TAGS = ("guide", "new")

_INLINE = re.compile(r"(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))")


def _inline(texto: str) -> list[dict]:
    """Texto com **negrito** e [rotulo](/rota) -> nos de texto do Tiptap (negrito e link)."""
    nos: list[dict] = []
    for parte in _INLINE.split(texto):
        if not parte:
            continue
        if parte.startswith("**"):
            nos.append({"type": "text", "text": parte[2:-2], "marks": [{"type": "bold"}]})
        elif parte.startswith("["):
            rotulo, href = re.match(r"\[([^\]]+)\]\(([^)]+)\)", parte).groups()
            nos.append({"type": "text", "text": rotulo, "marks": [{"type": "link", "attrs": {"href": href}}]})
        else:
            nos.append({"type": "text", "text": parte})
    return nos


def _p(texto: str) -> dict:
    """Paragrafo."""
    return {"type": "paragraph", "content": _inline(texto)}


def _h(texto: str) -> dict:
    """Titulo de secao (nivel 2)."""
    return {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": texto}]}


def _ul(itens: list[str]) -> dict:
    """Lista com marcadores."""
    return {"type": "bulletList", "content": [{"type": "listItem", "content": [_p(i)]} for i in itens]}


def _doc(*blocos: dict) -> str:
    """Documento Tiptap (JSON em texto)."""
    return json.dumps({"type": "doc", "content": list(blocos)}, ensure_ascii=False)


EN = {
    "title": "Welcome to Nin Codex: everything the wiki can do",
    "excerpt": "Nin Codex is a fan-made encyclopedia for Nin Online: items, mobs, jutsus, crafting, a world map, tournaments and a Discord bot. Here is a quick tour of what you can use today.",
    "meta_title": "Welcome to Nin Codex - the Nin Online encyclopedia",
    "meta_description": "A tour of Nin Codex: the wiki, the world map, crafting recipes, player profiles, tournaments and the Discord bot for Nin Online.",
    "content": _doc(
        _p("**Nin Codex** is a community-made encyclopedia for **Nin Online**. It started as a place to keep everything about the game in one spot, and it keeps growing with the help of the players. This post is a tour of what you can already use."),
        _h("The wiki"),
        _ul([
            "**Items and weapons:** stats, rarity, where they drop and, for crafted gear, a **Crafted** badge that takes you to the recipe in its profession page. Browse [items](/catalog/items) and [weapons](/catalog/weapons).",
            "**Bestiary:** every [mob](/catalog/mobs) with level, damage, XP and respawn, plus the places where it **spawns**. Each place links straight to the [world map](/map).",
            "**Jutsus and masteries:** the full list of [masteries](/masteries) and [jutsus](/jutsus), with the details we have verified in game.",
            "**Missions, guides and professions:** [missions](/missions), [guides](/guide) grouped by topic (start here, combat and PvP, progression, interface, money) and the [professions](/proficiencies) with every crafting recipe, level and ingredient.",
            "**Villages and ninja ranks:** the [villages](/village) of the game and the rank ladder, from Academy Student up to Kami.",
        ]),
        _p("Everything is available in **English and Portuguese**: use the language switch at the top of the page."),
        _h("The world map"),
        _p("The [world map](/map) shows the areas of the game, with zones, hospitals, mission givers, bosses and more. Open it from any mob page to jump to the exact spot where it appears."),
        _h("Tools"),
        _ul([
            "**Search:** find anything on the wiki by name, in English or Portuguese.",
            "**Compare:** put two items, weapons, mobs or jutsus side by side on the [compare page](/compare).",
            "**Recipes:** every item that can be crafted shows its profession, level, bench requirement and ingredients.",
        ]),
        _h("Profiles and tournaments"),
        _p("Sign in with **Discord** to get your own player profile: your in-game name, your village and rank (filled in automatically from your roles on the Discord servers where our bot is), and your tournament history."),
        _p("Anyone signed in can create and run a [tournament](/tournaments), Challonge style but made for Nin Online:"),
        _ul([
            "Each stage can be **1v1, 2v2, 3v3 or custom**, so a Chunin exam can start in teams and end in duels.",
            "Single elimination and round robin, with the bracket drawn on the page and a **podium** at the end.",
            "Import your list of players in one paste and keep the tournament hidden until the stages are ready.",
        ]),
        _h("The Discord bot"),
        _p("The Nin Codex bot brings the wiki into your server, in your server's language:"),
        _ul([
            "**/search** finds anything on the wiki; **/item**, **/mob**, **/jutsu** and **/mastery** look up one thing by name.",
            "**/drop** shows who drops an item and how likely; **/recipe** shows how to craft it.",
            "**/compare** puts two things side by side and **/patchnotes** shows the latest news.",
            "**/language** switches the server between English and Portuguese.",
        ]),
        _p("You will find the invite button on the home page. It only asks for the essentials and never for administrator."),
        _h("News and patch notes"),
        _p("The [blog](/blog) gathers our own posts and the game's patch notes, which are imported automatically and marked with the developer's logo."),
        _h("Help us grow"),
        _p("Nin Codex is built by players. Found a mistake? Use the report button on the page. Want to help with translation, wiki editing or collecting data? Check the [volunteer page](/volunteer) when applications are open."),
        _p("Thanks for reading, and see you in game!"),
    ),
}

PT = {
    "title": "Bem-vindo ao Nin Codex: tudo o que o wiki faz",
    "excerpt": "O Nin Codex é uma enciclopédia feita por fãs do Nin Online: itens, mobs, jutsus, crafting, mapa-múndi, torneios e um bot de Discord. Veja um passeio rápido pelo que você já pode usar.",
    "content": _doc(
        _p("O **Nin Codex** é uma enciclopédia feita pela comunidade do **Nin Online**. Ele nasceu para reunir tudo sobre o jogo em um só lugar e continua crescendo com a ajuda dos jogadores. Este post é um passeio pelo que você já pode usar."),
        _h("O wiki"),
        _ul([
            "**Itens e armas:** atributos, raridade, onde dropam e, para equipamentos feitos por craft, um selo **Feito por craft** que leva à receita na página da profissão. Veja os [itens](/catalog/items) e as [armas](/catalog/weapons).",
            "**Bestiário:** todos os [mobs](/catalog/mobs) com nível, dano, XP e respawn, além dos lugares onde eles **aparecem**. Cada lugar leva direto ao [mapa-múndi](/map).",
            "**Jutsus e maestrias:** a lista completa de [maestrias](/masteries) e de [jutsus](/jutsus), com os detalhes que conferimos no jogo.",
            "**Missões, guias e profissões:** as [missões](/missions), os [guias](/guide) separados por tópico (comece por aqui, combate e PvP, progressão, interface, dinheiro) e as [profissões](/proficiencies) com todas as receitas de criação, nível e ingredientes.",
            "**Vilas e ranks ninja:** as [vilas](/village) do jogo e a escada de ranks, de Estudante da Academia até Kami.",
        ]),
        _p("Tudo está disponível em **inglês e português**: use o seletor de idioma no topo da página."),
        _h("O mapa-múndi"),
        _p("O [mapa-múndi](/map) mostra as áreas do jogo, com zonas, hospitais, quem dá missões, chefes e mais. Abra-o pela página de qualquer mob para ir direto ao ponto onde ele aparece."),
        _h("Ferramentas"),
        _ul([
            "**Busca:** encontre qualquer coisa do wiki pelo nome, em inglês ou português.",
            "**Comparar:** coloque dois itens, armas, mobs ou jutsus lado a lado na [página de comparação](/compare).",
            "**Receitas:** todo item que pode ser feito por craft mostra a profissão, o nível, se precisa de bancada e os ingredientes.",
        ]),
        _h("Perfis e torneios"),
        _p("Entre com o **Discord** para ter o seu perfil de jogador: seu nome no jogo, sua vila e seu rank (preenchidos sozinhos pelos seus cargos nos servidores do Discord onde o nosso bot está) e o seu histórico de torneios."),
        _p("Qualquer pessoa logada pode criar e organizar um [torneio](/tournaments), no estilo Challonge, mas feito para o Nin Online:"),
        _ul([
            "Cada fase pode ser **1v1, 2v2, 3v3 ou personalizada**: um exame Chunin pode começar em equipes e terminar em duelos.",
            "Eliminatória simples e todos contra todos, com a chave desenhada na página e um **pódio** no fim.",
            "Importe a lista de jogadores de uma vez e deixe o torneio oculto até as fases estarem prontas.",
        ]),
        _h("O bot do Discord"),
        _p("O bot do Nin Codex leva o wiki para o seu servidor, no idioma do servidor:"),
        _ul([
            "**/search** acha qualquer coisa do wiki; **/item**, **/mob**, **/jutsu** e **/mastery** consultam uma coisa pelo nome.",
            "**/drop** mostra quem dropa um item e com que chance; **/recipe** mostra como fazê-lo.",
            "**/compare** coloca duas coisas lado a lado e **/patchnotes** mostra as últimas notícias.",
            "**/language** troca o servidor entre inglês e português.",
        ]),
        _p("O botão de convite está na página inicial. Ele pede só o essencial e nunca pede administrador."),
        _h("Notícias e patch notes"),
        _p("O [blog](/blog) reúne os nossos posts e as notas de atualização do jogo, que são importadas automaticamente e levam o logo da desenvolvedora."),
        _h("Ajude a crescer"),
        _p("O Nin Codex é feito por jogadores. Achou um erro? Use o botão de reportar na página. Quer ajudar com tradução, edição do wiki ou coleta de dados? Veja a [página de voluntários](/volunteer) quando as inscrições estiverem abertas."),
        _p("Obrigado por ler, e até o jogo!"),
    ),
}


async def main() -> None:
    """Simula (ou grava com --aplicar) a criacao do post de apresentacao."""
    ap = argparse.ArgumentParser(description="Cria o post de apresentacao do Nin Codex no blog (rascunho por padrao).")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--publicar", action="store_true", help="publica na hora em vez de deixar como rascunho")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'} | {'publicar' if args.publicar else 'rascunho'}")

    async with AsyncSessionLocal() as db:
        if (await db.execute(select(Post).where(Post.slug == SLUG))).scalar_one_or_none() is not None:
            print(f"O post '{SLUG}' ja' existe: nada foi mudado (edite pelo painel).")
            return
        tags = list((await db.execute(select(Tag).where(Tag.id.in_(TAGS)))).scalars())
        print(f"Post: {EN['title']} / {PT['title']} | por {AUTOR} | tags: {[t.id for t in tags]} | EN {len(EN['content'])} + PT {len(PT['content'])} caracteres")
        if not args.aplicar:
            print("Simulacao: nada foi gravado. Rode de novo com --aplicar para criar.")
            return
        agora = datetime.now(timezone.utc)
        db.add(Post(
            slug=SLUG, title=EN["title"], excerpt=EN["excerpt"], content=EN["content"],
            title_pt=PT["title"], excerpt_pt=PT["excerpt"], content_pt=PT["content"],
            cover_image=CAPA, meta_title=EN["meta_title"], meta_description=EN["meta_description"],
            author_label=AUTOR, tags=tags,
            status=ContentStatus.PUBLISHED if args.publicar else ContentStatus.DRAFT, published_at=agora if args.publicar else None,
        ))
        await db.commit()
        print("Post criado" + (" e publicado." if args.publicar else " como RASCUNHO: revise e publique no painel (Blog Posts)."))


if __name__ == "__main__":
    asyncio.run(main())
