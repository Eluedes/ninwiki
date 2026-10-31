"""
Gera os ativos visuais do Nin Codex a partir do EMBLEMA do jogo (NinWiki.Web/public/images/logo/nin-logo-laranja.png):

  * Livro (capa preto couro com filete dourado e o emblema na capa):
      NinWiki.Web/public/images/logo/nin-codex-livro.svg   (logo do cabecalho/rodape/login; embute o emblema)
      NinWiki.Web/public/images/logo/nin-codex-livro.png   (mesmo desenho em PNG transparente, 3x)
  * Favicon e icones (SO' o emblema, sem o livro):
      NinWiki.Web/app/favicon.ico (16/32/48), app/icon.png (512), app/apple-icon.png (180, fundo escuro)
  * Imagem de compartilhamento Open Graph 1200x630 (livro + "NIN CODEX" em fundo escuro):
      NinWiki.Web/public/images/logo/og-nin-codex.png
  * Avatar do bot do Discord (emblema, 512x512): NinWiki.Bot/assets/avatar.png

Como rodar (na pasta NinWiki.Api):   py scripts/gerar_logo.py
E' IDEMPOTENTE: rodar de novo reescreve os mesmos arquivos (mesma entrada = mesma saida). Para mudar as cores do livro,
edite as constantes COR_* abaixo. A imagem de compartilhamento usa a fonte serifada do Windows (Georgia Bold) por nao haver o
Cinzel instalado no computador; se quiser outra, mude FONTES_TITULO.
So' precisa do Pillow (`pip install pillow`). Nao toca em banco, rede nem .env.
"""
from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "NinWiki.Web"
LOGO_DIR = WEB / "public" / "images" / "logo"
EMBLEMA = LOGO_DIR / "nin-logo-laranja.png"

# Cores do livro "Preto couro com ouro" (escolhido pelo dono).
COR_CAPA_1, COR_CAPA_2 = "#3a3f48", "#14171c"   # degrade diagonal da capa
COR_LOMBADA = "#0b0d10"
COR_FILETE = "#f2b84b"                           # moldura dourada
COR_MARCADOR = "#b91c1c"                         # fita vermelha
COR_PAGINAS, COR_PAGINAS_TOPO = "#f1dfb8", "#e0c690"
COR_FUNDO_ESCURO = "#0b0f14"
COR_TEXTO_CLARO = "#e8edf2"
COR_TEXTO_APOIO = "#93a3b8"

# Fontes tentadas (nesta ordem) para o titulo da imagem de compartilhamento.
FONTES_TITULO = [
    r"C:\Windows\Fonts\georgiab.ttf", r"C:\Windows\Fonts\timesbd.ttf", r"C:\Windows\Fonts\cambriab.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
]
FONTES_TEXTO = [r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\times.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]

# Geometria do livro em unidades 0..100 (a mesma da pagina de cores aprovada). (x, y, largura, altura)
PAGINAS = (24, 14, 62, 76)
CAPA = (16, 8, 62, 78)
LOMBADA = (16, 8, 10, 78)
FILETE = (28, 14, 48, 66)
MARCADOR = [(62, 86), (62, 97), (67, 93), (72, 97), (72, 86)]
EMBLEMA_POS = (30, 22, 44)                       # x, y, lado
ARO = (52, 44, 22.5, 0.9)                        # aro dourado fino em volta do emblema: centro x, y, raio, espessura
CAIXA = (14, 6, 88, 99)                          # recorte (x0, y0, x1, y1) que enquadra o livro inteiro

UN = 16   # pixels por unidade no desenho-mestre (depois reduzido com LANCZOS: bordas suaves)


def _rgb(hexa: str) -> tuple[int, int, int]:
    """'#rrggbb' -> (r, g, b)."""
    hexa = hexa.lstrip("#")
    return int(hexa[0:2], 16), int(hexa[2:4], 16), int(hexa[4:6], 16)


def _abrir_emblema() -> Image.Image:
    """Abre o emblema do jogo (RGBA); sai com erro claro se o arquivo nao existir."""
    if not EMBLEMA.exists():
        sys.exit(f"Emblema nao encontrado: {EMBLEMA}")
    return Image.open(EMBLEMA).convert("RGBA")


