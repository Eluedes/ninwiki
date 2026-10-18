"""
Confere se o README esta' em dia com o codigo - roda em ~1 segundo, sem banco e sem internet.

COMO RODAR (na pasta NinWiki.Api):
    py scripts/verificar_readme.py            # so' confere e avisa
    py scripts/verificar_readme.py --corrigir # regera a tabela de permissoes do README (a unica parte gerada)

O QUE CONFERE (ERRO = README mente ou falta algo importante; AVISO = vale dar uma olhada):
  1. Variaveis de ambiente: toda variavel de app/core/config.py aparece no README.            [ERRO]
  2. Tabela de permissoes do README (entre <!-- permissoes:inicio --> e <!-- permissoes:fim -->)
     e' IGUAL ao que o codigo define (nome, rotulo e quem tem por padrao).                      [ERRO; --corrigir resolve]
  3. Toda permissao tem rotulo em portugues E em ingles no painel (lib/i18n.ts) e consta no tipo
     PermissionName (lib/api-client.ts).                                                         [ERRO]
  4. Todo comando do bot (/status, /search...) esta' no README do bot e no README principal.    [ERRO]
  5. Toda migracao citada no README (codigo de 12 letras/numeros entre crases) existe de verdade;
     a migracao mais nova (head) deveria estar citada.                                           [ERRO / AVISO]
  6. Toda tela do painel (/admin/xxx) aparece no README.                                         [ERRO]
  7. Comando/arquivo que o README cita e foi REMOVIDO do projeto (ex.: /team, staff_commands). [ERRO]
Sai com codigo 1 se houver ERRO. Roda tambem dentro de scripts/verificar_projeto.py.
"""
import os
import re
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
ROOT = API_DIR.parent
sys.path.insert(0, str(API_DIR))

README = ROOT / "README.md"
BOT_README = ROOT / "NinWiki.Bot" / "README.md"
MARK_START = "<!-- permissoes:inicio"
MARK_END = "<!-- permissoes:fim -->"
# Telas do painel que nao precisam de texto proprio no README (redirecionamentos / sub-rotas).
ADMIN_PAGES_IGNORADAS = {"blog-posts"}   # blog-posts esta' descrito como "Blog Posts" no painel
# Coisas que ja' foram removidas e NAO podem voltar a ser citadas como existentes.
REMOVIDOS = ["/team list", "/team manage", "/team clearlog", "staff_commands.py"]


class Resultado:
    """Junta o que foi encontrado e imprime no mesmo estilo do verificar_projeto.py."""

    def __init__(self) -> None:
        self.erros = 0
        self.avisos = 0

    def ok(self, msg: str) -> None:
        print(f"  [OK]   {msg}")

    def erro(self, msg: str, como: str = "") -> None:
        self.erros += 1
        print(f"  [ERRO] {msg}" + (f"\n         -> {como}" if como else ""))

    def aviso(self, msg: str, como: str = "") -> None:
        self.avisos += 1
        print(f"  [AVISO] {msg}" + (f"\n         -> {como}" if como else ""))


