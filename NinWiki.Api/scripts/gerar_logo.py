"""
Gera os ativos visuais do Nin Codex a partir da LOGO (NinWiki.Web/public/images/logo/nin-codex-logo.png: o livro preto com o shuriken verde, PNG transparente):

  * Logo para o site (cabecalho, rodape, login, painel):  NinWiki.Web/public/images/logo/nin-codex-livro.png
  * Favicon e icones:  NinWiki.Web/app/favicon.ico (16/32/48), app/icon.png (512), app/apple-icon.png (180, fundo escuro)
  * Imagem de compartilhamento Open Graph 1200x630 (logo + "NIN CODEX" em fundo escuro):  NinWiki.Web/public/images/logo/og-nin-codex.png
  * Avatar do bot do Discord (512x512):  NinWiki.Bot/assets/avatar.png
  * Logo do rodape das respostas do bot (servido pela API em /brand/nin-codex-logo.png):  NinWiki.Api/app/static/brand/nin-codex-logo.png

Para trocar a logo: substitua nin-codex-logo.png (PNG com fundo transparente) e rode, na pasta NinWiki.Api:   py scripts/gerar_logo.py
E' IDEMPOTENTE: rodar de novo reescreve os mesmos arquivos (mesma entrada = mesma saida). A imagem de compartilhamento usa a fonte serifada
do Windows (Georgia Bold) por nao haver o Cinzel instalado no computador; se quiser outra, mude FONTES_TITULO.
So' precisa do Pillow (`pip install pillow`). Nao toca em banco, rede nem .env.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "NinWiki.Web"
LOGO_DIR = WEB / "public" / "images" / "logo"
MESTRE = LOGO_DIR / "nin-codex-logo.png"
BRAND_API = RAIZ / "NinWiki.Api" / "app" / "static" / "brand"

COR_DOURADO = "#f2b84b"
COR_FUNDO_ESCURO = "#0b0f14"
COR_FUNDO_ICONE = "#14171c"
COR_TEXTO_CLARO = "#e8edf2"
COR_TEXTO_APOIO = "#93a3b8"

# Fontes tentadas (nesta ordem) para o titulo da imagem de compartilhamento.
FONTES_TITULO = [
    r"C:\Windows\Fonts\georgiab.ttf", r"C:\Windows\Fonts\timesbd.ttf", r"C:\Windows\Fonts\cambriab.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
]
FONTES_TEXTO = [r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\times.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]


def _rgb(hexa: str) -> tuple[int, int, int]:
    """'#rrggbb' -> (r, g, b)."""
    hexa = hexa.lstrip("#")
    return int(hexa[0:2], 16), int(hexa[2:4], 16), int(hexa[4:6], 16)


def abrir_logo() -> Image.Image:
    """Abre a logo (RGBA) e corta as bordas transparentes; sai com erro claro se o arquivo nao existir."""
    if not MESTRE.exists():
        sys.exit(f"Logo nao encontrada: {MESTRE}")
    logo = Image.open(MESTRE).convert("RGBA")
    caixa = logo.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return logo.crop(caixa) if caixa else logo


def quadrada(logo: Image.Image, lado: int, margem: float = 0.04) -> Image.Image:
    """A logo inteira centralizada num quadrado transparente (lado x lado), com uma margem proporcional."""
    util = round(lado * (1 - 2 * margem))
    esc = min(util / logo.width, util / logo.height)
    peq = logo.resize((max(1, round(logo.width * esc)), max(1, round(logo.height * esc))), Image.LANCZOS)
    tela = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    tela.alpha_composite(peq, ((lado - peq.width) // 2, (lado - peq.height) // 2))
    return tela


def com_altura(logo: Image.Image, altura: int) -> Image.Image:
    """Logo reduzida para a altura dada (largura proporcional), fundo transparente."""
    return logo.resize((round(logo.width * altura / logo.height), altura), Image.LANCZOS)


def _fonte(caminhos: list[str], tamanho: int) -> ImageFont.ImageFont:
    """Primeira fonte que existir; senao a padrao do Pillow (feia, mas nao quebra)."""
    for c in caminhos:
        if Path(c).exists():
            return ImageFont.truetype(c, tamanho)
    return ImageFont.load_default()


def _texto_espacado(d: ImageDraw.ImageDraw, xy: tuple[int, int], texto: str, fonte: ImageFont.ImageFont, cor: str, espaco: int) -> int:
    """Escreve o texto letra a letra com espacamento extra; devolve a largura total."""
    x, y = xy
    for ch in texto:
        d.text((x, y), ch, font=fonte, fill=cor)
        x += round(d.textlength(ch, font=fonte)) + espaco
    return x - xy[0] - espaco


def imagem_compartilhamento(logo: Image.Image) -> Image.Image:
    """1200x630: fundo escuro com leve degrade, a logo a esquerda e 'NIN CODEX' + apoio a direita."""
    W, H = 1200, 630
    fundo = Image.linear_gradient("L").resize((W, H))
    img = Image.composite(Image.new("RGB", (W, H), _rgb("#131a22")), Image.new("RGB", (W, H), _rgb(COR_FUNDO_ESCURO)), fundo).convert("RGBA")
    grande = com_altura(logo, 470)
    img.alpha_composite(grande, (150, (H - grande.height) // 2))
    d = ImageDraw.Draw(img)
    f_titulo = _fonte(FONTES_TITULO, 112)
    f_apoio = _fonte(FONTES_TEXTO, 32)
    x = 150 + grande.width + 70
    _texto_espacado(d, (x, 215), "NIN", f_titulo, COR_DOURADO, 10)
    _texto_espacado(d, (x, 335), "CODEX", f_titulo, COR_TEXTO_CLARO, 10)
    d.rectangle((x, 462, x + 90, 466), fill=_rgb(COR_DOURADO))
    d.text((x, 485), "The Nin Online encyclopedia", font=f_apoio, fill=COR_TEXTO_APOIO)
    return img.convert("RGB")


def salvar(img: Image.Image, destino: Path, **opcoes) -> None:
    """Grava a imagem criando a pasta se preciso e conta o que fez."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, **opcoes)
    print("ok", destino.relative_to(RAIZ))


