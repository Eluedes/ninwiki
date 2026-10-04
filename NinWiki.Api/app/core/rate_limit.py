"""
Limite de tentativas (rate limit) - protege login e a API do bot.

O QUE ELE EVITA:
  - Alguem com QUALQUER conta do Discord ficar tentando entrar como staff para ENCHER o log
    de seguranca de linhas "login negado" (cada tentativa gravaria uma).
  - Adivinhacao de senha: do BOT_API_TOKEN (rotas /bot) e do login de desenvolvimento.
  - Martelar o Discord (a callback chama a API do Discord) e levar a API a ser limitada la'.

COMO FUNCIONA: janela deslizante por IP, guardada em memoria (sem Redis, sem dependencia
nova). Dois tipos de "balde":
  - de REQUISICOES (`hit`): toda chamada conta; passou do limite na janela = bloqueia.
  - de FALHAS (`blocked` + `fail`): so' tentativas que DERAM ERRADO contam; quem errou
    demais fica bloqueado ate' a janela andar - inclusive se depois acertar.

LIMITACOES CONHECIDAS (de proposito, pra' manter simples):
  - E' por PROCESSO: com varios processos/servidores da API cada um tem o seu contador
    (o limite efetivo fica maior). Com uma instancia so' - o caso de hoje - e' exato.
    Se um dia houver varias, troque o armazenamento por Redis (a interface e' a mesma).
  - O contador zera se a API reiniciar.
  - A chave e' o IP: atras de um proxy (Cloudflare, SquareCloud) ligue TRUST_PROXY_HEADERS=true
    no .env, senao TODO MUNDO parece ter o IP do proxy e um bloqueia todos.
"""
import time
from collections import deque
from collections.abc import Callable

from app.core.security import client_ip_var


class RateLimiter:
    """Limitador de tentativas por chave (IP), em memoria, com janela deslizante."""
    def __init__(self, time_fn: Callable[[], float] = time.monotonic):
        self._time = time_fn
        self._hits: dict[tuple[str, str], deque[float]] = {}
        self._windows: dict[tuple[str, str], float] = {}   # janela de cada balde (para a limpeza periodica saber o que ja' expirou)

    def _window(self, bucket: str, key: str, window: float) -> deque[float]:
        """Devolve a fila de instantes do balde, ja' sem os que sairam da janela."""
        dq = self._hits.setdefault((bucket, key), deque())
        self._windows[(bucket, key)] = window
        cutoff = self._time() - window
        while dq and dq[0] <= cutoff:
            dq.popleft()
        return dq

    def _cleanup(self) -> None:
        """Apaga baldes vazios para o dicionario nao crescer sem fim."""
        # Memoria limitada: se acumularem muitas chaves (ataque com IPs variados), joga fora as vazias.
        if len(self._hits) > 5000:
            for k in [k for k, dq in self._hits.items() if not dq]:
                del self._hits[k]

    def sweep(self) -> int:
        """Limpeza periodica (chamada pela manutencao): tira de cada balde o que saiu da janela e apaga os baldes vazios. Devolve quantos apagou."""
        now, removed = self._time(), 0
        for k in list(self._hits):
            dq, window = self._hits[k], self._windows.get(k, 3600.0)
            while dq and dq[0] <= now - window:
                dq.popleft()
            if not dq:
                del self._hits[k]
                self._windows.pop(k, None)
                removed += 1
        return removed

    def hit(self, bucket: str, key: str, limit: int, window: float) -> int | None:
        """Registra uma requisicao. Devolve None se PODE passar, ou os segundos de espera se estourou o limite."""
        dq = self._window(bucket, key, window)
        if len(dq) >= limit:
            return self._retry_after(dq, window)
        dq.append(self._time())
        self._cleanup()
        return None

    def blocked(self, bucket: str, key: str, limit: int, window: float) -> int | None:
        """So' consulta (nao registra): esta' bloqueado por falhas demais? Devolve segundos de espera ou None."""
        dq = self._window(bucket, key, window)
        return self._retry_after(dq, window) if len(dq) >= limit else None

    def fail(self, bucket: str, key: str, window: float) -> None:
        """Registra uma FALHA (senha errada, conta nao cadastrada...)."""
        self._window(bucket, key, window).append(self._time())
        self._cleanup()

    def _retry_after(self, dq: deque[float], window: float) -> int:
        """Segundos ate' o instante mais antigo sair da janela (quanto esperar)."""
        return max(1, int(dq[0] + window - self._time()) + 1)

    def reset(self) -> None:
        """Zera todos os contadores (usado nos testes)."""
        self._hits.clear()
        self._windows.clear()


limiter = RateLimiter()

# Nomes dos baldes
AUTH = "auth"            # requisicoes de login por minuto
LOGIN_FAIL = "login_fail"  # logins negados / estado invalido
BOT_FAIL = "bot_fail"    # token de bot errado
COMMENT = "comment"      # comentarios por leitor (anti-spam)
LIKE = "like"            # curtidas por leitor


def client_key() -> str:
    """Chave do limitador: o IP de quem chamou."""
    return client_ip_var.get() or "desconhecido"


def retry_message(seconds: int) -> str:
    """Mensagem em portugues para o 429 ('tente de novo em N segundos')."""
    return f"Too many attempts. Try again in {seconds} seconds."