def _ler(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def tabela_permissoes() -> str:
    """Tabela Markdown das permissoes, gerada do codigo (nome, rotulo em portugues, quem tem por padrao)."""
    from app.core.permissions import DEFAULT_ROLE_PERMISSIONS, SUPER_ONLY_PERMISSIONS, Permission
    from app.models.enums import StaffRole

    i18n = _ler(ROOT / "NinWiki.Web" / "lib" / "i18n.ts")
    start = i18n.index("'content.create'")
    rotulos = dict(re.findall(r"'([a-z_.]+)':\s*'((?:[^'\\]|\\.)*)'", i18n[start:start + 8000]))
    linhas = ["| Permissão | O que libera | Quem tem por padrão |", "|---|---|---|"]
    for p in Permission:
        if p.value.startswith("media.cat."):
            continue
        d = DEFAULT_ROLE_PERMISSIONS
        quem = ("S.Adm" if p in SUPER_ONLY_PERMISSIONS else "Creator, Adm, S.Adm" if p in d[StaffRole.CREATOR]
                else "Adm, S.Adm" if p in d[StaffRole.ADMIN] else "S.Adm")
        linhas.append(f"| `{p.value}` | {rotulos.get(p.value, '')} | {quem}{' (exclusiva)' if p in SUPER_ONLY_PERMISSIONS else ''} |")
    return "\n".join(linhas)


def checar_variaveis(r: Resultado, readme: str) -> None:
    print("\n1) Variaveis de ambiente (config.py x README)")
    campos = re.findall(r"^    ([a-z_0-9]+): [^=\n]+=", _ler(API_DIR / "app" / "core" / "config.py"), re.M)
    faltam = [c.upper() for c in campos if c.upper() not in readme]
    if faltam:
        r.erro("Variaveis que existem no codigo mas nao estao no README: " + ", ".join(faltam), "acrescente na tabela de variaveis do README")
    else:
        r.ok(f"as {len(campos)} variaveis estao no README")


def checar_tabela_permissoes(r: Resultado, readme: str, corrigir: bool) -> str:
    print("\n2) Tabela de permissoes do README")
    if MARK_START not in readme or MARK_END not in readme:
        r.erro("README sem os marcadores da tabela de permissoes", f"coloque {MARK_START} ... --> e {MARK_END} em volta da tabela")
        return readme
    a = readme.index(MARK_START)
    a_fim_linha = readme.index("\n", a) + 1
    b = readme.index(MARK_END)
    atual = readme[a_fim_linha:b].strip()
    esperado = tabela_permissoes().strip()
    if atual == esperado:
        r.ok("a tabela esta' igual ao codigo")
        return readme
    if corrigir:
        readme = readme[:a_fim_linha] + esperado + "\n" + readme[b:]
        README.write_text(readme, encoding="utf-8")
        r.ok("tabela regerada a partir do codigo")
    else:
        r.erro("a tabela de permissoes do README esta' diferente do codigo (permissao nova, removida ou rotulo/cargo mudou)",
               "rode: py scripts/verificar_readme.py --corrigir")
    return readme


def checar_rotulos_permissoes(r: Resultado) -> None:
    print("\n3) Rotulos (PT/EN) e tipo no front para cada permissao")
    from app.core.permissions import Permission

    i18n = _ler(ROOT / "NinWiki.Web" / "lib" / "i18n.ts")
    api_client = _ler(ROOT / "NinWiki.Web" / "lib" / "api-client.ts")
    sem_rotulo, sem_tipo = [], []
    for p in Permission:
        if p.value.startswith("media.cat."):
            continue
        if len(re.findall(rf"'{re.escape(p.value)}':\s*'", i18n)) < 2:
            sem_rotulo.append(p.value)
        if f"'{p.value}'" not in api_client:
            sem_tipo.append(p.value)
    if sem_rotulo:
        r.erro("Permissao sem rotulo em portugues e/ou ingles em lib/i18n.ts: " + ", ".join(sem_rotulo), "acrescente em rolesPage.names (PT e EN)")
    if sem_tipo:
        r.erro("Permissao fora do tipo PermissionName em lib/api-client.ts: " + ", ".join(sem_tipo), "acrescente no tipo PermissionName")
    if not sem_rotulo and not sem_tipo:
        r.ok("todas as permissoes tem rotulo PT/EN e tipo no front")


def checar_comandos_bot(r: Resultado, readme: str) -> None:
    print("\n4) Comandos do bot x READMEs")
    comandos = re.findall(r'@tree\.command\(name="(\w+)"', _ler(ROOT / "NinWiki.Bot" / "ninwiki_bot" / "public_commands.py"))
    bot_readme = _ler(BOT_README)
    faltam = [f"/{c}" for c in comandos if not re.search(rf"/{c}\b", readme) or not re.search(rf"/{c}\b", bot_readme)]
    if faltam:
        r.erro("Comando do bot que nao esta' em AMBOS os READMEs (principal e do bot): " + ", ".join(faltam))
    else:
        r.ok("os " + str(len(comandos)) + " comandos (" + ", ".join("/" + c for c in comandos) + ") estao nos dois READMEs")


def checar_migracoes(r: Resultado, readme: str) -> None:
    print("\n5) Migracoes citadas no README")
    revs, down = {}, set()
    for f in (API_DIR / "alembic" / "versions").glob("*.py"):
        txt = _ler(f)
        m = re.search(r"^revision[^=]*=\s*'([^']+)'", txt, re.M)
        if m:
            revs[m.group(1)] = f.name
            d = re.search(r"^down_revision[^=]*=\s*(?:Union\[[^\]]*\]\s*=\s*)?'([^']+)'", txt, re.M)
            if d:
                down.add(d.group(1))
    citadas = set(re.findall(r"`([0-9a-f]{12})`", readme))
    inexistentes = sorted(c for c in citadas if c not in revs)
    if inexistentes:
        r.erro("README cita migracao que nao existe: " + ", ".join(inexistentes))
    else:
        r.ok(f"as {len(citadas)} migracoes citadas existem")
    heads = [v for v in revs if v not in down]
    if len(heads) != 1:
        r.erro(f"deveria haver UMA head de migracao, ha {len(heads)}: {heads}", "rode: py -m alembic heads")
    elif heads[0] not in readme:
        r.aviso(f"a migracao mais nova ({heads[0]}) nao e' citada no README", "se ela exige 'alembic upgrade head' ou muda algo visivel, cite onde descrever a novidade")


def checar_telas_admin(r: Resultado, readme: str) -> None:
    print("\n6) Telas do painel x README")
    faltam = []
    for p in sorted((ROOT / "NinWiki.Web" / "app" / "admin").glob("*/page.tsx")):
        nome = p.parent.name
        if nome in ADMIN_PAGES_IGNORADAS or f"/admin/{nome}" in readme:
            continue
        faltam.append(f"/admin/{nome}")
    if faltam:
        r.erro("Telas do painel que o README nao menciona: " + ", ".join(faltam))
    else:
        r.ok("todas as telas do painel estao no README")


def checar_removidos(r: Resultado, readme: str) -> None:
    print("\n7) Coisas removidas que o README ainda cita")
    achados = [t for t in REMOVIDOS if t in readme.replace("foram **removidos**", "").replace("foram removidos", "") and _citado_como_existente(readme, t)]
    if achados:
        r.erro("README ainda cita como existente: " + ", ".join(achados))
    else:
        r.ok("nada removido aparece como se existisse")


def _citado_como_existente(readme: str, termo: str) -> bool:
    """True se o termo aparece numa linha que nao diz que foi removido/saiu."""
    for linha in readme.splitlines():
        if termo in linha and not re.search(r"removid|saiu|sa[ií]ram|n[aã]o existe|antigo", linha, re.I):
            return True
    return False


def rodar(corrigir: bool = False) -> Resultado:
    """Roda todas as conferencias e devolve o resultado (usado tambem pelo verificar_projeto.py)."""
    r = Resultado()
    readme = _ler(README)
    checar_variaveis(r, readme)
    readme = checar_tabela_permissoes(r, readme, corrigir)
    checar_rotulos_permissoes(r)
    checar_comandos_bot(r, readme)
    checar_migracoes(r, readme)
    checar_telas_admin(r, readme)
    checar_removidos(r, readme)
    return r


def main() -> int:
    print("=" * 62)
    print(" README x codigo")
    print("=" * 62)
    r = rodar("--corrigir" in sys.argv)
    print("\n" + "=" * 62)
    if r.erros:
        print(f" RESULTADO: {r.erros} problema(s), {r.avisos} aviso(s). Atualize o README (ou rode com --corrigir para a tabela).")
        return 1
    print(f" RESULTADO: README em dia!{f' ({r.avisos} aviso(s))' if r.avisos else ''}")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("JWT_SECRET_KEY", "x")
    sys.exit(main())