def _caixa_px(r: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    """Retangulo (x, y, w, h) em unidades -> (x0, y0, x1, y1) em pixels do desenho-mestre."""
    x, y, w, h = r
    return round(x * UN), round(y * UN), round((x + w) * UN), round((y + h) * UN)


def _mascara_arredondada(tam: tuple[int, int], r: tuple[float, float, float, float], raio: float) -> Image.Image:
    """Mascara 'L' com o retangulo arredondado r preenchido."""
    m = Image.new("L", tam, 0)
    ImageDraw.Draw(m).rounded_rectangle(_caixa_px(r), radius=round(raio * UN), fill=255)
    return m


def desenhar_livro(emblema: Image.Image) -> Image.Image:
    """Desenha o livro inteiro (RGBA transparente) e recorta na CAIXA. Mesma geometria do SVG."""
    tam = (100 * UN, 100 * UN)
    img = Image.new("RGBA", tam, (0, 0, 0, 0))

    # 1) bloco de paginas (+ faixa de topo)
    img.paste(Image.new("RGBA", tam, _rgb(COR_PAGINAS) + (255,)), mask=_mascara_arredondada(tam, PAGINAS, 3))
    px, py, pw, _ = PAGINAS
    topo = Image.new("L", tam, 0)
    ImageDraw.Draw(topo).rectangle(_caixa_px((px, py, pw, 5)), fill=255)
    img.paste(Image.new("RGBA", tam, _rgb(COR_PAGINAS_TOPO) + (255,)), mask=topo)

    # 2) capa com degrade diagonal (canto sup. esq. -> inf. dir. da propria capa)
    x0, y0, x1, y1 = _caixa_px(CAPA)
    w, h = x1 - x0, y1 - y0
    horiz = Image.linear_gradient("L").rotate(90, expand=True).resize((w, h))   # 0..255 da esquerda para a direita
    vert = Image.linear_gradient("L").resize((w, h))                           # 0..255 de cima para baixo
    t = ImageChops.add(horiz, vert, scale=2)
    capa = Image.composite(Image.new("RGB", (w, h), _rgb(COR_CAPA_2)), Image.new("RGB", (w, h), _rgb(COR_CAPA_1)), t).convert("RGBA")
    capa_inteira = Image.new("RGBA", tam, (0, 0, 0, 0))
    capa_inteira.paste(capa, (x0, y0))
    img.paste(capa_inteira, mask=_mascara_arredondada(tam, CAPA, 4))

    # 3) lombada
    img.paste(Image.new("RGBA", tam, _rgb(COR_LOMBADA) + (255,)), mask=_mascara_arredondada(tam, LOMBADA, 4))

    # 4) filete dourado: anel = contorno externo (+0,7) menos interno (-0,7) do retangulo, como um traco de 1,4
    fx, fy, fw, fh = FILETE
    ext = _mascara_arredondada(tam, (fx - 0.7, fy - 0.7, fw + 1.4, fh + 1.4), 2.7)
    inte = _mascara_arredondada(tam, (fx + 0.7, fy + 0.7, fw - 1.4, fh - 1.4), 1.3)
    img.paste(Image.new("RGBA", tam, _rgb(COR_FILETE) + (255,)), mask=ImageChops.subtract(ext, inte))

    # 5) marcador (fita)
    fita = Image.new("L", tam, 0)
    ImageDraw.Draw(fita).polygon([(round(x * UN), round(y * UN)) for x, y in MARCADOR], fill=255)
    img.paste(Image.new("RGBA", tam, _rgb(COR_MARCADOR) + (255,)), mask=fita)

    # 5b) aro dourado fino em volta do emblema (destaca o emblema no preto)
    ax, ay, ar, ae = ARO
    aro = Image.new("L", tam, 0)
    ImageDraw.Draw(aro).ellipse([round((ax - ar - ae / 2) * UN), round((ay - ar - ae / 2) * UN), round((ax + ar + ae / 2) * UN), round((ay + ar + ae / 2) * UN)], fill=255)
    ImageDraw.Draw(aro).ellipse([round((ax - ar + ae / 2) * UN), round((ay - ar + ae / 2) * UN), round((ax + ar - ae / 2) * UN), round((ay + ar - ae / 2) * UN)], fill=0)
    img.paste(Image.new("RGBA", tam, _rgb(COR_FILETE) + (255,)), mask=aro)

    # 6) emblema do jogo no centro da capa
    ex, ey, lado = EMBLEMA_POS
    emb = emblema.resize((lado * UN, lado * UN), Image.LANCZOS)
    img.alpha_composite(emb, (ex * UN, ey * UN))

    cx0, cy0, cx1, cy1 = CAIXA
    return img.crop((cx0 * UN, cy0 * UN, cx1 * UN, cy1 * UN))


def livro_png(emblema: Image.Image, altura: int) -> Image.Image:
    """Livro reduzido para a altura dada (largura proporcional), fundo transparente."""
    mestre = desenhar_livro(emblema)
    return mestre.resize((round(mestre.width * altura / mestre.height), altura), Image.LANCZOS)


def livro_svg(emblema: Image.Image) -> str:
    """O MESMO livro em SVG (vetorial), embutindo o emblema em base64. Usado como <img> no site."""
    buf = io.BytesIO()
    emblema.resize((128, 128), Image.LANCZOS).save(buf, "PNG", optimize=True)
    emb = base64.b64encode(buf.getvalue()).decode()
    cx0, cy0, cx1, cy1 = CAIXA
    px, py, pw, ph = PAGINAS
    cx, cy, cw, ch = CAPA
    lx, ly, lw, lh = LOMBADA
    fx, fy, fw, fh = FILETE
    ex, ey, lado = EMBLEMA_POS
    ax, ay, ar, ae = ARO
    fita = " ".join(f"{x},{y}" for x, y in MARCADOR)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="{cx0} {cy0} {cx1 - cx0} {cy1 - cy0}">'
        f'<title>Nin Codex</title>'
        f'<defs><linearGradient id="capa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{COR_CAPA_1}"/><stop offset="1" stop-color="{COR_CAPA_2}"/></linearGradient></defs>'
        f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="3" fill="{COR_PAGINAS}"/>'
        f'<rect x="{px}" y="{py}" width="{pw}" height="5" fill="{COR_PAGINAS_TOPO}"/>'
        f'<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="4" fill="url(#capa)"/>'
        f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" rx="4" fill="{COR_LOMBADA}"/>'
        f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="2" fill="none" stroke="{COR_FILETE}" stroke-width="1.4"/>'
        f'<polygon points="{fita}" fill="{COR_MARCADOR}"/>'
        f'<circle cx="{ax}" cy="{ay}" r="{ar}" fill="none" stroke="{COR_FILETE}" stroke-width="{ae}"/>'
        f'<image href="data:image/png;base64,{emb}" xlink:href="data:image/png;base64,{emb}" x="{ex}" y="{ey}" width="{lado}" height="{lado}"/>'
        f'</svg>\n'
    )


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


