"""
Verificador de saude do projeto - roda em ~10 segundos e avisa, em
portugues, se ALGO esta' fora de sincronia entre codigo, migracoes,
banco de dados e frontend.

QUANDO RODAR: sempre DEPOIS de qualquer alteracao grande - principalmente
se uma IA (Gemini, ChatGPT, Claude...) mexeu em arquivos ou rodou algum
comando de banco. Foi exatamente esse tipo de mudanca "por fora" que
causou os bugs de 27/09 (migracao aplicada sem o resto do codigo saber,
componente colado no arquivo errado, campo novo que nao era salvo).

COMO RODAR (na pasta NinWiki.Api, com o venv ativado):
    py scripts/verificar_projeto.py

O QUE CONFERE:
  0. Bibliotecas: tudo que esta' no requirements.txt esta' INSTALADO (na versao
     certa) no Python que esta' rodando? (esquecer "pip install -r
     requirements.txt" depois de uma atualizacao e' o erro mais comum - vira um
     "ModuleNotFoundError" feio ao ligar a API)
  1. Sintaxe de todos os arquivos Python
  2. Migracoes: existe UMA so' "head"? (duas = alguem criou uma migracao
     em cima da errada - o Alembic recusa rodar)
  3. Banco x arquivos: o banco esta na migracao mais recente, e essa
     migracao existe nos arquivos? (banco numa migracao DESCONHECIDA =
     alguem rodou uma migracao que nao esta' aqui)
  4. Models x migracoes: os models Python batem EXATAMENTE com o que as
     migracoes criam no banco? (campo no model sem migracao = erro em
     producao, coluna que o codigo espera mas nao existe)
  5. Frontend: o TypeScript compila sem erro? (pega import quebrado,
     componente no arquivo errado, campo que nao existe no tipo...) E o
     lint (npm run lint) esta' limpo, sem nenhum aviso? (pega efeito que
     chama setState direto, dependencia esquecida, etc.)

Sai com codigo 1 se algo estiver ERRADO (util pra automatizar depois).
"""
import ast
import re
import shutil
import subprocess
import sys
from importlib import metadata
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = API_DIR.parent / "NinWiki.Web"

problemas = 0
avisos = 0


def ok(msg: str) -> None:
    print(f"  [OK]    {msg}")


def erro(msg: str, como_resolver: str = "") -> None:
    global problemas
    problemas += 1
    print(f"  [ERRO]  {msg}")
    if como_resolver:
        print(f"          -> {como_resolver}")


def aviso(msg: str, como_resolver: str = "") -> None:
    global avisos
    avisos += 1
    print(f"  [AVISO] {msg}")
    if como_resolver:
        print(f"          -> {como_resolver}")


def rodar(cmd: list[str], cwd: Path, timeout: int = 120) -> tuple[int, str]:
    """Roda um comando e devolve (codigo_de_saida, stdout+stderr juntos)."""
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                           encoding="utf-8", errors="replace")
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, "tempo esgotado"
    except FileNotFoundError as e:
        return 127, str(e)


def alembic(*args: str) -> tuple[int, str]:
    return rodar([sys.executable, "-m", "alembic", *args], API_DIR)