def sobre_fundo_escuro(logo: Image.Image, lado: int, miolo: int) -> Image.Image:
    """Logo centralizada (miolo x miolo) sobre um quadrado escuro lado x lado (icone da Apple e avatar nao aceitam transparencia)."""
    base = Image.new("RGBA", (lado, lado), _rgb(COR_FUNDO_ICONE) + (255,))
    base.alpha_composite(quadrada(logo, miolo, 0.0), ((lado - miolo) // 2, (lado - miolo) // 2))
    return base.convert("RGB")


def main() -> None:
    """Gera todos os arquivos (ver docstring do modulo)."""
    logo = abrir_logo()

    salvar(com_altura(logo, 384), LOGO_DIR / "nin-codex-livro.png", optimize=True)   # logo do site (3x para telas de alta densidade)

    quad = quadrada(logo, 256)
    salvar(quad, WEB / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    salvar(quadrada(logo, 512), WEB / "app" / "icon.png", optimize=True)
    salvar(sobre_fundo_escuro(logo, 180, 150), WEB / "app" / "apple-icon.png", optimize=True)

    salvar(imagem_compartilhamento(logo), LOGO_DIR / "og-nin-codex.png", optimize=True)

    salvar(sobre_fundo_escuro(logo, 512, 420), RAIZ / "NinWiki.Bot" / "assets" / "avatar.png", optimize=True)
    salvar(quadrada(logo, 256), BRAND_API / "nin-codex-logo.png", optimize=True)   # rodape das respostas do bot (a API serve em /brand)


if __name__ == "__main__":
    main()
