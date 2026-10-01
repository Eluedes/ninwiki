"""
Inicializador da API para hospedagem (SquareCloud).

Faz duas coisas, nesta ordem:
  1. aplica as migrations pendentes (alembic upgrade head) - assim o banco
     sempre acompanha o codigo enviado;
  2. liga o Uvicorn escutando em 0.0.0.0:80 (a porta que a SquareCloud expoe).

Se a migration falhar, a API NAO sobe (melhor do que rodar com banco desatualizado).
"""
import os
import subprocess
import sys

PORT = os.getenv("PORT", "80")


def main() -> None:
    print("[start] aplicando migrations...", flush=True)
    result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"])
    if result.returncode != 0:
        print("[start] migration falhou - abortando.", file=sys.stderr, flush=True)
        sys.exit(result.returncode)

    print(f"[start] iniciando API na porta {PORT}...", flush=True)
    os.execv(
        sys.executable,
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", PORT,
         "--proxy-headers", "--forwarded-allow-ips", "*"],
    )


if __name__ == "__main__":
    main()
