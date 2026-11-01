// Textos do sistema de TORNEIOS e dos PERFIS de jogadores (paginas /tournaments, /players/[id], /profile e /admin/tournaments).
// Fica num arquivo proprio so' para nao inchar lib/i18n.ts; o dicionario principal (lib/i18n.ts) importa daqui, entao o contrato dos dois
// idiomas continua o mesmo: TournamentsDict exige as MESMAS chaves em ingles (principal) e portugues. `{n}`, `{a}`, `{b}` sao trocados por fill().

/** Troca {chave} pelo valor (ex.: fill('{n} entries', { n: 3 }) -> '3 entries'). */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

const en = {
  // lista
  title: 'Tournaments', subtitle: 'Brackets for Chunin Exams and community events in Nin Online. Anyone can read; sign in with Discord to create or join one.',
  create: 'Create tournament', myProfile: 'My profile', all: 'All', mine: 'My tournaments', searchPlaceholder: 'Search by name...',
  empty: 'No tournaments here yet.', loadError: 'Could not load the tournaments.', entries: '{n} entries', phasesCount: '{n} phases', by: 'by {name}',
  champion: 'Champion: {name}', startsOn: 'Starts {date}', loadMore: 'Load more', signInToCreate: 'Sign in with Discord to create a tournament.',
  signIn: 'Sign in with Discord', signOutHint: 'Signed in as {name}', hiddenBadge: 'Hidden by moderators', unlistedBadge: 'Unlisted',
  statusDraft: 'Draft', statusOpen: 'Registration open', statusRunning: 'In progress', statusFinished: 'Finished',
  // formulario
  newTitle: 'New tournament', newSubtitle: 'You become the organizer: only you can edit it, manage entries, build the brackets and enter the scores.',
  nameLabel: 'Name', namePlaceholder: 'Chunin Exam - Season 1', descLabel: 'Description', descPlaceholder: 'Rules, prizes, how to join...',
  descHint: 'Plain text. Maximum 2000 characters.', startsAtLabel: 'Planned date (optional)', startsAtHint: 'Just an estimate shown on the page.',
  visibilityLabel: 'Visibility', visibilityPublic: 'Public (listed)', visibilityUnlisted: 'Unlisted (only people with the link)',
  save: 'Save', saving: 'Saving...', cancel: 'Cancel', createSubmit: 'Create tournament', createError: 'Could not create the tournament.',
  errRequired: 'This field is required.', errTooShort: 'Too short.', errTooLong: 'Too long.',
  // pagina do torneio
  back: 'All tournaments', notFound: 'Tournament not found. It may be a draft, hidden or removed.', loadingError: 'Could not load this tournament.',
  hiddenNotice: 'This tournament was hidden by the moderators. Only you can see it, and it cannot be edited.', share: 'Copy link', copied: 'Link copied',
  organizerLabel: 'Organizer', tabBracket: 'Bracket', tabPodium: 'Podium', podiumPending: 'The podium appears when the tournament ends.', podiumLabel: 'Tournament podium', podiumTbd: 'Awaiting result', podiumThird: 'Tied for 3rd', tabManage: 'Manage', noPhases: 'No phases yet.',
  noBracketYet: 'The bracket for this phase has not been built yet.', teamMode: '{n}v{n}', teamModeCustom: 'Custom {n}v{n}',
  formatSingle: 'Single elimination', formatRoundRobin: 'Round robin', phaseSetup: 'Not started', phaseRunning: 'In progress', phaseFinished: 'Finished',
  bye: 'Bye', tbd: 'To be decided', roundN: 'Round {n}', roundFinal: 'Final', roundSemi: 'Semifinals', roundQuarter: 'Quarterfinals',
  standings: 'Standings', colPos: '#', colName: 'Competitor', colPlayed: 'P', colWins: 'W', colDraws: 'D', colLosses: 'L', colPoints: 'Pts', colDiff: 'Diff',
  matchN: 'Match {n}', winner: 'Winner', members: 'Members', scrollHint: 'Drag or scroll sideways to see the whole bracket.',
  join: 'Join tournament', leave: 'Leave tournament', joined: 'You are in this tournament.', signInToJoin: 'Sign in with Discord to join.',
  registrationClosed: 'Registration is closed.', registrationNotOpen: 'Registration is not open yet.', entriesTitle: 'Entries ({n})', noEntries: 'Nobody has joined yet.',
  guest: 'Guest', place: 'Place #{n}', seedN: 'Seed {n}', profileOf: 'View profile', actionError: 'The action failed. Try again.',
  // visual novo
  zoomIn: 'Zoom in', zoomOut: 'Zoom out', championTitle: 'Champion', inviteJoin: 'Registration is open! Sign in with Discord to join this tournament.',
  filterLabel: 'Filter by status', emptyHint: 'Be the first: sign in with Discord and create one.', emptyMine: 'You have no tournaments yet.',
  matchPending: 'Ready to play', matchDone: 'Completed', matchWaiting: 'Waiting for opponents',
  // organizador
  panelTitle: 'Organizer panel', panelHint: 'Only you see this. Staff can only moderate.', detailsTitle: 'Details', statusLabel: 'Status',
  openRegistration: 'Open registration', closeRegistration: 'Close registration and start', backToDraft: 'Back to draft', deleteTournament: 'Delete tournament',
  confirmDelete: 'Delete this tournament, its entries and brackets for good?', addGuest: 'Add participant without account', guestPlaceholder: 'Player name',
  add: 'Add', remove: 'Remove', moveUp: 'Move up', moveDown: 'Move down', entriesLocked: 'Entries can only change before the tournament starts.',
  phasesTitle: 'Phases', phasesHint: 'Create as many phases as you need (for example 3v3, then 2v2, then 1v1). Phases run in order.',
  newPhase: 'New phase', phaseName: 'Phase name', phaseNamePlaceholder: 'Phase 1', teamSizeLabel: 'Team mode', teamSizeCustom: 'Custom size (1-10)',
  formatLabel: 'Bracket format', createPhase: 'Add phase', deletePhase: 'Delete phase', confirmDeletePhase: 'Delete this phase?',
  buildTitle: 'Build the bracket', buildHint: 'Pick who plays this phase. The order is the seeding (first = seed 1). With a number of competitors that is not a power of 2, the top seeds get a bye.',
  suggestFill: 'Fill with suggested', suggestHint: 'Suggested: winners of the previous phase (everyone in the first one). You can change it.', shuffle: 'Shuffle',
  addTeam: 'Add team', teamN: 'Team {n}', teamName: 'Team name (optional; empty shows the player names)', pickMember: 'Pick a member', needMembers: 'Each team needs exactly {n} member(s), without repeats.',
  needTwo: 'At least 2 competitors.', startPhase: 'Generate bracket', previousFirst: 'Finish the previous phase first.', resetBracket: 'Undo bracket',
  confirmReset: 'Undo this bracket and go back to building it?', finishPhase: 'Finish phase', reopenPhase: 'Reopen phase', finishTournament: 'Finish tournament and crown the champion',
  confirmFinishTournament: 'Finish the tournament? The champion goes to the player profiles.', reopenTournament: 'Reopen tournament', removeFromList: 'Remove from list',
  enterResult: 'Score', editResult: 'Edit score', scoreA: 'Score A', scoreB: 'Score B', winnerPick: 'Winner (optional if the scores differ)', winnerNone: 'Decided by score',
  saveResult: 'Save result', resultHint: 'Enter the scores, or just pick the winner. Ties need a winner (except in round robin). The winner advances by itself.',
  correctionHint: 'Changing a winner is refused if the next match already has a result: correct that one first.',
  // perfil
  profileTitle: 'My profile', profileSubtitle: 'This is what other players see on your public page and in tournaments.', gameNameLabel: 'In-game name',
  gameNamePlaceholder: 'Your Nin Online character', villageLabel: 'Village', rankLabel: 'Ninja rank', noneOption: 'Not set', saved: 'Profile saved.',
  saveError: 'Could not save the profile.', discordName: 'Discord name', viewPublic: 'View public page', editProfile: 'Edit profile',
  statTournaments: 'Tournaments', statWins: 'Wins', statLosses: 'Losses', statTitles: 'Titles', historyTitle: 'Tournament history', trophiesTitle: 'Trophies',
  noHistory: 'No tournaments yet.', playerNotFound: 'Player not found.', signInProfile: 'Sign in with Discord to edit your profile.', wl: '{w}W - {l}L',
  resultChampion: 'Champion', resultPlace: 'Place #{n}', resultPlayed: 'Played', privacyNote: 'Only the name, village and rank you choose here are public. Your Discord ID is never shown.',
  // painel da equipe
  adminTitle: 'Tournaments', adminSubtitle: 'Community tournaments. Staff only moderate: hide, fix text or delete. The organizer runs the tournament.',
  adminSearch: 'Search by name or organizer...', adminFilterAll: 'All', adminFilterHidden: 'Hidden', adminRefresh: 'Refresh', adminOrganizer: 'Organizer',
  adminHide: 'Hide', adminShow: 'Show', adminDelete: 'Delete', adminConfirmDelete: 'Delete this tournament for good?', adminRename: 'Fix name', adminOpenPage: 'Open page',
  adminHiddenBy: 'hidden by {name}', adminBanned: 'organizer banned', adminEmpty: 'No tournaments found.', adminError: 'Could not complete the action.', adminSaved: 'Saved.',
  // visibilidade pelo organizador
  visibleLabel: 'Visibility to the public', visibleOn: 'Visible to the public', visibleOff: 'Hidden (only you can see it)', makeVisible: 'Make visible', makeHidden: 'Hide',
  hiddenByYouNotice: 'Hidden: nobody but you can see this tournament. It is not listed and its link shows nothing to others until you make it visible.',
  hiddenByYouBadge: 'Hidden', newHiddenNotice: 'Nobody but you sees this tournament until you make it visible.', newPublishNow: 'Make it visible to everyone right away',
  visibleHint: 'Hide it while you are still setting up phases and entries; publish when it is ready.', staffLockedNotice: 'The moderators hid this tournament, so you cannot change its visibility.',
  // importar lista de inscritos
  importList: 'Import list', importTitle: 'Import entries', importHint: 'One name per line. For a TEAM use "Team name: Player 1, Player 2" or, without a team name, "Player 1 + Player 2" (the team then shows its players\' names). Names separated by comma and CSV lines (name;seed) also work. Nothing is added until you confirm.',
  importPlaceholder: 'Naruto\nSakura;3\nTeam Alpha: Sasuke, Kakashi\nItachi + Kisame', importDropHint: 'You can also drop a .txt or .csv file here (it is read in your browser).',
  importPreview: '{n} players ({teams} teams) to add, {skipped} skipped, {empty} empty ignored.', importPreviewList: 'Preview of what will be added', importTeamTooBig: 'team with more than 10 players', importConfirm: 'Import {n} players', importAtStart: 'Add at the start of the seeding (default: at the end)',
  importDuplicate: 'duplicate (same name ignoring case and accents)', importTooLong: 'name longer than 60 characters', importInvalid: 'invalid name', importFull: 'tournament is full (256 entries)',
  importFileTooBig: 'File too large (max 1 MB).',
};

