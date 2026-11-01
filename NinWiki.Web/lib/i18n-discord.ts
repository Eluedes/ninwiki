// Textos da ligacao Discord -> perfil: menu do usuario logado (cabecalho), origem de vila/rank no perfil e a tela /admin/discord-links.
// Arquivo proprio so' para nao inchar lib/i18n.ts; o dicionario principal importa daqui (chave `discord`), com as MESMAS chaves em ingles (principal) e portugues.
// `{guild}`, `{name}` e `{n}` sao trocados por fill() (lib/i18n-tournaments.ts).

const en = {
  // menu do usuario (cabecalho)
  signIn: 'Sign in with Discord', menuLabel: 'Account menu', myProfile: 'My profile', myTournaments: 'My tournaments', adminPanel: 'Staff panel', signOut: 'Sign out',
  signingOut: 'Signing out...', signedInAs: 'Signed in as {name}', signOutError: 'Could not sign out. Try again.',
  // perfil: vila e rank somente leitura
  readOnlyHint: 'Village and rank are filled in automatically by the bot from your roles on Discord. You cannot edit them here; only your in-game name.',
  sourceDiscord: 'Set by your role on the Discord server "{guild}".',
  sourceDefault: 'Default: the bot did not find a village or rank role for you on any server it is in.',
  syncHint: 'Changes to your Discord roles show up within moments (the bot also double-checks every 30 minutes).',
  // painel
  adminTitle: 'Discord links', adminSubtitle: 'The players\' village and ninja rank are filled in from their roles on the Discord servers where the bot is. Map each server to a village and, when the role name is not already the rank name, each role to a rank.',
  adminRules: 'A role whose name equals a rank (Chunin, Genin...) counts automatically. With several servers, the one where the player has the highest rank wins (a tie goes to the most recent update). Nothing found = Takumi village and Rogue rank.',
  adminEmpty: 'The bot has not reported any server yet. Check that it is running with the Server Members Intent turned on.', adminRefresh: 'Refresh',
  adminLoadError: 'Could not load the Discord links.', adminSaved: 'Saved. The profiles of the players of this server were updated.', adminSaveError: 'Could not save.',
  guildVillage: 'Village of this server', noVillage: 'No village', roleColumn: 'Discord role', rankColumn: 'Ninja rank', byName: 'By role name (automatic)',
  readersCount: '{n} players with roles read here', inactive: 'The bot is no longer in this server (the mapping is kept).', noRoles: 'No roles reported for this server.',
  save: 'Save', saving: 'Saving...', loading: 'Loading',
  // painel do bot (/admin/bot)
  botTitle: 'Bot servers', botSubtitle: 'The Discord servers where the bot is, with the server ID, the number of members and the roles (with their IDs). Read-only: the bot reports this list on its own.',
  botEmpty: 'The bot has not reported any server yet.', serverId: 'Server ID', membersCount: '{n} members', membersUnknown: 'members: not reported yet (restart the bot)',
  rolesTitle: 'Roles ({n})', roleIdColumn: 'Role ID', copyId: 'Copy ID', copied: 'Copied', filterRoles: 'Filter roles by name or ID', noRoleMatch: 'No role matches.', activeBadge: 'Active', inactiveBadge: 'Inactive',
  // lista de membros do servidor (/admin/bot)
  membersTitle: 'Members ({n})', memberSearch: 'Search by name or ID', memberColumn: 'Member', memberIdColumn: 'Discord ID', memberRolesColumn: 'Roles', botTag: 'Bot', noMemberMatch: 'No member matches.',
  membersPageInfo: '{from}-{to} of {total}', prevPage: 'Previous', nextPage: 'Next', membersLoadError: 'Could not load the members.',
  membersNotSynced: 'Not synced yet. The bot is not reading the members: turn on the Server Members Intent in the Discord Developer Portal (Bot > Privileged Gateway Intents), make sure MEMBER_LIST_SYNC is not false, and restart the bot.',
  membersPartial: 'Partial list: this server has more members than the limit ({n} stored).', membersSyncedAt: 'Last sync: {date}', membersNoRoles: 'no roles', membersOpen: 'Show members',
};

export type DiscordDict = Record<keyof typeof en, string>;
export const discordEn: DiscordDict = en;

