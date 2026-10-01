"""
Configuracao da conexao assincrona com o Postgres via SQLAlchemy.

Este arquivo cria o "engine" (o objeto que sabe como falar com o banco)
e a fabrica de sessoes (AsyncSessionLocal), que e' o que cada endpoint
da API vai usar para consultar/gravar dados.
"""
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# engine: objeto que gerencia o pool de conexoes com o Postgres.
# settings.database_url vem do .env (ex: postgresql+asyncpg://user:senha@host:5432/db).
# echo=True (so' em desenvolvimento) faz o SQLAlchemy imprimir no terminal
# cada comando SQL que ele gera - util para debugar, mas poluido/lento
# para rodar em producao, por isso so' liga quando environment=="development".
#
# pool_pre_ping=True e pool_recycle=300 - ESSENCIAIS no Windows com
# Docker Desktop: a rede da WSL2 as vezes derruba silenciosamente uma
# conexao TCP ociosa com o container do Postgres (o container continua
# de pe', mas aquela conexao especifica morre). Sem essas duas opcoes,
# o SQLAlchemy tenta reaproveitar essa conexao morta do pool e todo
# request falha com "ConnectionDoesNotExistError: connection was
# closed in the middle of operation" - MESMO com o banco funcionando
# perfeitamente. pool_pre_ping testa a conexao (um "SELECT 1" barato)
# antes de entregar ela pra' um request, descartando e recriando se
# estiver morta; pool_recycle=300 forca a troca de qualquer conexao
# com mais de 5 minutos, antes que ela tenha chance de ficar velha
# demais e ser derrubada.
engine = create_async_engine(
    settings.database_url,
    echo=(settings.environment == "development"),
    pool_pre_ping=True,
    pool_recycle=300,
)

# AsyncSessionLocal: fabrica de sessoes. Uma "sessao" e' o objeto que
# representa uma conversa com o banco (parecido com abrir uma transacao).
# expire_on_commit=False evita que os objetos Python "expirem" (fiquem
# inuteis) depois de um commit - sem isso, tentar ler um atributo de
# um objeto logo apos salvar ele dispararia uma nova consulta ao banco
# sem necessidade.
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    """
    Dependency do FastAPI: entrega uma sessao de banco por requisicao.

    "Dependency" no FastAPI e' uma funcao que o proprio framework chama
    automaticamente antes de rodar o endpoint, injetando o resultado
    como argumento. Uso tipico em um endpoint futuro:

        @app.get("/mobs")
        async def listar_mobs(db: AsyncSession = Depends(get_db)):
            ...

    O "async with" garante que a sessao e' fechada sozinha no final da
    requisicao (sucesso ou erro), sem precisar lembrar de fechar na mao.
    """
    async with AsyncSessionLocal() as session:
        yield session