export type TournamentsDict = Record<keyof typeof en, string>;

const pt: TournamentsDict = {
  title: 'Torneios', subtitle: 'Chaves para Exames Chunin e eventos da comunidade do Nin Online. Qualquer pessoa pode ler; entre com o Discord para criar ou participar.',
  create: 'Criar torneio', myProfile: 'Meu perfil', all: 'Todos', mine: 'Meus torneios', searchPlaceholder: 'Buscar pelo nome...',
  empty: 'Ainda não há torneios aqui.', loadError: 'Não foi possível carregar os torneios.', entries: '{n} inscritos', phasesCount: '{n} fases', by: 'por {name}',
  champion: 'Campeão: {name}', startsOn: 'Começa em {date}', loadMore: 'Carregar mais', signInToCreate: 'Entre com o Discord para criar um torneio.',
  signIn: 'Entrar com o Discord', signOutHint: 'Entrou como {name}', hiddenBadge: 'Escondido pela moderação', unlistedBadge: 'Não listado',
  statusDraft: 'Rascunho', statusOpen: 'Inscrições abertas', statusRunning: 'Em andamento', statusFinished: 'Encerrado',
  newTitle: 'Novo torneio', newSubtitle: 'Você será o organizador: só você edita, gerencia inscritos, monta as chaves e lança os placares.',
  nameLabel: 'Nome', namePlaceholder: 'Exame Chunin - Temporada 1', descLabel: 'Descrição', descPlaceholder: 'Regras, prêmios, como participar...',
  descHint: 'Texto simples. Máximo de 2000 caracteres.', startsAtLabel: 'Data prevista (opcional)', startsAtHint: 'Só uma estimativa mostrada na página.',
  visibilityLabel: 'Visibilidade', visibilityPublic: 'Público (aparece na lista)', visibilityUnlisted: 'Não listado (só quem tem o link)',
  save: 'Salvar', saving: 'Salvando...', cancel: 'Cancelar', createSubmit: 'Criar torneio', createError: 'Não foi possível criar o torneio.',
  errRequired: 'Campo obrigatório.', errTooShort: 'Curto demais.', errTooLong: 'Longo demais.',
  back: 'Todos os torneios', notFound: 'Torneio não encontrado. Pode ser um rascunho, estar escondido ou ter sido removido.', loadingError: 'Não foi possível carregar este torneio.',
  hiddenNotice: 'Este torneio foi escondido pela moderação. Só você o vê e ele não pode ser editado.', share: 'Copiar link', copied: 'Link copiado',
  organizerLabel: 'Organizador', tabBracket: 'Chave', tabPodium: 'Pódio', podiumPending: 'O pódio aparece quando o torneio terminar.', podiumLabel: 'Pódio do torneio', podiumTbd: 'Aguardando resultado', podiumThird: 'Empate no 3º lugar', tabManage: 'Gerenciar', noPhases: 'Ainda não há fases.',
  noBracketYet: 'A chave desta fase ainda não foi montada.', teamMode: '{n}v{n}', teamModeCustom: 'Personalizado {n}v{n}',
  formatSingle: 'Eliminatória simples', formatRoundRobin: 'Todos contra todos', phaseSetup: 'Não iniciada', phaseRunning: 'Em andamento', phaseFinished: 'Concluída',
  bye: 'Folga', tbd: 'A definir', roundN: 'Rodada {n}', roundFinal: 'Final', roundSemi: 'Semifinais', roundQuarter: 'Quartas de final',
  standings: 'Classificação', colPos: '#', colName: 'Competidor', colPlayed: 'J', colWins: 'V', colDraws: 'E', colLosses: 'D', colPoints: 'Pts', colDiff: 'Saldo',
  matchN: 'Partida {n}', winner: 'Vencedor', members: 'Integrantes', scrollHint: 'Arraste ou role para o lado para ver a chave inteira.',
  join: 'Participar do torneio', leave: 'Sair do torneio', joined: 'Você está neste torneio.', signInToJoin: 'Entre com o Discord para participar.',
  registrationClosed: 'As inscrições estão fechadas.', registrationNotOpen: 'As inscrições ainda não abriram.', entriesTitle: 'Inscritos ({n})', noEntries: 'Ninguém se inscreveu ainda.',
  guest: 'Convidado', place: '{n}º lugar', seedN: 'Semente {n}', profileOf: 'Ver perfil', actionError: 'A ação falhou. Tente de novo.',
  panelTitle: 'Painel do organizador', panelHint: 'Só você vê isto. A equipe do site só modera.', detailsTitle: 'Detalhes', statusLabel: 'Estado',
  openRegistration: 'Abrir inscrições', closeRegistration: 'Fechar inscrições e iniciar', backToDraft: 'Voltar para rascunho', deleteTournament: 'Apagar torneio',
  confirmDelete: 'Apagar de vez este torneio, os inscritos e as chaves?', addGuest: 'Adicionar participante sem conta', guestPlaceholder: 'Nome do jogador',
  add: 'Adicionar', remove: 'Remover', moveUp: 'Subir', moveDown: 'Descer', entriesLocked: 'Os inscritos só mudam antes de o torneio começar.',
  phasesTitle: 'Fases', phasesHint: 'Crie quantas fases precisar (por exemplo 3v3, depois 2v2, depois 1v1). As fases acontecem em ordem.',
  newPhase: 'Nova fase', phaseName: 'Nome da fase', phaseNamePlaceholder: 'Fase 1', teamSizeLabel: 'Modo de equipe', teamSizeCustom: 'Tamanho livre (1-10)',
  formatLabel: 'Formato da chave', createPhase: 'Adicionar fase', deletePhase: 'Apagar fase', confirmDeletePhase: 'Apagar esta fase?',
  buildTitle: 'Montar a chave', buildHint: 'Escolha quem joga esta fase. A ordem é a semeadura (o primeiro é a semente 1). Se o número de competidores não for potência de 2, as melhores sementes ganham folga.',
  suggestFill: 'Preencher com os sugeridos', suggestHint: 'Sugestão: quem venceu a fase anterior (na primeira, todos). Você pode mudar.', shuffle: 'Embaralhar',
  addTeam: 'Adicionar equipe', teamN: 'Equipe {n}', teamName: 'Nome da equipe (opcional; vazio mostra o nome dos jogadores)', pickMember: 'Escolha um integrante', needMembers: 'Cada equipe precisa de exatamente {n} integrante(s), sem repetir.',
  needTwo: 'No mínimo 2 competidores.', startPhase: 'Gerar chave', previousFirst: 'Conclua a fase anterior primeiro.', resetBracket: 'Desfazer chave',
  confirmReset: 'Desfazer esta chave e voltar a montá-la?', finishPhase: 'Concluir fase', reopenPhase: 'Reabrir fase', finishTournament: 'Encerrar torneio e coroar o campeão',
  confirmFinishTournament: 'Encerrar o torneio? O campeão vai para os perfis dos jogadores.', reopenTournament: 'Reabrir torneio', removeFromList: 'Tirar da lista',
  enterResult: 'Placar', editResult: 'Editar placar', scoreA: 'Pontos A', scoreB: 'Pontos B', winnerPick: 'Vencedor (opcional se os pontos forem diferentes)', winnerNone: 'Decidido pelo placar',
  saveResult: 'Salvar resultado', resultHint: 'Informe os pontos ou só escolha o vencedor. Empate precisa de vencedor (exceto no todos contra todos). O vencedor avança sozinho.',
  correctionHint: 'Trocar o vencedor é recusado se a partida seguinte já tem resultado: corrija essa primeiro.',
  zoomIn: 'Aumentar', zoomOut: 'Diminuir', championTitle: 'Campeão', inviteJoin: 'Inscrições abertas! Entre com o Discord para participar deste torneio.',
  filterLabel: 'Filtrar por estado', emptyHint: 'Seja o primeiro: entre com o Discord e crie um.', emptyMine: 'Você ainda não tem torneios.',
  matchPending: 'Pronta para jogar', matchDone: 'Concluída', matchWaiting: 'Aguardando oponentes',
  profileTitle: 'Meu perfil', profileSubtitle: 'É isto que os outros jogadores veem na sua página pública e nos torneios.', gameNameLabel: 'Nome no jogo',
  gameNamePlaceholder: 'Seu personagem do Nin Online', villageLabel: 'Vila', rankLabel: 'Rank ninja', noneOption: 'Não definido', saved: 'Perfil salvo.',
  saveError: 'Não foi possível salvar o perfil.', discordName: 'Nome no Discord', viewPublic: 'Ver página pública', editProfile: 'Editar perfil',
  statTournaments: 'Torneios', statWins: 'Vitórias', statLosses: 'Derrotas', statTitles: 'Títulos', historyTitle: 'Histórico de torneios', trophiesTitle: 'Troféus',
  noHistory: 'Nenhum torneio ainda.', playerNotFound: 'Jogador não encontrado.', signInProfile: 'Entre com o Discord para editar seu perfil.', wl: '{w}V - {l}D',
  resultChampion: 'Campeão', resultPlace: '{n}º lugar', resultPlayed: 'Participou', privacyNote: 'Só o nome, a vila e o rank que você escolher aqui são públicos. Seu ID do Discord nunca aparece.',
  adminTitle: 'Torneios', adminSubtitle: 'Torneios da comunidade. A equipe só modera: esconder, corrigir texto ou apagar. Quem comanda o torneio é o organizador.',
  adminSearch: 'Buscar por nome ou organizador...', adminFilterAll: 'Todos', adminFilterHidden: 'Escondidos', adminRefresh: 'Atualizar', adminOrganizer: 'Organizador',
  adminHide: 'Esconder', adminShow: 'Mostrar', adminDelete: 'Apagar', adminConfirmDelete: 'Apagar este torneio de vez?', adminRename: 'Corrigir nome', adminOpenPage: 'Abrir página',
  adminHiddenBy: 'escondido por {name}', adminBanned: 'organizador banido', adminEmpty: 'Nenhum torneio encontrado.', adminError: 'Não foi possível concluir a ação.', adminSaved: 'Salvo.',
  // visibilidade pelo organizador
  visibleLabel: 'Visibilidade para o público', visibleOn: 'Visível ao público', visibleOff: 'Oculto (só você vê)', makeVisible: 'Tornar visível', makeHidden: 'Ocultar',
  hiddenByYouNotice: 'Oculto: ninguém além de você vê este torneio. Ele não aparece na lista e o link não mostra nada para os outros até você torná-lo visível.',
  hiddenByYouBadge: 'Oculto', newHiddenNotice: 'Ninguém além de você vê este torneio até você torná-lo visível.', newPublishNow: 'Deixar visível para todos já',
  visibleHint: 'Oculte enquanto ainda arruma fases e inscritos; publique quando estiver pronto.', staffLockedNotice: 'A moderação escondeu este torneio, então você não pode mudar a visibilidade.',
  // importar lista de inscritos
  importList: 'Importar lista', importTitle: 'Importar inscritos', importHint: 'Um nome por linha. Para uma EQUIPE use "Nome da equipe: Jogador 1, Jogador 2" ou, sem nome de equipe, "Jogador 1 + Jogador 2" (a equipe então aparece com o nome dos jogadores). Nomes separados por vírgula e linhas CSV (nome;seed) também funcionam. Nada é adicionado até você confirmar.',
  importPlaceholder: 'Naruto\nSakura;3\nEquipe Alfa: Sasuke, Kakashi\nItachi + Kisame', importDropHint: 'Você também pode soltar um arquivo .txt ou .csv aqui (ele é lido no seu navegador).',
  importPreview: '{n} jogadores ({teams} equipes) para adicionar, {skipped} ignorados, {empty} vazios descartados.', importPreviewList: 'Prévia do que será adicionado', importTeamTooBig: 'equipe com mais de 10 jogadores', importConfirm: 'Importar {n} jogadores', importAtStart: 'Adicionar no início das sementes (padrão: no fim)',
  importDuplicate: 'duplicado (mesmo nome sem contar maiúsculas e acentos)', importTooLong: 'nome com mais de 60 caracteres', importInvalid: 'nome inválido', importFull: 'torneio lotado (256 inscritos)',
  importFileTooBig: 'Arquivo grande demais (máx. 1 MB).',
};

export const tournamentsEn: TournamentsDict = en;
export const tournamentsPt: TournamentsDict = pt;
