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
    def __init__(self, time_fn: Callable[[], float] = time.monotonic):
        self._time = time_fn
        self._hits: dict[tuple[str, str], deque[float]] = {}

    def _window(self, bucket: str, key: str, window: float) -> deque[float]:
        dq = self._hits.setdefault((bucket, key), deque())
        cutoff = self._time() - window
        while dq and dq[0] <= cutoff:
            dq.popleft()
        return dq

    def _cleanup(self) -> None:
        # Memoria limitada: se acumularem muitas chaves (ataque com IPs variados), joga fora as vazias.
        if len(self._hits) > 5000:
            for k in [k for k, dq in self._hits.items() if not dq]:
                del self._hits[k]

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
        return max(1, int(dq[0] + window - self._time()) + 1)

    def reset(self) -> None:
        self._hits.clear()


limiter = RateLimiter()

# Nomes dos baldes
AUTH = "auth"            # requisicoes de login por minuto
LOGIN_FAIL = "login_fail"  # logins negados / estado invalido
BOT_FAIL = "bot_fail"    # token de bot errado


def client_key() -> str:
    return client_ip_var.get() or "desconhecido"


def retry_message(seconds: int) -> str:
    return f"Muitas tentativas. Tente de novo em {seconds} segundos."
