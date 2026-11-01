"""
Logica PURA das chaves de torneio (sem banco, sem FastAPI) - facil de testar.

Dois formatos:
  - eliminatoria simples: tamanho = proxima potencia de 2; quem sobra vira "bye" (folga: passa direto da 1a rodada).
    Semeadura padrao (1 x ultimo, 2 x penultimo...): os cabecas 1 e 2 so' se enfrentam na final e os melhores
    cabecas ganham as folgas.
  - todos-contra-todos (pontos corridos): metodo do circulo; vitoria 3 pontos, empate 1, derrota 0.

Tudo trabalha com POSICOES (indices 1..n pela ordem de semente) - quem chama liga as posicoes aos competidores reais.
"""
from dataclasses import dataclass

POINTS_WIN, POINTS_DRAW = 3, 1


@dataclass(frozen=True)
class MatchSpec:
    """Uma partida a criar: rodada (1..), posicao na rodada (0..) e as sementes dos lados (None = vazio/folga)."""
    round: int
    slot: int
    seed_a: int | None
    seed_b: int | None


def bracket_size(n: int) -> int:
    """Menor potencia de 2 maior ou igual a n (minimo 2)."""
    size = 2
    while size < n:
        size *= 2
    return size


def rounds_count(n: int) -> int:
    """Quantas rodadas tem a eliminatoria simples para n competidores."""
    return bracket_size(n).bit_length() - 1


def seed_positions(size: int) -> list[int]:
    """Ordem das sementes nas posicoes da 1a rodada, ex.: 8 -> [1,8,4,5,2,7,3,6] (pares vizinhos se enfrentam)."""
    order = [1]
    while len(order) < size:
        total = len(order) * 2
        order = [x for s in order for x in (s, total + 1 - s)]
    return order


def single_elimination(n: int) -> list[MatchSpec]:
    """Todas as partidas da eliminatoria simples (1a rodada com as sementes; as demais vazias, preenchidas conforme os resultados)."""
    if n < 2:
        raise ValueError("Need at least 2 competitors")
    size = bracket_size(n)
    order = seed_positions(size)
    specs: list[MatchSpec] = []
    for slot in range(size // 2):
        a, b = order[2 * slot], order[2 * slot + 1]
        specs.append(MatchSpec(1, slot, a if a <= n else None, b if b <= n else None))
    for rnd in range(2, rounds_count(n) + 1):
        specs.extend(MatchSpec(rnd, slot, None, None) for slot in range(size // (2 ** rnd)))
    return specs


def next_match(rnd: int, slot: int) -> tuple[int, int, str]:
    """Para onde vai o vencedor da partida (rodada, posicao): (proxima rodada, proxima posicao, lado 'a' ou 'b')."""
    return rnd + 1, slot // 2, "a" if slot % 2 == 0 else "b"


def round_robin(n: int) -> list[MatchSpec]:
    """Todos-contra-todos pelo metodo do circulo; com n impar, quem pega a folga da rodada simplesmente nao joga."""
    if n < 2:
        raise ValueError("Need at least 2 competitors")
    seeds: list[int | None] = list(range(1, n + 1))
    if n % 2:
        seeds.append(None)
    m = len(seeds)
    specs: list[MatchSpec] = []
    for rnd in range(m - 1):
        slot = 0
        for i in range(m // 2):
            a, b = seeds[i], seeds[m - 1 - i]
            if a is None or b is None:
                continue
            specs.append(MatchSpec(rnd + 1, slot, a, b))
            slot += 1
        seeds = [seeds[0], seeds[-1], *seeds[1:-1]]   # gira todos menos o primeiro
    return specs


def resolve_winner(score_a: int | None, score_b: int | None, winner: str | None, allow_draw: bool) -> str | None:
    """
    Decide o lado vencedor ('a'/'b') ou None (empate, so' quando allow_draw). `winner` explicito manda (desempate/so' vencedor),
    mas nao pode contradizer um placar diferente. Sem placar nem vencedor -> ValueError.
    """
    if winner not in (None, "a", "b"):
        raise ValueError("Winner must be 'a' or 'b'")
    by_score = None
    if score_a is not None and score_b is not None and score_a != score_b:
        by_score = "a" if score_a > score_b else "b"
    if winner is not None:
        if by_score is not None and winner != by_score:
            raise ValueError("The winner does not match the score")
        return winner
    if by_score is not None:
        return by_score
    if allow_draw and score_a is not None and score_b is not None:
        return None
    raise ValueError("Enter the score or pick the winner (ties need a winner)")


def elimination_placement(total_rounds: int, lost_in_round: int | None) -> int:
    """Colocacao na eliminatoria simples: campeao 1, perdeu a final 2, perdeu a semi 3 (empatado), quartas 5, oitavas 9..."""
    if lost_in_round is None:
        return 1
    return 2 ** (total_rounds - lost_in_round) + 1


def standings(competitors: list[str], results: list[tuple[str, str, int | None, int | None]]) -> list[dict]:
    """
    Tabela do todos-contra-todos. `competitors` na ordem de semente; `results` = (id_a, id_b, pontos_a, pontos_b) das partidas ja'
    jogadas (placar None conta como 0 x 0 com vencedor decidido por quem chama - aqui so' compara os numeros; sem placar,
    use pontos 1 x 0). Ordena por pontos, saldo, pontos marcados e, por fim, pela semente.
    """
    rows = {c: {"competitorId": c, "played": 0, "wins": 0, "draws": 0, "losses": 0, "pointsFor": 0, "pointsAgainst": 0, "points": 0} for c in competitors}
    for a, b, sa, sb in results:
        sa, sb = sa or 0, sb or 0
        for me, other, mine, theirs in ((a, b, sa, sb), (b, a, sb, sa)):
            r = rows[me]
            r["played"] += 1
            r["pointsFor"] += mine
            r["pointsAgainst"] += theirs
            if mine > theirs:
                r["wins"] += 1
                r["points"] += POINTS_WIN
            elif mine == theirs:
                r["draws"] += 1
                r["points"] += POINTS_DRAW
            else:
                r["losses"] += 1
    order = {c: i for i, c in enumerate(competitors)}
    return sorted(rows.values(), key=lambda r: (-r["points"], -(r["pointsFor"] - r["pointsAgainst"]), -r["pointsFor"], order[r["competitorId"]]))
