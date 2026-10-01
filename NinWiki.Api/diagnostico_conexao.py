"""
Script de diagnostico isolado - testa a conexao com o Postgres usando
SO' o asyncpg puro, sem FastAPI/SQLAlchemy no meio. Isso separa duas
possibilidades:

  A) Se ISSO tambem falhar -> o problema e' o asyncpg em si (na forma
     como ele conversa com o Postgres pela rede), nao o FastAPI/
     SQLAlchemy. A proxima correcao vai na direcao de SSL/protocolo.

  B) Se ISSO funcionar -> o problema esta' especificamente em como o
     SQLAlchemy/FastAPI usam o asyncpg (algo na configuracao do
     engine), nao no asyncpg cru.

Rodar (com o venv ativado, na pasta NinWiki.Api):
    python diagnostico_conexao.py

Copia e cola AQUI o resultado completo (incluindo qualquer erro).
"""
import asyncio
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
# asyncpg.connect() nao entende o prefixo "postgresql+asyncpg://" (isso
# e' so' pro SQLAlchemy escolher o driver certo) - precisa do prefixo puro.
ASYNCPG_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


async def main():
    """Testa a conexao com o banco e mostra, em portugues, o que esta' errado se falhar."""
    import asyncpg

    print(f"Tentando conectar em: {ASYNCPG_URL.split('@')[-1]} (host/porta/banco, sem senha)")
    print()

    print("=== Teste 1: conexao asyncpg pura, SEM ssl ===")
    try:
        conn = await asyncpg.connect(ASYNCPG_URL, ssl=False, timeout=10)
        version = await conn.fetchval("SELECT version()")
        print(f"OK! Conectou e respondeu: {version[:50]}...")
        await conn.close()
    except Exception as e:
        print(f"FALHOU: {type(e).__name__}: {e}")

    print()
    print("=== Teste 2: conexao asyncpg pura, COM ssl='prefer' ===")
    try:
        conn = await asyncpg.connect(ASYNCPG_URL, ssl="prefer", timeout=10)
        version = await conn.fetchval("SELECT version()")
        print(f"OK! Conectou e respondeu: {version[:50]}...")
        await conn.close()
    except Exception as e:
        print(f"FALHOU: {type(e).__name__}: {e}")

    print()
    print("=== Teste 3: 5 conexoes/consultas seguidas (testa se falha sempre ou so' as vezes) ===")
    for i in range(1, 6):
        try:
            conn = await asyncpg.connect(ASYNCPG_URL, ssl=False, timeout=10)
            await conn.fetchval("SELECT 1")
            await conn.close()
            print(f"  tentativa {i}: OK")
        except Exception as e:
            print(f"  tentativa {i}: FALHOU - {type(e).__name__}: {e}")


if __name__ == "__main__":
    asyncio.run(main())