def checar_dependencias() -> None:
    print("\n0) Bibliotecas Python (requirements.txt)")
    req = API_DIR / "requirements.txt"
    if not req.exists():
        aviso("requirements.txt nao encontrado")
        return
    faltando: list[str] = []
    versao_errada: list[str] = []
    total = 0
    for linha in req.read_text(encoding="utf-8").splitlines():
        linha = linha.split("#")[0].strip()
        m = re.match(r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*==\s*([^\s;]+)", linha)
        if not m:
            continue
        total += 1
        nome, pin = m.groups()
        try:
            instalada = metadata.version(nome)
        except metadata.PackageNotFoundError:
            faltando.append(f"{nome}=={pin}")
            continue
        if instalada != pin:
            versao_errada.append(f"{nome}: instalada {instalada}, o projeto pede {pin}")
    comando = f"{sys.executable} -m pip install -r requirements.txt"
    if faltando:
        erro("Faltam bibliotecas neste Python: " + ", ".join(faltando),
             f"instale com: {comando}   (o venv da API precisa estar ativado; Python usado agora: {sys.executable})")
    if versao_errada:
        aviso("Versao diferente da que o projeto pede: " + "; ".join(versao_errada), f"para igualar: {comando}")
    if not faltando and not versao_errada:
        ok(f"as {total} bibliotecas do requirements.txt estao instaladas na versao certa")


def checar_sintaxe() -> None:
    print("\n1) Sintaxe dos arquivos Python")
    ignorar = {"venv", ".venv", "__pycache__", "node_modules", "uploads"}
    quebrados = []
    total = 0
    for path in API_DIR.rglob("*.py"):
        if any(part in ignorar for part in path.parts):
            continue
        total += 1
        try:
            ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError as e:
            quebrados.append(f"{path.relative_to(API_DIR)} (linha {e.lineno}): {e.msg}")
    if quebrados:
        for q in quebrados:
            erro(q, "corrija o erro de sintaxe nesse arquivo")
    else:
        ok(f"{total} arquivos .py sem erro de sintaxe")


def checar_migracoes() -> bool:
    """Devolve True se da' pra continuar com as checagens que precisam do banco."""
    print("\n2) Migracoes (Alembic)")
    code, out = alembic("heads")
    heads = [l for l in out.splitlines() if "(head)" in l]
    if code != 0:
        erro("O Alembic nao conseguiu ler as migracoes.", "veja a mensagem completa rodando: py -m alembic heads")
        return False
    if len(heads) == 1:
        ok(f"uma unica cabeca de migracao: {heads[0].split()[0]}")
    elif len(heads) > 1:
        erro(f"{len(heads)} cabecas de migracao (duas migracoes com o mesmo pai): "
             + ", ".join(h.split()[0] for h in heads),
             "apague a migracao criada por engano ou aponte o down_revision dela pra outra migracao")
        return False
    else:
        erro("Nenhuma migracao encontrada.")
        return False

    print("\n3) Banco de dados x arquivos de migracao")
    code, out = alembic("current")
    if "Can't locate revision" in out:
        erro("O banco esta em uma migracao que NAO EXISTE nos arquivos deste projeto.",
             "alguem rodou uma migracao que esta' fora do projeto (ex: outra IA). "
             "Traga o arquivo dessa migracao pra pasta alembic/versions antes de continuar.")
        return False
    if code != 0:
        aviso("Nao consegui consultar o banco (ele esta ligado? DATABASE_URL no .env esta certa?).",
              "as checagens 3 e 4 foram puladas")
        return False
    if "(head)" in out:
        ok("banco na migracao mais recente")
        return True
    aviso("O banco esta ATRASADO em relacao aos arquivos de migracao.", "rode: py -m alembic upgrade head")
    return False


def checar_models_vs_migracoes() -> None:
    print("\n4) Models Python x migracoes")
    code, out = alembic("check")
    if code == 0:
        ok("os models batem exatamente com o banco migrado")
    elif "New upgrade operations detected" in out:
        erro("Os models Python tem diferencas que NENHUMA migracao cobre (campo/tabela nova ou removida).",
             'crie a migracao: py -m alembic revision --autogenerate -m "descricao" '
             "(REVISE o arquivo gerado antes de aplicar - renomear coluna vira 'apagar+criar' e perde dado)")
    else:
        aviso("Nao consegui comparar models e migracoes.", "rode: py -m alembic check")


def checar_lint(node: str) -> None:
    eslint = WEB_DIR / "node_modules" / "eslint" / "bin" / "eslint.js"
    if not eslint.exists():
        aviso("ESLint nao encontrado no frontend (rode 'npm install' na pasta NinWiki.Web)")
        return
    code, out = rodar([node, str(eslint), ".", "--max-warnings=0"], WEB_DIR, timeout=300)
    if code == 0:
        ok("lint (npm run lint) limpo, sem nenhum erro ou aviso")
        return
    resumo = next((l.strip() for l in out.splitlines() if "problem" in l and ("error" in l or "warning" in l)), "problemas de lint")
    arquivos = [l.strip() for l in out.splitlines() if l.startswith("/") or (len(l) > 2 and l[1:3] == ":\\")]
    erro(f"Lint com problemas: {resumo}", "rode 'npm run lint' na pasta NinWiki.Web pra ver cada linha")
    for a in arquivos[:6]:
        print(f"            {a}")


def checar_frontend() -> None:
    print("\n5) Frontend (TypeScript e lint)")
    if not WEB_DIR.exists():
        aviso(f"Pasta do frontend nao encontrada em {WEB_DIR}")
        return
    tsc = WEB_DIR / "node_modules" / "typescript" / "bin" / "tsc"
    if not tsc.exists():
        aviso("node_modules nao encontrado no frontend.", "rode 'npm install' na pasta NinWiki.Web")
        return
    node = shutil.which("node")
    if not node:
        aviso("Node.js nao encontrado no PATH.")
        return
    code, out = rodar([node, str(tsc), "--noEmit"], WEB_DIR, timeout=300)
    if code == 0:
        ok("TypeScript compila sem nenhum erro")
        checar_lint(node)
        return
    linhas = [l for l in out.splitlines() if "error TS" in l]
    erro(f"{len(linhas)} erro(s) de TypeScript no frontend:")
    for l in linhas[:10]:
        print(f"            {l}")
    if len(linhas) > 10:
        print(f"            ... e mais {len(linhas) - 10} (rode 'npm run typecheck' na pasta NinWiki.Web pra ver todos)")


def main() -> int:
    print("=" * 62)
    print(" Verificacao de saude do projeto NinWiki")
    print("=" * 62)
    checar_dependencias()
    checar_sintaxe()
    banco_ok = checar_migracoes()
    if banco_ok:
        checar_models_vs_migracoes()
    else:
        print("\n4) Models Python x migracoes\n  [PULADO] resolva os pontos 2/3 primeiro")
    checar_frontend()
    print("\n" + "=" * 62)
    if problemas:
        print(f" RESULTADO: {problemas} problema(s) encontrado(s), {avisos} aviso(s).")
        print(" Corrija os itens [ERRO] acima antes de continuar.")
        return 1
    print(f" RESULTADO: tudo certo!{f' ({avisos} aviso(s))' if avisos else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
