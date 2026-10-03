// Link de convite do bot do Wiki para um servidor do Discord (botao "Convidar o bot" no rodape e na Home).
//
// O Application ID do bot e' PUBLICO (nao e' segredo; o segredo e' o token do bot, que nunca vai para o site). Vem de
// NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID e entra no build; sem ele o botao fica escondido.
//
// Permissoes pedidas - so' o que o bot realmente usa (ver NinWiki.Bot):
//   View Channels (1024)         ver o canal onde vai postar
//   Send Messages (2048)         /search, /status, painel de status, avisos de queda, log
//   Embed Links (16384)          os avisos e o log usam embeds
//   Read Message History (65536) editar o proprio painel de status e limpar as proprias mensagens (/team clearlog)
//   Attach Files (32768)         enviar os arquivos de BACKUP no canal privado (BACKUP_CHANNEL_ID)
// Somando: 117760. Nao pede Administrator, nem gerenciar mensagens/cargos/canais, nem mencionar @everyone.
export const BOT_PERMISSIONS = 1024 + 2048 + 16384 + 32768 + 65536;

/** Endereco para convidar o bot (ou null se o Application ID nao estiver configurado/for invalido). */
export function botInviteUrl(): string | null {
  const id = (process.env.NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID ?? '').trim();
  if (!/^\d{15,22}$/.test(id)) return null;
  return `https://discord.com/oauth2/authorize?client_id=${id}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`;
}
