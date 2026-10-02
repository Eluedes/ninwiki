/**
 * Paginas em MANUTENCAO: quem abrir qualquer uma delas (pelo menu, por um link antigo ou digitando a URL) e' levado para /maintenance.
 * Para colocar outra pagina em manutencao, e' so' somar o caminho na lista; para liberar a pagina de volta, tirar da lista.
 * Usado pelo proxy.ts (barra antes da pagina carregar) e, como segunda camada, pelo layout da propria rota.
 */
export const MAINTENANCE_PATHS: string[] = ['/map'];

/** True se o caminho (ou uma subpagina dele) esta em manutencao. */
export function isUnderMaintenance(pathname: string): boolean {
  return MAINTENANCE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