export const discordPt: DiscordDict = {
  signIn: 'Entrar com Discord', menuLabel: 'Menu da conta', myProfile: 'Meu perfil', myTournaments: 'Meus torneios', adminPanel: 'Painel da equipe', signOut: 'Sair',
  signingOut: 'Saindo...', signedInAs: 'Conectado como {name}', signOutError: 'Não foi possível sair. Tente de novo.',
  readOnlyHint: 'A vila e o rank são preenchidos automaticamente pelo bot a partir dos seus cargos no Discord. Aqui você só edita o seu nome no jogo.',
  sourceDiscord: 'Definido pelo seu cargo no servidor "{guild}" do Discord.',
  sourceDefault: 'Padrão: o bot não encontrou cargo de vila ou de rank para você em nenhum servidor em que ele está.',
  syncHint: 'Mudanças nos seus cargos do Discord aparecem em instantes (o bot também confere tudo a cada 30 minutos).',
  adminTitle: 'Ligações com o Discord', adminSubtitle: 'A vila e o rank ninja dos jogadores são preenchidos pelos cargos deles nos servidores do Discord onde o bot está. Ligue cada servidor a uma vila e, quando o nome do cargo não for igual ao do rank, ligue cada cargo a um rank.',
  adminRules: 'Um cargo com o mesmo nome de um rank (Chunin, Genin...) já vale sozinho. Com vários servidores, vale aquele em que o jogador tem o MAIOR rank (empate: a atualização mais recente). Nada encontrado = vila Takumi e rank Rogue.',
  adminEmpty: 'O bot ainda não informou nenhum servidor. Confira se ele está ligado com a Server Members Intent ativada.', adminRefresh: 'Atualizar',
  adminLoadError: 'Não foi possível carregar as ligações com o Discord.', adminSaved: 'Salvo. Os perfis dos jogadores deste servidor foram atualizados.', adminSaveError: 'Não foi possível salvar.',
  guildVillage: 'Vila deste servidor', noVillage: 'Sem vila', roleColumn: 'Cargo do Discord', rankColumn: 'Rank ninja', byName: 'Pelo nome do cargo (automático)',
  readersCount: '{n} jogadores com cargos lidos aqui', inactive: 'O bot não está mais neste servidor (a ligação fica guardada).', noRoles: 'Nenhum cargo informado para este servidor.',
  save: 'Salvar', saving: 'Salvando...', loading: 'Carregando',
  botTitle: 'Servidores do bot', botSubtitle: 'Os servidores do Discord onde o bot está, com o ID do servidor, a quantidade de membros e os cargos (com os IDs). Só leitura: o próprio bot informa esta lista.',
  botEmpty: 'O bot ainda não informou nenhum servidor.', serverId: 'ID do servidor', membersCount: '{n} membros', membersUnknown: 'membros: ainda não informado (reinicie o bot)',
  rolesTitle: 'Cargos ({n})', roleIdColumn: 'ID do cargo', copyId: 'Copiar ID', copied: 'Copiado', filterRoles: 'Filtrar cargos por nome ou ID', noRoleMatch: 'Nenhum cargo encontrado.', activeBadge: 'Ativo', inactiveBadge: 'Inativo',
  // lista de membros do servidor (/admin/bot)
  membersTitle: 'Membros ({n})', memberSearch: 'Buscar por nome ou ID', memberColumn: 'Membro', memberIdColumn: 'ID do Discord', memberRolesColumn: 'Cargos', botTag: 'Bot', noMemberMatch: 'Nenhum membro encontrado.',
  membersPageInfo: '{from}-{to} de {total}', prevPage: 'Anterior', nextPage: 'Próxima', membersLoadError: 'Não foi possível carregar os membros.',
  membersNotSynced: 'Ainda não sincronizado. O bot não está lendo os membros: ligue a Server Members Intent no Discord Developer Portal (Bot > Privileged Gateway Intents), confira que MEMBER_LIST_SYNC não está false e reinicie o bot.',
  membersPartial: 'Lista parcial: este servidor tem mais membros que o limite ({n} guardados).', membersSyncedAt: 'Última sincronização: {date}', membersNoRoles: 'sem cargos', membersOpen: 'Mostrar membros',
};