def imagem_compartilhamento(emblema: Image.Image) -> Image.Image:
    """1200x630: fundo escuro com leve degrade, o livro a esquerda e 'NIN CODEX' + apoio a direita."""
    W, H = 1200, 630
    fundo = Image.linear_gradient("L").resize((W, H))
    img = Image.composite(Image.new("RGB", (W, H), _rgb("#131a22")), Image.new("RGB", (W, H), _rgb(COR_FUNDO_ESCURO)), fundo).convert("RGBA")
    livro = livro_png(emblema, 470)
    img.alpha_composite(livro, (150, (H - livro.height) // 2))
    d = ImageDraw.Draw(img)
    f_titulo = _fonte(FONTES_TITULO, 112)
    f_apoio = _fonte(FONTES_TEXTO, 32)
    x = 150 + livro.width + 70
    _texto_espacado(d, (x, 215), "NIN", f_titulo, COR_FILETE, 10)
    _texto_espacado(d, (x, 335), "CODEX", f_titulo, COR_TEXTO_CLARO, 10)
    d.rectangle((x, 462, x + 90, 466), fill=_rgb(COR_FILETE))
    d.text((x, 485), "The Nin Online encyclopedia", font=f_apoio, fill=COR_TEXTO_APOIO)
    return img.convert("RGB")


def salvar(img: Image.Image, destino: Path, **opcoes) -> None:
    """Grava a imagem criando a pasta se preciso e conta o que fez."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, **opcoes)
    print("ok", destino.relative_to(RAIZ))


def main() -> None:
    """Gera todos os arquivos (ver docstring do modulo)."""
    emb = _abrir_emblema()

    # Livro: SVG + PNG 3x (a mais, para telas de alta densidade)
    svg = LOGO_DIR / "nin-codex-livro.svg"
    svg.write_text(livro_svg(emb), encoding="utf-8")
    print("ok", svg.relative_to(RAIZ))
    salvar(livro_png(emb, 384), LOGO_DIR / "nin-codex-livro.png", optimize=True)

    # Favicon e icones: SO' o emblema
    salvar(emb.resize((256, 256), Image.LANCZOS), WEB / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    salvar(emb.resize((512, 512), Image.LANCZOS), WEB / "app" / "icon.png", optimize=True)
    apple = Image.new("RGBA", (180, 180), _rgb("#14171c") + (255,))   # icone da Apple nao aceita transparencia
    apple.alpha_composite(emb.resize((148, 148), Image.LANCZOS), (16, 16))
    salvar(apple.convert("RGB"), WEB / "app" / "apple-icon.png", optimize=True)

    # Compartilhamento (Open Graph / Twitter)
    salvar(imagem_compartilhamento(emb), LOGO_DIR / "og-nin-codex.png", optimize=True)

    # Avatar do bot: emblema sobre fundo escuro (o Discord corta em circulo)
    avatar = Image.new("RGBA", (512, 512), _rgb("#14171c") + (255,))
    avatar.alpha_composite(emb.resize((400, 400), Image.LANCZOS), (56, 56))
    salvar(avatar.convert("RGB"), RAIZ / "NinWiki.Bot" / "assets" / "avatar.png", optimize=True)


if __name__ == "__main__":
    main()
