// Texto seguro para mostrar como "alvo" de uma linha do log de auditoria (tela do log e "Atividade recente" da Visao Geral).
//
// O `diff` do log nao tem formato unico: quase sempre `name` e' um texto, mas ao RENOMEAR uma imagem ele e' um objeto `{ before, after }`
// (ver app/api/media.py). Desenhar esse objeto direto na tela derruba o painel ("Objects are not valid as a React child"), entao o texto e' sempre escolhido aqui.

/** Se `valor` e' texto, devolve ele; se e' `{ after: texto }` (renomeacao), devolve o `after`; senao undefined. */
function comoTexto(valor: unknown): string | undefined {
  if (typeof valor === 'string' && valor.trim()) return valor;
  if (valor && typeof valor === 'object') {
    const depois = (valor as { after?: unknown }).after;
    if (typeof depois === 'string' && depois.trim()) return depois;
  }
  return undefined;
}

/** Nome mais util para a linha do log: nome (texto ou antes/depois), nome dentro de `after`, usuario da equipe, ou o id da entidade. Sempre devolve texto. */
export function auditTarget(diff: Record<string, unknown> | null | undefined, entityId: string): string {
  return (
    comoTexto(diff?.name) ??
    comoTexto((diff?.after as { name?: unknown } | undefined)?.name) ??
    comoTexto(diff?.username) ??
    entityId
  );
}
