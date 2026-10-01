// Sistema de traducao (i18n) "na mao": um dicionario de strings por
// idioma, sem biblioteca externa (next-intl, i18next, etc). Funciona
// bem na escala atual do projeto; se o numero de strings crescer muito,
// vale considerar uma lib dedicada com extracao automatica.
//
// Como usar em um componente: const { dict } = useLanguage(); depois
// dict.nav.home, dict.admin.table.edit, etc. Ver
// components/providers/language-provider.tsx para o Context que
// distribui esse dicionario pela arvore de componentes.

import type { Locale } from './types';

// A interface Dictionary e' o "contrato": toda chave que existir aqui
// tem que existir OBRIGATORIAMENTE nos dois idiomas abaixo (pt e en).
// O TypeScript acusa erro de compilacao se faltar uma chave em algum
// dos dois - e' a garantia de que nao existe texto traduzido so' num idioma.
export interface Dictionary {
  siteName: string;
  siteTagline: string;
  nav: { home: string; mobs: string; items: string; guides: string; masteries: string; weapons: string; missions: string; village: string; map: string };
  home: { welcome: string; subtitle: string; browseAll: string };
  news: { title: string; subtitle: string; readMore: string; viewAll: string };
  catalog: { level: string; levelRange: string; results: string; search: string; noResults: string; allLevels: string; filterByLevel: string; itemsFilterAll: string; itemsFilterConsumables: string; itemsFilterMaterials: string; itemsFilterEquipment: string; itemsFilterSpecial: string };
  detail: { attributes: string; drops: string; lore: string; synergy: string; copyAttributes: string; copied: string; back: string; level: string; noDrops: string; relatedEntries: string; spawnLocation: string; attacks: string; noAttacks: string; maxStack: string; castVillage: string; speed: string; requirement: string; requirementsSection: string; acquisitionSection: string; weaponDetailsSection: string; battleDataSection: string; levelReq: string; statReq: string; npc: string; weaponClass: string; weaponType: string; baseDamage: string; specialAbility: string; attackSpeed: string; statBonus: string; knockbackDistance: string };
  masteryDetail: {
    notFound: string; backToMasteries: string; elemental: string; nonElemental: string;
    aboutMastery: string; masteryPaths: string; noJutsusInPath: string; jutsusOfMastery: string;
    noJutsusYet: string; masterySheet: string; nameLabel: string; typeLabel: string; elementLabel: string;
    jutsusLabel: string; relatedAttributes: string; noAttributesConfirmed: string; paths: string;
    home: string; listSubtitle: string;
  };
  jutsuDetail: {
    notFound: string; backToJutsus: string; masteryLabel: string; pathLabel: string; noPath: string;
    tierLabel: string; chakraCostLabel: string; rangeLabel: string; castTimeLabel: string; cooldownLabel: string;
    effectLabel: string; aboutJutsu: string; jutsuSheet: string; home: string;
    tier1: string; tier2: string; tier3: string; tier4: string; tier5: string;
  };
  footer: { disclaimer: string; madeWith: string };
  admin: {
    login: { welcome: string; subtitle: string; button: string };
    // Fase 2: autenticacao, cargos, equipe e log geral
    auth: {
      checkingSession: string; logout: string; sessionExpired: string; apiUnreachable: string; retry: string;
      noAccessTitle: string; noAccessBody: string; backToOverview: string;
      errNotStaff: string; errInactive: string; errDiscordFailed: string; errDiscordDenied: string;
      errInvalidState: string; errNotConfigured: string; errGeneric: string; errRateLimited: string;
      devTitle: string; devHint: string; devPlaceholder: string; devButton: string; devError: string;
      roleSuperAdmin: string; roleAdmin: string; roleCreator: string;
      roleDescSuperAdmin: string; roleDescAdmin: string; roleDescCreator: string;
      staffTitle: string; staffSubtitle: string; addStaff: string; discordId: string; discordIdHint: string;
      displayName: string; displayNameHint: string; role: string; status: string; lastLogin: string;
      neverLoggedIn: string; active: string; inactive: string; owner: string; ownerHint: string;
      deactivate: string; activate: string; confirmDeactivate: string; you: string;
      add: string; adding: string; noStaff: string; loadError: string; actionError: string; noManageable: string;
      logByLabel: string; logAll: string; logContent: string; logAuth: string; logStaff: string; logSecurity: string;
      logActions: Record<string, string>; logEntities: Record<string, string>; logSources: Record<string, string>;
    };
    // Blog (posts) no painel
    blogAdmin: {
      subtitle: string; newPost: string; search: string; colTitle: string; colAuthor: string; colStatus: string; colUpdated: string;
      published: string; draft: string; edit: string; delete: string; confirmDelete: string; empty: string;
      loading: string; loadError: string; deleteError: string;
      editTitle: string; newTitle: string; back: string; titleLabel: string; titlePlaceholder: string;
      slugLabel: string; slugHint: string; excerptLabel: string; excerptHint: string; coverLabel: string;
      contentLabel: string; contentPlaceholder: string; saveDraft: string; publish: string; saving: string; saveError: string;
      lockedNote: string; unpublishNote: string;
    };
    // Edicao de Vilas, Clas e Organizacoes (painel)
    villagesAdmin: {
      title: string; subtitle: string; newVillage: string; manageOrgs: string;
      colName: string; colElement: string; colLeader: string; colClans: string; edit: string; delete: string;
      confirmDelete: string; empty: string; loading: string; loadError: string; deleteError: string;
      editTitle: string; newTitle: string; back: string; save: string; saving: string; saveError: string;
      idSlug: string; idSlugLocked: string; idHint: string;
      name: string; emblem: string; element: string; accentColor: string; leader: string; climate: string; motto: string; image: string;
      mapX: string; mapY: string; mapHint: string; shortDescription: string; longDescription: string;
      clansTitle: string; addClan: string; clanName: string; clanId: string; clanLevel: string; clanPrice: string; clanDescription: string;
      removeClan: string; noClans: string;
      orgsTitle: string; orgsSubtitle: string; newOrg: string; orgName: string; orgDescription: string; orgVillages: string;
      orgConfirmDelete: string; orgEmpty: string; orgSave: string; orgCancel: string; orgEditTitle: string; backToVillages: string; noVillagesYet: string;
    };
    sidebar: { overview: string; blogPosts: string; content: string; masteries: string; jutsus: string; bulkImport: string; auditLog: string; users: string; staff: string; villages: string; backToSite: string };
    header: { role: { admin: string; mod: string } };
    overview: {
      title: string; totalPosts: string; totalPages: string; totalUsers: string; recentActivity: string;
      viewAll: string; noActivity: string; system: string;
      entityContentItem: string; entityJutsu: string;
      actionCreated: string; actionUpdated: string; actionDeleted: string;
      contentByCategory: string; noEntriesYet: string;
      publishedVsDraft: string; published: string; draft: string;
      stalePages: string; daysAgo: string; nothingStale: string;
    };
    table: { title: string; category: string; author: string; status: string; actions: string; published: string; draft: string; newPost: string; edit: string; delete: string; search: string };
    editor: { titleLabel: string; categoryLabel: string; contentLabel: string; saveDraft: string; publish: string; back: string; titlePlaceholder: string; contentPlaceholder: string };
    users: { title: string; username: string; role: string; joined: string; actions: string };
    richText: {
      bold: string; italic: string; underline: string; strike: string;
      normalText: string; heading1: string; heading2: string; heading3: string;
      font: string; textColor: string; bulletList: string; orderedList: string;
      alignLeft: string; alignCenter: string; alignRight: string; link: string;
      undo: string; redo: string; insertFicha: string; insertTable: string;
    };
    dropPicker: { linked: string; linkedTitle: string; searchPlaceholder: string; searching: string; noResults: string; categoryMobs: string; categoryItems: string; categoryWeapons: string; categoryMissions: string; categoryGuides: string };
    entryHistory: { loading: string; loadError: string; empty: string; bySystem: string; created: string; updated: string; deleted: string };
    imageUpload: { uploading: string; chooseFile: string; removeImage: string; formatsHint: string; uploadError: string; manualPlaceholder: string };
    dataTable: { noResults: string; selected: string; selectedPlural: string; itemsPerPage: string; pageOf: string; items: string };
    auditLog: {
      title: string; subtitle: string; loading: string; loadError: string; empty: string;
      created: string; updated: string; deleted: string; system: string;
      entityContentItem: string; entityJutsu: string; entityMastery: string;
    };
    masteries: {
      title: string; subtitle: string; loading: string; loadError: string; genericLoadError: string;
      elemental: string; nonElemental: string; paths: string; edit: string; viewJutsus: string;
    };
    translation: {
      sectionTitle: string; retranslate: string; retranslating: string; retranslateConfirm: string;
      nameLabel: string; descriptionLabel: string; loreLabel: string; synergyLabel: string; spawnLocationLabel: string;
      emptyHint: string; retranslateError: string;
    };
    masteryEditor: {
      title: string; loading: string; loadError: string; saveError: string; save: string;
      nonElemental: string; name: string; englishName: string; icon: string; color: string;
      image: string; gifLabel: string; shortDescription: string; shortDescriptionPlaceholder: string;
      fullDescription: string; fullDescriptionPlaceholder: string; linkedAttributes: string;
      paths: string; addPath: string; pathIdPlaceholder: string; pathNamePlaceholder: string;
      pathDescriptionPlaceholder: string; pathRequirementPlaceholder: string; noPaths: string;
      pathIncompleteError: string; pathDuplicateIdError: string;
    };
    jutsusList: {
      title: string; newJutsu: string; all: string; searchPlaceholder: string;
      loading: string; loadError: string; genericLoadError: string; empty: string;
      colName: string; colMastery: string; colTier: string; colChakra: string;
      selectAll: string; selectRow: string; edit: string; delete: string;
      deleteConfirm: string; deleteError: string; bulkDeleteConfirm: string; bulkDeleteError: string;
    };
    jutsuEditor: {
      back: string; editTitle: string; newTitle: string; loading: string; loadError: string; saveError: string; save: string;
      name: string; englishName: string; idSlug: string; idSlugLocked: string; idPlaceholder: string;
      mastery: string; path: string; pathNone: string;
      tier: string; chakraCost: string; icon: string;
      range: string; rangePlaceholder: string; castTime: string; castTimePlaceholder: string;
      cooldown: string; cooldownPlaceholder: string; effect: string; effectPlaceholder: string;
      shortDescription: string; shortDescriptionPlaceholder: string;
      fullDescription: string; fullDescriptionPlaceholder: string; gif: string; history: string;
    };
    contentList: {
      filterAll: string; newEntry: string; searchPlaceholder: string;
      loading: string; loadError: string; genericLoadError: string; empty: string;
      colName: string; colCategory: string; colLevel: string; colRarity: string; colStatus: string;
      selectAll: string; selectRow: string; edit: string; delete: string; published: string; draft: string;
      deleteConfirm: string; deleteError: string; bulkStatusError: string;
      bulkDeleteConfirm: string; bulkDeleteError: string; publish: string; markDraft: string;
    };
    contentEditor: {
      catMobs: string; catItems: string; catWeapons: string; catMissions: string; catGuides: string;
      mobMonster: string; mobBoss: string; mobNpc: string; mobMount: string;
      itemGeneral: string; itemRing: string; itemConsumable: string; itemMaterial: string; itemCurrency: string; itemCast: string;
      editTitle: string; newTitle: string;
      name: string; category: string; mobType: string; itemType: string; slugLabel: string; back: string; icon: string;
      speed: string; speedPlaceholder: string; requirement: string; requirementPlaceholder: string;
      weaponNpc: string; weaponNpcPlaceholder: string; weaponType: string; weaponTypePlaceholder: string;
      weaponBaseDamage: string; weaponBaseDamagePlaceholder: string;
      weaponSpecialAbility: string; weaponSpecialAbilityPlaceholder: string;
      weaponKnockbackDistance: string; weaponKnockbackDistancePlaceholder: string;
      maxStack: string; maxStackPlaceholder: string; castVillage: string;
      rarity: string; level: string; image: string;
      description: string; descriptionPlaceholder: string;
      lore: string; loreOptional: string; lorePlaceholder: string;
      synergy: string; synergyOptional: string; synergyPlaceholder: string;
      spawnLocation: string; spawnLocationPlaceholder: string;
      mobSheet: string; health: string; healthPlaceholder: string; damage: string; damagePlaceholder: string;
      experience: string; experiencePlaceholder: string; range: string; rangePlaceholder: string;
      respawnTime: string; respawnTimePlaceholder: string;
      attacksTitle: string; attackPlaceholder: string; noAttacks: string;
      attributesTitle: string; attributeLabelPlaceholder: string; attributeValuePlaceholder: string; noAttributes: string;
      dropsTitle: string; dropNamePlaceholder: string; qualifierExact: string; qualifierOver: string; qualifierBelow: string; noDrops: string;
      history: string;
    };
    import: {
      title: string; description: string; formatTitle: string; acceptedCategories: string;
      chooseFile: string; entriesReady: string; entryReady: string; importing: string; importButton: string;
      created: string; entryCreated: string; skipped: string; entrySkipped: string; viewInList: string;
      invalidJson: string; importError: string;
      errNeedsEntries: string; errEntriesArray: string; errEntriesEmpty: string; errTooMany: string;
      errItemNotObject: string; errNameMissing: string; errInvalidCategory: string;
    };
  };
}

// Um objeto completo por idioma. As chaves aninhadas espelham
// exatamente a estrutura da interface Dictionary acima.
export const dictionaries: Record<Locale, Dictionary> = {
  pt: {
    siteName: 'Nin Online Brasil Wiki',
    siteTagline: 'A enciclopédia definitiva do mundo Nin',
    nav: {
      home: 'Início',
      mobs: 'Monstros',
      items: 'Itens',
      guides: 'Guias',
      masteries: 'Maestrias',
      weapons: 'Armas',
      missions: 'Missões',
      village: 'Vilas',
      map: 'Mapa',
    },
    home: {
      welcome: 'Bem-vindo à',
      subtitle: 'Explore o mundo de Nin Online — monstros, itens, armas e muito mais.',
      browseAll: 'Ver tudo',
    },
    news: {
      title: 'Últimas Notícias & Patch Notes',
      subtitle: 'Mantenha-se atualizado com as novidades do mundo Nin.',
      readMore: 'Leia mais',
      viewAll: 'Ver todas',
    },
    catalog: {
      level: 'Nível',
      levelRange: 'Níveis',
      results: 'resultados',
      search: 'Buscar...',
      noResults: 'Nenhum resultado encontrado.',
      allLevels: 'Todos os Níveis',
      filterByLevel: 'Filtrar por Nível',
      itemsFilterAll: 'Todos',
      itemsFilterConsumables: 'Consumíveis',
      itemsFilterMaterials: 'Materiais',
      itemsFilterEquipment: 'Equipamentos',
      itemsFilterSpecial: 'Itens Especiais',
    },
    detail: {
      attributes: 'Atributos',
      drops: 'Drops',
      lore: 'História',
      synergy: 'Sinergia & Build',
      copyAttributes: 'Copiar Atributos',
      copied: 'Copiado!',
      back: 'Voltar',
      level: 'Nível',
      noDrops: 'Este item não possui drops registrados.',
      relatedEntries: 'Relacionados',
      spawnLocation: 'Onde encontrar',
      attacks: 'Jutsu / Attacks',
      noAttacks: 'Nenhum',
      maxStack: 'Max Stack',
      castVillage: 'Vila',
      speed: 'Speed',
      requirement: 'Requisito',
      requirementsSection: 'Requisitos',
      acquisitionSection: 'Como conseguir',
      weaponDetailsSection: 'Detalhes da Arma',
      battleDataSection: 'Dados de Batalha',
      levelReq: 'Nível Req.',
      statReq: 'Atributo Req.',
      npc: 'NPC',
      weaponClass: 'Classe',
      weaponType: 'Tipo',
      baseDamage: 'Dano Base',
      specialAbility: 'Habilidade Especial',
      attackSpeed: 'Velocidade de Ataque',
      statBonus: 'Bônus de Atributo',
      knockbackDistance: 'Distância de Knockback',
    },
    masteryDetail: {
      notFound: 'Mastery não encontrada.',
      backToMasteries: 'Voltar para Masteries',
      elemental: 'Elemental',
      nonElemental: 'Não-elemental',
      aboutMastery: 'Sobre a Mastery',
      masteryPaths: 'Caminhos da Mastery',
      noJutsusInPath: 'Nenhum jutsu classificado neste caminho ainda.',
      jutsusOfMastery: 'Jutsus da Mastery',
      noJutsusYet: 'Nenhum jutsu cadastrado para esta mastery ainda.',
      masterySheet: 'Ficha da Mastery',
      nameLabel: 'Nome',
      typeLabel: 'Tipo',
      elementLabel: 'Elemento',
      jutsusLabel: 'Jutsus',
      relatedAttributes: 'Atributos Relacionados',
      noAttributesConfirmed: 'Nenhum atributo confirmado para esta mastery.',
      paths: 'caminhos',
      home: 'Início',
      listSubtitle: 'Os 8 caminhos do chakra — elementais e não-elementais.',
    },
    jutsuDetail: {
      notFound: 'Jutsu não encontrado.',
      backToJutsus: 'Voltar',
      masteryLabel: 'Mastery',
      pathLabel: 'Caminho',
      noPath: 'Nenhum',
      tierLabel: 'Tier',
      chakraCostLabel: 'Custo de Chakra',
      rangeLabel: 'Alcance',
      castTimeLabel: 'Tempo de Conjuração',
      cooldownLabel: 'Cooldown',
      effectLabel: 'Efeito',
      aboutJutsu: 'Sobre o Jutsu',
      jutsuSheet: 'Ficha do Jutsu',
      home: 'Início',
      tier1: 'Básico', tier2: 'Intermediário', tier3: 'Avançado', tier4: 'Especialista', tier5: 'Mestre',
    },
    footer: {
      disclaimer: 'Este é um projeto de fã não oficial. Nin Online é propriedade de seus respectivos criadores.',
      madeWith: 'Feito pela comunidade',
    },
    admin: {
      login: {
        welcome: 'Bem-vindo de volta',
        subtitle: 'Acesse o painel de administração da Wiki',
        button: 'Entrar com Discord',
      },
      auth: {
        checkingSession: 'Verificando sessão...',
        logout: 'Sair',
        sessionExpired: 'Sua sessão expirou. Entre novamente.',
        apiUnreachable: 'Não consegui falar com o servidor da API. Verifique se ele está ligado e tente de novo.',
        retry: 'Tentar de novo',
        noAccessTitle: 'Sem acesso a esta página',
        noAccessBody: 'O seu cargo não tem permissão para ver esta área.',
        backToOverview: 'Voltar à Visão Geral',
        errNotStaff: 'Essa conta do Discord não faz parte da equipe. Peça a um Adm para te cadastrar.',
        errInactive: 'Sua conta da equipe está desativada.',
        errDiscordFailed: 'Não foi possível falar com o Discord. Tente de novo em instantes.',
        errDiscordDenied: 'Você cancelou o login no Discord.',
        errInvalidState: 'A tentativa de login expirou ou é inválida. Tente de novo.',
        errNotConfigured: 'O login com Discord ainda não foi configurado neste ambiente.',
        errGeneric: 'Não foi possível entrar.',
        errRateLimited: 'Muitas tentativas de login. Espere alguns minutos e tente de novo.',
        devTitle: 'Login de desenvolvimento',
        devHint: 'Só aparece em ambiente local. Entra com o Discord ID de alguém já cadastrado na equipe.',
        devPlaceholder: 'Discord ID (só números)',
        devButton: 'Entrar (dev)',
        devError: 'Esse Discord ID não está cadastrado na equipe (ou está desativado).',
        roleSuperAdmin: 'S.Adm', roleAdmin: 'Adm', roleCreator: 'Creator',
        roleDescSuperAdmin: 'Dono do sistema: acesso total e recursos exclusivos.',
        roleDescAdmin: 'Publica, apaga, edita Lore e gerencia Creators.',
        roleDescCreator: 'Cria e edita rascunhos. Não publica nem apaga.',
        staffTitle: 'Equipe',
        staffSubtitle: 'Quem pode entrar no painel e o que cada cargo faz.',
        addStaff: 'Cadastrar membro',
        discordId: 'Discord ID',
        discordIdHint: 'No Discord: Configurações > Avançado > Modo Desenvolvedor; depois botão direito no nome da pessoa > Copiar ID do usuário.',
        displayName: 'Nome (opcional)',
        displayNameHint: 'Só pra você reconhecer. No primeiro login vira o nome real do Discord.',
        role: 'Cargo', status: 'Status', lastLogin: 'Último login',
        neverLoggedIn: 'Nunca entrou', active: 'Ativo', inactive: 'Desativado',
        owner: 'Dono', ownerHint: 'Definido no .env: não pode ser alterado por aqui.',
        deactivate: 'Desativar', activate: 'Reativar',
        confirmDeactivate: 'Desativar {name}? A pessoa perde o acesso na hora.',
        you: 'você',
        add: 'Cadastrar', adding: 'Cadastrando...',
        noStaff: 'Nenhum membro cadastrado.',
        loadError: 'Erro ao carregar a equipe.',
        actionError: 'Não foi possível concluir a ação.',
        noManageable: 'sem permissão',
        logByLabel: 'Tipo',
        logAll: 'Tudo', logContent: 'Conteúdo', logAuth: 'Logins', logStaff: 'Equipe', logSecurity: 'Segurança',
        logActions: {
          create: 'criou', update: 'editou', delete: 'apagou', upload: 'enviou imagem',
          'bulk-status': 'mudou o status de', 'bulk-delete': 'apagou em massa', 'bulk-import': 'importou',
          login: 'entrou', logout: 'saiu', login_denied: 'teve o login negado', role_change: 'mudou o cargo de',
          activate: 'reativou', deactivate: 'desativou', bootstrap: 'foi criado como dono', bootstrap_restore: 'teve o cargo de dono restaurado',
          permission_denied: 'tentou algo sem permissão em',
        },
        logEntities: {
          content_item: 'entry', jutsu: 'jutsu', mastery: 'mastery', upload: 'arquivo',
          auth: 'sessão', staff: 'membro', security: 'rota', village: 'vila', organization: 'organização', post: 'post',
        },
        logSources: { panel: 'Painel', bot: 'Bot', auth: 'Login', system: 'Sistema' },
      },
      blogAdmin: {
        subtitle: 'Notícias e atualizações do site.', newPost: 'Novo post', search: 'Buscar pelo título...',
        colTitle: 'Título', colAuthor: 'Autor', colStatus: 'Status', colUpdated: 'Atualizado',
        published: 'Publicado', draft: 'Rascunho', edit: 'Editar', delete: 'Apagar',
        confirmDelete: 'Apagar o post "{title}"? Isso não pode ser desfeito.', empty: 'Nenhum post ainda.',
        loading: 'Carregando posts...', loadError: 'Erro ao carregar os posts.', deleteError: 'Não foi possível apagar.',
        editTitle: 'Editar post', newTitle: 'Novo post', back: 'Voltar', titleLabel: 'Título', titlePlaceholder: 'Título do post',
        slugLabel: 'Slug (endereço na URL)', slugHint: 'Gerado a partir do título; só letras minúsculas, números e hífen.',
        excerptLabel: 'Resumo', excerptHint: 'Texto curto que aparece na lista de posts.', coverLabel: 'Imagem de capa',
        contentLabel: 'Conteúdo', contentPlaceholder: 'Escreva o post...', saveDraft: 'Salvar rascunho', publish: 'Publicar',
        saving: 'Salvando...', saveError: 'Erro ao salvar o post.',
        lockedNote: 'Este post já está publicado: só um Adm pode alterá-lo.',
        unpublishNote: 'Este post está publicado. "Salvar rascunho" tira ele do ar; "Publicar" mantém no ar com as mudanças.',
      },
      villagesAdmin: {
        title: 'Vilas', subtitle: 'Vilas, clãs e organizações do jogo.', newVillage: 'Nova vila', manageOrgs: 'Gerenciar organizações',
        colName: 'Nome', colElement: 'Elemento', colLeader: 'Líder', colClans: 'Clãs', edit: 'Editar', delete: 'Apagar',
        confirmDelete: 'Apagar a vila "{name}"? Os clãs dela também serão apagados, e as entries que usavam essa vila (itens Cast) ficam sem vila.',
        empty: 'Nenhuma vila cadastrada.', loading: 'Carregando vilas...', loadError: 'Erro ao carregar as vilas.', deleteError: 'Não foi possível apagar.',
        editTitle: 'Editar vila', newTitle: 'Nova vila', back: 'Voltar', save: 'Salvar', saving: 'Salvando...', saveError: 'Erro ao salvar a vila.',
        idSlug: 'ID / slug', idSlugLocked: '(não pode ser alterado)', idHint: 'Só letras minúsculas, números e hífen. Ex: leaf-village',
        name: 'Nome', emblem: 'Emblema (emoji)', element: 'Elemento', accentColor: 'Cor de destaque', leader: 'Líder', climate: 'Clima', motto: 'Lema', image: 'Imagem',
        mapX: 'Mapa X (0-100)', mapY: 'Mapa Y (0-100)', mapHint: 'Posição no mapa, em % da imagem.',
        shortDescription: 'Descrição curta (aparece no cartão)', longDescription: 'Descrição completa',
        clansTitle: 'Clãs', addClan: 'Adicionar clã', clanName: 'Nome', clanId: 'ID', clanLevel: 'Nível mín.', clanPrice: 'Preço (Ryo)', clanDescription: 'Descrição',
        removeClan: 'Remover clã', noClans: 'Nenhum clã. Clique em "Adicionar clã".',
        orgsTitle: 'Organizações', orgsSubtitle: 'Corpos especializados (ANBU, Hunter Nin...) que podem existir em mais de uma vila.',
        newOrg: 'Nova organização', orgName: 'Nome', orgDescription: 'Descrição', orgVillages: 'Atua nas vilas',
        orgConfirmDelete: 'Apagar a organização "{name}"?', orgEmpty: 'Nenhuma organização cadastrada.', orgSave: 'Salvar organização',
        orgCancel: 'Cancelar', orgEditTitle: 'Editar organização', backToVillages: 'Voltar às vilas', noVillagesYet: 'Cadastre uma vila primeiro.',
      },
      sidebar: {
        overview: 'Visão Geral',
        blogPosts: 'Postagens do Blog',
        content: 'Conteúdo',
        masteries: 'Masteries',
        jutsus: 'Jutsus',
        bulkImport: 'Importar JSON',
        auditLog: 'Log de Auditoria',
        users: 'Usuários',
        staff: 'Equipe',
        villages: 'Vilas',
        backToSite: 'Voltar ao site',
      },
      header: {
        role: { admin: 'Admin', mod: 'Mod' },
      },
      overview: {
        title: 'Visão Geral',
        totalPosts: 'Total de Postagens',
        totalPages: 'Páginas da Wiki',
        totalUsers: 'Usuários',
        recentActivity: 'Atividade Recente',
        viewAll: 'Ver tudo',
        noActivity: 'Nenhuma atividade ainda.',
        system: 'Sistema',
        entityContentItem: 'Conteúdo', entityJutsu: 'Jutsu',
        actionCreated: 'criou', actionUpdated: 'editou', actionDeleted: 'apagou',
        contentByCategory: 'Conteúdo por categoria',
        noEntriesYet: 'Nenhuma entry ainda.',
        publishedVsDraft: 'Publicado vs rascunho',
        published: 'Publicado', draft: 'Rascunho',
        stalePages: 'Páginas desatualizadas',
        daysAgo: 'há {days} dias',
        nothingStale: 'Nada parado há mais de {days} dias. 🎉',
      },
      table: {
        title: 'Título',
        category: 'Categoria',
        author: 'Autor',
        status: 'Status',
        actions: 'Ações',
        published: 'Publicado',
        draft: 'Rascunho',
        newPost: '+ Nova Postagem / Página',
        edit: 'Editar',
        delete: 'Excluir',
        search: 'Buscar...',
      },
      editor: {
        titleLabel: 'Título',
        categoryLabel: 'Categoria',
        contentLabel: 'Conteúdo',
        saveDraft: 'Salvar Rascunho',
        publish: 'Publicar',
        back: 'Voltar',
        titlePlaceholder: 'Digite o título...',
        contentPlaceholder: 'Escreva o conteúdo aqui... Suporta Markdown.',
      },
      users: {
        title: 'Usuários',
        username: 'Nome de Usuário',
        role: 'Cargo',
        joined: 'Entrou em',
        actions: 'Ações',
      },
      richText: {
        bold: 'Negrito', italic: 'Itálico', underline: 'Sublinhado', strike: 'Tachado',
        normalText: 'Texto normal', heading1: 'Título 1', heading2: 'Título 2', heading3: 'Título 3',
        font: 'Fonte', textColor: 'Cor do texto', bulletList: 'Lista com marcadores', orderedList: 'Lista numerada',
        alignLeft: 'Alinhar à esquerda', alignCenter: 'Centralizar', alignRight: 'Alinhar à direita', link: 'Link',
        undo: 'Desfazer', redo: 'Refazer',
        insertFicha: 'Inserir Ficha', insertTable: 'Inserir Tabela',
      },
      dropPicker: {
        linked: 'Ligado',
        linkedTitle: 'Ligado a um item do catálogo — clique pra desligar',
        searchPlaceholder: 'Ligar a um item...',
        searching: 'Buscando...',
        noResults: 'Nenhum item encontrado.',
        categoryMobs: 'Mob', categoryItems: 'Item', categoryWeapons: 'Arma',
        categoryMissions: 'Missão', categoryGuides: 'Guia',
      },
      entryHistory: {
        loading: 'Carregando histórico...',
        loadError: 'Não foi possível carregar o histórico.',
        empty: 'Nenhuma alteração registrada ainda.',
        bySystem: 'por Sistema',
        created: 'Criada', updated: 'Editada', deleted: 'Apagada',
      },
      imageUpload: {
        uploading: 'Enviando...',
        chooseFile: 'Escolher arquivo',
        removeImage: 'Remover imagem',
        formatsHint: 'PNG, JPG, GIF ou WEBP, até 5MB.',
        uploadError: 'Erro ao enviar imagem.',
        manualPlaceholder: 'ou cole uma URL/caminho manualmente...',
      },
      dataTable: {
        noResults: 'Nenhum resultado encontrado.',
        selected: 'selecionado',
        selectedPlural: 'selecionados',
        itemsPerPage: 'Itens por página',
        pageOf: 'Página {current} de {total}',
        items: 'itens',
      },
      auditLog: {
        title: 'Log de Auditoria',
        subtitle: 'Últimas 100 ações registradas no painel.',
        loading: 'Carregando...',
        loadError: 'Não foi possível conectar à API.',
        empty: 'Nenhuma ação registrada ainda.',
        created: 'Criou', updated: 'Editou', deleted: 'Apagou',
        system: 'Sistema',
        entityContentItem: 'Conteúdo', entityJutsu: 'Jutsu', entityMastery: 'Mastery',
      },
      masteries: {
        title: 'Masteries',
        subtitle: 'Os 8 elementos são fixos — para adicionar/editar técnicas, vá em Jutsus.',
        loading: 'Carregando...',
        loadError: 'Não foi possível conectar à API.',
        genericLoadError: 'Erro ao carregar',
        elemental: 'Elemental', nonElemental: 'Não-elemental',
        paths: 'Caminhos', edit: 'Editar', viewJutsus: 'Ver jutsus desta mastery',
      },
      translation: {
        sectionTitle: 'Tradução (Português)',
        retranslate: 'Retraduzir',
        retranslating: 'Retraduzindo...',
        retranslateConfirm: 'Isso vai substituir a tradução em português atual pela gerada agora. Continuar?',
        nameLabel: 'Nome (Português)',
        descriptionLabel: 'Descrição (Português)',
        loreLabel: 'Lore (Português)',
        synergyLabel: 'Sinergia (Português)',
        spawnLocationLabel: 'Local de spawn (Português)',
        emptyHint: 'Ainda não traduzido — salve a entry pra gerar automaticamente (se a chave da DeepL estiver configurada), ou escreva aqui na mão.',
        retranslateError: 'Erro ao retraduzir. A API está rodando? A chave da DeepL está configurada?',
      },
      masteryEditor: {
        title: 'Editar Mastery',
        loading: 'Carregando...',
        loadError: 'Erro ao carregar mastery.',
        saveError: 'Erro ao salvar. A API está rodando?',
        save: 'Salvar',
        nonElemental: 'Não-elemental',
        name: 'Nome',
        englishName: 'Nome em inglês',
        icon: 'Ícone',
        color: 'Cor',
        image: 'Imagem',
        gifLabel: 'GIF (ficha)',
        shortDescription: 'Descrição curta',
        shortDescriptionPlaceholder: 'Resumo de uma linha...',
        fullDescription: 'Descrição completa',
        fullDescriptionPlaceholder: 'Explicação detalhada...',
        linkedAttributes: 'Atributos ligados',
        paths: 'Caminhos (Paths)',
        addPath: 'Adicionar caminho',
        pathIdPlaceholder: 'id (ex: fire-inferno)',
        pathNamePlaceholder: 'Nome do caminho',
        pathDescriptionPlaceholder: 'Descrição',
        pathRequirementPlaceholder: 'Requisito (opcional, ex: Nível 30)',
        noPaths: 'Nenhum caminho — essa mastery é de linha única.',
        pathIncompleteError: 'Todo caminho precisa de id e nome preenchidos (ou remova o caminho incompleto).',
        pathDuplicateIdError: 'Tem dois caminhos com o mesmo id - cada um precisa ser único.',
      },
      jutsusList: {
        title: 'Jutsus',
        newJutsu: 'Novo jutsu',
        all: 'Todas',
        searchPlaceholder: 'Buscar por nome...',
        loading: 'Carregando...',
        loadError: 'Não foi possível conectar à API. Ela está rodando em localhost:8000?',
        genericLoadError: 'Erro ao carregar',
        empty: 'Nenhum jutsu encontrado.',
        colName: 'Nome', colMastery: 'Mastery', colTier: 'Tier', colChakra: 'Chakra',
        selectAll: 'Selecionar todos', selectRow: 'Selecionar linha',
        edit: 'Editar', delete: 'Apagar',
        deleteConfirm: 'Apagar o jutsu "{name}"? Essa ação não pode ser desfeita.',
        deleteError: 'Erro ao apagar.',
        bulkDeleteConfirm: 'Apagar {count} jutsus selecionados? Essa ação não pode ser desfeita.',
        bulkDeleteError: 'Erro ao apagar em massa.',
      },
      jutsuEditor: {
        back: 'Voltar',
        editTitle: 'Editar jutsu',
        newTitle: 'Novo jutsu',
        loading: 'Carregando...',
        loadError: 'Erro ao carregar.',
        saveError: 'Erro ao salvar. A API está rodando?',
        save: 'Salvar',
        name: 'Nome',
        englishName: 'Nome em inglês',
        idSlug: 'Id / slug',
        idSlugLocked: '(não pode ser alterado)',
        idPlaceholder: 'ex: katon-goukakyuu',
        mastery: 'Mastery',
        path: 'Caminho (opcional)',
        pathNone: 'Nenhum',
        tier: 'Tier (1-5)',
        chakraCost: 'Custo de chakra',
        icon: 'Ícone',
        range: 'Alcance',
        rangePlaceholder: 'Médio (5-10m)',
        castTime: 'Tempo de conjuração',
        castTimePlaceholder: '1 selo',
        cooldown: 'Cooldown',
        cooldownPlaceholder: '3 segundos',
        effect: 'Efeito',
        effectPlaceholder: 'Dano de fogo em área',
        shortDescription: 'Descrição curta',
        shortDescriptionPlaceholder: 'Descrição curta, sempre visível...',
        fullDescription: 'Descrição completa',
        fullDescriptionPlaceholder: 'Explicação detalhada da técnica...',
        gif: 'GIF de demonstração (opcional)',
        history: 'Histórico',
      },
      contentList: {
        filterAll: 'Todos',
        newEntry: 'Nova entry',
        searchPlaceholder: 'Buscar por nome...',
        loading: 'Carregando...',
        loadError: 'Não foi possível conectar à API. Ela está rodando em localhost:8000?',
        genericLoadError: 'Erro ao carregar',
        empty: 'Nenhuma entry encontrada.',
        colName: 'Nome', colCategory: 'Categoria', colLevel: 'Nível', colRarity: 'Raridade', colStatus: 'Status',
        selectAll: 'Selecionar todos', selectRow: 'Selecionar linha',
        edit: 'Editar', delete: 'Apagar', published: 'Publicado', draft: 'Rascunho',
        deleteConfirm: 'Apagar "{name}"? Essa ação não pode ser desfeita.',
        deleteError: 'Erro ao apagar.',
        bulkStatusError: 'Erro ao atualizar em massa.',
        bulkDeleteConfirm: 'Apagar {count} entries selecionadas? Essa ação não pode ser desfeita.',
        bulkDeleteError: 'Erro ao apagar em massa.',
        publish: 'Publicar', markDraft: 'Marcar rascunho',
      },
      contentEditor: {
        catMobs: 'Mobs', catItems: 'Itens', catWeapons: 'Armas', catMissions: 'Missões', catGuides: 'Guias',
        mobMonster: 'Monstro comum', mobBoss: 'Boss', mobNpc: 'NPC', mobMount: 'Montaria',
        itemGeneral: 'Geral', itemRing: 'Ring', itemConsumable: 'Consumível', itemMaterial: 'Material',
        itemCurrency: 'Moeda', itemCast: 'Cast',
        editTitle: 'Editar entry', newTitle: 'Nova entry',
        name: 'Nome', category: 'Categoria', mobType: 'Tipo de mob', itemType: 'Tipo de item',
        slugLabel: 'Slug (identificador na URL)',
        back: 'Voltar',
        icon: 'Ícone (emoji)',
        speed: 'Speed', speedPlaceholder: 'Ex: 1.5',
        requirement: 'Requisito pra usar', requirementPlaceholder: 'Ex: 23 Strength',
        weaponNpc: 'NPC (onde conseguir)', weaponNpcPlaceholder: 'Ex: Kuraken',
        weaponType: 'Tipo', weaponTypePlaceholder: 'Ex: Melee',
        weaponBaseDamage: 'Dano Base', weaponBaseDamagePlaceholder: 'Ex: 54',
        weaponSpecialAbility: 'Habilidade Especial', weaponSpecialAbilityPlaceholder: 'Ex: Knockback',
        weaponKnockbackDistance: 'Distância de Knockback', weaponKnockbackDistancePlaceholder: 'Ex: 4 Tiles',
        maxStack: 'Max Stack', maxStackPlaceholder: 'Ex: 29000', castVillage: 'Vila que pode usar',
        rarity: 'Raridade', level: 'Nível', image: 'Imagem',
        description: 'Descrição', descriptionPlaceholder: 'Descrição curta, sempre visível na página...',
        lore: 'Lore', loreOptional: 'Lore (opcional)', lorePlaceholder: 'História, contexto...',
        synergy: 'Sinergia', synergyOptional: 'Sinergia (opcional)',
        synergyPlaceholder: 'Dica de estratégia, combinação com outras técnicas...',
        spawnLocation: 'Local de spawn (opcional)', spawnLocationPlaceholder: 'Ex: Floresta Negra, Campos Iniciais',
        mobSheet: 'Ficha do Mob', health: 'Health', healthPlaceholder: 'Ex: 22',
        damage: 'Damage', damagePlaceholder: 'Ex: 4',
        experience: 'Experience', experiencePlaceholder: 'Ex: 12',
        range: 'Range', rangePlaceholder: 'Ex: 10',
        respawnTime: 'Respawn Time', respawnTimePlaceholder: 'Ex: 10s',
        attacksTitle: 'Jutsu / Attacks', attackPlaceholder: 'Ex: Katon: Bola de Fogo',
        noAttacks: 'Nenhum ataque ainda ("None" na ficha pública).',
        attributesTitle: 'Atributos', attributeLabelPlaceholder: 'Label (ex: Health)',
        attributeValuePlaceholder: 'Valor (ex: 45)', noAttributes: 'Nenhum atributo ainda.',
        dropsTitle: 'Drops', dropNamePlaceholder: 'Nome do item',
        qualifierExact: 'Exato', qualifierOver: 'Over', qualifierBelow: 'Below',
        noDrops: 'Nenhum drop ainda.',
        history: 'Histórico',
      },
      import: {
        title: 'Importação de JSON em massa',
        description: 'Sobe um arquivo JSON com uma lista de nomes e categorias, e cria uma entry em rascunho pra cada uma — sem nível, descrição ou imagem preenchidos (isso continua sendo você quem completa depois, uma por uma).',
        formatTitle: 'Formato esperado',
        acceptedCategories: 'Categorias aceitas',
        chooseFile: 'Escolher arquivo JSON',
        entriesReady: 'entries prontas',
        entryReady: 'entry pronta',
        importing: 'Importando...',
        importButton: 'Importar {count} entries',
        created: 'entries criadas',
        entryCreated: 'entry criada',
        skipped: 'foram puladas',
        entrySkipped: 'foi pulada',
        viewInList: 'Ver na lista de Conteúdo →',
        invalidJson: 'Esse arquivo não é um JSON válido.',
        importError: 'Erro ao importar. A API está rodando?',
        errNeedsEntries: 'O JSON precisa ter um campo "entries" com a lista de itens.',
        errEntriesArray: '"entries" precisa ser uma lista.',
        errEntriesEmpty: 'A lista "entries" está vazia.',
        errTooMany: 'Máximo de 5000 entries por importação (esse arquivo tem {count}). Divide em lotes menores.',
        errItemNotObject: 'Item {index}: precisa ser um objeto.',
        errNameMissing: 'Item {index}: campo "name" ausente ou vazio.',
        errInvalidCategory: 'Item {index} ("{name}"): "category" precisa ser um de: {categories}.',
      },
    },
  },
  en: {
    siteName: 'Nin Online Brasil Wiki',
    siteTagline: 'The definitive encyclopedia of the Nin world',
    nav: {
      home: 'Home',
      mobs: 'Bestiary',
      items: 'Items',
      guides: 'Guides',
      masteries: 'Masteries',
      weapons: 'Weapons',
      missions: 'Missions',
      village: 'Villages',
      map: 'Map',
    },
    home: {
      welcome: 'Welcome to the',
      subtitle: 'Explore the world of Nin Online — mobs, items, weapons and more.',
      browseAll: 'Browse All',
    },
    news: {
      title: 'Latest News & Patch Notes',
      subtitle: 'Stay up to date with the latest from the Nin world.',
      readMore: 'Read more',
      viewAll: 'View all',
    },
    catalog: {
      level: 'Level',
      levelRange: 'Levels',
      results: 'results',
      search: 'Search...',
      noResults: 'No results found.',
      allLevels: 'All Levels',
      filterByLevel: 'Filter by Level',
      itemsFilterAll: 'All',
      itemsFilterConsumables: 'Consumables',
      itemsFilterMaterials: 'Materials',
      itemsFilterEquipment: 'Equipment',
      itemsFilterSpecial: 'Special Items',
    },
    detail: {
      attributes: 'Attributes',
      drops: 'Drops',
      lore: 'Lore',
      synergy: 'Synergy & Build',
      copyAttributes: 'Copy Attributes',
      copied: 'Copied!',
      back: 'Back',
      level: 'Level',
      noDrops: 'This entry has no recorded drops.',
      relatedEntries: 'Related',
      spawnLocation: 'Where to find',
      attacks: 'Jutsu / Attacks',
      noAttacks: 'None',
      maxStack: 'Max Stack',
      castVillage: 'Village',
      speed: 'Speed',
      requirement: 'Requirement',
      requirementsSection: 'Requirements',
      acquisitionSection: 'Acquisition',
      weaponDetailsSection: 'Weapon Details',
      battleDataSection: 'Battle Data',
      levelReq: 'Level Req.',
      statReq: 'Stat Req.',
      npc: 'NPC',
      weaponClass: 'Class',
      weaponType: 'Type',
      baseDamage: 'Base Damage',
      specialAbility: 'Special Ability',
      attackSpeed: 'Attack Speed',
      statBonus: 'Stat Bonus',
      knockbackDistance: 'Knockback Distance',
    },
    masteryDetail: {
      notFound: 'Mastery not found.',
      backToMasteries: 'Back to Masteries',
      elemental: 'Elemental',
      nonElemental: 'Non-elemental',
      aboutMastery: 'About the Mastery',
      masteryPaths: 'Mastery Paths',
      noJutsusInPath: 'No jutsu classified in this path yet.',
      jutsusOfMastery: 'Mastery Jutsus',
      noJutsusYet: 'No jutsu registered for this mastery yet.',
      masterySheet: 'Mastery Sheet',
      nameLabel: 'Name',
      typeLabel: 'Type',
      elementLabel: 'Element',
      jutsusLabel: 'Jutsus',
      relatedAttributes: 'Related Attributes',
      noAttributesConfirmed: 'No attributes confirmed for this mastery.',
      paths: 'paths',
      home: 'Home',
      listSubtitle: 'The 8 paths of chakra — elemental and non-elemental.',
    },
    jutsuDetail: {
      notFound: 'Jutsu not found.',
      backToJutsus: 'Back',
      masteryLabel: 'Mastery',
      pathLabel: 'Path',
      noPath: 'None',
      tierLabel: 'Tier',
      chakraCostLabel: 'Chakra Cost',
      rangeLabel: 'Range',
      castTimeLabel: 'Cast Time',
      cooldownLabel: 'Cooldown',
      effectLabel: 'Effect',
      aboutJutsu: 'About the Jutsu',
      jutsuSheet: 'Jutsu Sheet',
      home: 'Home',
      tier1: 'Basic', tier2: 'Intermediate', tier3: 'Advanced', tier4: 'Expert', tier5: 'Master',
    },
    footer: {
      disclaimer: 'This is an unofficial fan project. Nin Online is property of its respective creators.',
      madeWith: 'Made by the community',
    },
    admin: {
      login: {
        welcome: 'Welcome back',
        subtitle: 'Sign in to the Wiki admin dashboard',
        button: 'Login with Discord',
      },
      auth: {
        checkingSession: 'Checking session...',
        logout: 'Log out',
        sessionExpired: 'Your session expired. Please sign in again.',
        apiUnreachable: 'Could not reach the API server. Check that it is running and try again.',
        retry: 'Try again',
        noAccessTitle: 'No access to this page',
        noAccessBody: 'Your role does not have permission to view this area.',
        backToOverview: 'Back to Overview',
        errNotStaff: 'This Discord account is not part of the staff. Ask an Adm to register you.',
        errInactive: 'Your staff account is deactivated.',
        errDiscordFailed: 'Could not reach Discord. Please try again in a moment.',
        errDiscordDenied: 'You cancelled the Discord login.',
        errInvalidState: 'The login attempt expired or is invalid. Please try again.',
        errNotConfigured: 'Discord login has not been configured in this environment yet.',
        errGeneric: 'Could not sign in.',
        errRateLimited: 'Too many login attempts. Wait a few minutes and try again.',
        devTitle: 'Development login',
        devHint: 'Only shown in local environments. Signs in with the Discord ID of someone already registered on the staff.',
        devPlaceholder: 'Discord ID (numbers only)',
        devButton: 'Sign in (dev)',
        devError: 'This Discord ID is not registered on the staff (or is deactivated).',
        roleSuperAdmin: 'S.Adm', roleAdmin: 'Adm', roleCreator: 'Creator',
        roleDescSuperAdmin: 'System owner: full access and exclusive features.',
        roleDescAdmin: 'Publishes, deletes, edits Lore and manages Creators.',
        roleDescCreator: 'Creates and edits drafts. Cannot publish or delete.',
        staffTitle: 'Staff',
        staffSubtitle: 'Who can sign in to the panel and what each role does.',
        addStaff: 'Register member',
        discordId: 'Discord ID',
        discordIdHint: 'In Discord: Settings > Advanced > Developer Mode; then right-click the person\'s name > Copy User ID.',
        displayName: 'Name (optional)',
        displayNameHint: 'Just so you recognize them. On first login it becomes their real Discord name.',
        role: 'Role', status: 'Status', lastLogin: 'Last login',
        neverLoggedIn: 'Never signed in', active: 'Active', inactive: 'Deactivated',
        owner: 'Owner', ownerHint: 'Defined in .env: cannot be changed from here.',
        deactivate: 'Deactivate', activate: 'Reactivate',
        confirmDeactivate: 'Deactivate {name}? They lose access immediately.',
        you: 'you',
        add: 'Register', adding: 'Registering...',
        noStaff: 'No members registered.',
        loadError: 'Error loading the staff.',
        actionError: 'Could not complete the action.',
        noManageable: 'no permission',
        logByLabel: 'Type',
        logAll: 'All', logContent: 'Content', logAuth: 'Logins', logStaff: 'Staff', logSecurity: 'Security',
        logActions: {
          create: 'created', update: 'updated', delete: 'deleted', upload: 'uploaded an image',
          'bulk-status': 'changed the status of', 'bulk-delete': 'bulk-deleted', 'bulk-import': 'imported',
          login: 'signed in', logout: 'signed out', login_denied: 'had a login denied', role_change: 'changed the role of',
          activate: 'reactivated', deactivate: 'deactivated', bootstrap: 'was created as owner', bootstrap_restore: 'had the owner role restored',
          permission_denied: 'tried something without permission on',
        },
        logEntities: {
          content_item: 'entry', jutsu: 'jutsu', mastery: 'mastery', upload: 'file',
          auth: 'session', staff: 'member', security: 'route', village: 'village', organization: 'organization', post: 'post',
        },
        logSources: { panel: 'Panel', bot: 'Bot', auth: 'Login', system: 'System' },
      },
      blogAdmin: {
        subtitle: 'News and updates for the site.', newPost: 'New post', search: 'Search by title...',
        colTitle: 'Title', colAuthor: 'Author', colStatus: 'Status', colUpdated: 'Updated',
        published: 'Published', draft: 'Draft', edit: 'Edit', delete: 'Delete',
        confirmDelete: 'Delete the post "{title}"? This cannot be undone.', empty: 'No posts yet.',
        loading: 'Loading posts...', loadError: 'Error loading posts.', deleteError: 'Could not delete.',
        editTitle: 'Edit post', newTitle: 'New post', back: 'Back', titleLabel: 'Title', titlePlaceholder: 'Post title',
        slugLabel: 'Slug (URL address)', slugHint: 'Generated from the title; lowercase letters, numbers and hyphens only.',
        excerptLabel: 'Excerpt', excerptHint: 'Short text shown in the post list.', coverLabel: 'Cover image',
        contentLabel: 'Content', contentPlaceholder: 'Write the post...', saveDraft: 'Save draft', publish: 'Publish',
        saving: 'Saving...', saveError: 'Error saving the post.',
        lockedNote: 'This post is already published: only an Adm can change it.',
        unpublishNote: 'This post is published. "Save draft" takes it offline; "Publish" keeps it live with the changes.',
      },
      villagesAdmin: {
        title: 'Villages', subtitle: 'The game\'s villages, clans and organizations.', newVillage: 'New village', manageOrgs: 'Manage organizations',
        colName: 'Name', colElement: 'Element', colLeader: 'Leader', colClans: 'Clans', edit: 'Edit', delete: 'Delete',
        confirmDelete: 'Delete the village "{name}"? Its clans will also be deleted, and entries that used this village (Cast items) are left without one.',
        empty: 'No villages registered.', loading: 'Loading villages...', loadError: 'Error loading villages.', deleteError: 'Could not delete.',
        editTitle: 'Edit village', newTitle: 'New village', back: 'Back', save: 'Save', saving: 'Saving...', saveError: 'Error saving the village.',
        idSlug: 'ID / slug', idSlugLocked: '(cannot be changed)', idHint: 'Lowercase letters, numbers and hyphens only. E.g. leaf-village',
        name: 'Name', emblem: 'Emblem (emoji)', element: 'Element', accentColor: 'Accent color', leader: 'Leader', climate: 'Climate', motto: 'Motto', image: 'Image',
        mapX: 'Map X (0-100)', mapY: 'Map Y (0-100)', mapHint: 'Position on the map, as % of the image.',
        shortDescription: 'Short description (shown on the card)', longDescription: 'Full description',
        clansTitle: 'Clans', addClan: 'Add clan', clanName: 'Name', clanId: 'ID', clanLevel: 'Min. level', clanPrice: 'Price (Ryo)', clanDescription: 'Description',
        removeClan: 'Remove clan', noClans: 'No clans. Click "Add clan".',
        orgsTitle: 'Organizations', orgsSubtitle: 'Specialized corps (ANBU, Hunter Nin...) that can exist in more than one village.',
        newOrg: 'New organization', orgName: 'Name', orgDescription: 'Description', orgVillages: 'Operates in villages',
        orgConfirmDelete: 'Delete the organization "{name}"?', orgEmpty: 'No organizations registered.', orgSave: 'Save organization',
        orgCancel: 'Cancel', orgEditTitle: 'Edit organization', backToVillages: 'Back to villages', noVillagesYet: 'Register a village first.',
      },
      sidebar: {
        overview: 'Overview',
        blogPosts: 'Blog Posts',
        content: 'Content',
        masteries: 'Masteries',
        jutsus: 'Jutsus',
        bulkImport: 'Import JSON',
        auditLog: 'Audit Log',
        users: 'Users',
        staff: 'Staff',
        villages: 'Villages',
        backToSite: 'Back to site',
      },
      header: {
        role: { admin: 'Admin', mod: 'Mod' },
      },
      overview: {
        title: 'Overview',
        totalPosts: 'Total Posts',
        totalPages: 'Wiki Pages',
        totalUsers: 'Users',
        recentActivity: 'Recent Activity',
        viewAll: 'View all',
        noActivity: 'No activity yet.',
        system: 'System',
        entityContentItem: 'Content', entityJutsu: 'Jutsu',
        actionCreated: 'created', actionUpdated: 'updated', actionDeleted: 'deleted',
        contentByCategory: 'Content by category',
        noEntriesYet: 'No entries yet.',
        publishedVsDraft: 'Published vs draft',
        published: 'Published', draft: 'Draft',
        stalePages: 'Stale pages',
        daysAgo: '{days} days ago',
        nothingStale: 'Nothing stale for over {days} days. 🎉',
      },
      table: {
        title: 'Title',
        category: 'Category',
        author: 'Author',
        status: 'Status',
        actions: 'Actions',
        published: 'Published',
        draft: 'Draft',
        newPost: '+ New Post / Page',
        edit: 'Edit',
        delete: 'Delete',
        search: 'Search...',
      },
      editor: {
        titleLabel: 'Title',
        categoryLabel: 'Category',
        contentLabel: 'Content',
        saveDraft: 'Save Draft',
        publish: 'Publish',
        back: 'Back',
        titlePlaceholder: 'Enter title...',
        contentPlaceholder: 'Write your content here... Markdown supported.',
      },
      users: {
        title: 'Users',
        username: 'Username',
        role: 'Role',
        joined: 'Joined',
        actions: 'Actions',
      },
      richText: {
        bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough',
        normalText: 'Normal text', heading1: 'Heading 1', heading2: 'Heading 2', heading3: 'Heading 3',
        font: 'Font', textColor: 'Text color', bulletList: 'Bullet list', orderedList: 'Numbered list',
        alignLeft: 'Align left', alignCenter: 'Center', alignRight: 'Align right', link: 'Link',
        undo: 'Undo', redo: 'Redo',
        insertFicha: 'Insert Sheet', insertTable: 'Insert Table',
      },
      dropPicker: {
        linked: 'Linked',
        linkedTitle: 'Linked to a catalog item — click to unlink',
        searchPlaceholder: 'Link an item...',
        searching: 'Searching...',
        noResults: 'No items found.',
        categoryMobs: 'Mob', categoryItems: 'Item', categoryWeapons: 'Weapon',
        categoryMissions: 'Mission', categoryGuides: 'Guide',
      },
      entryHistory: {
        loading: 'Loading history...',
        loadError: 'Could not load history.',
        empty: 'No changes recorded yet.',
        bySystem: 'by System',
        created: 'Created', updated: 'Updated', deleted: 'Deleted',
      },
      imageUpload: {
        uploading: 'Uploading...',
        chooseFile: 'Choose file',
        removeImage: 'Remove image',
        formatsHint: 'PNG, JPG, GIF or WEBP, up to 5MB.',
        uploadError: 'Error uploading image.',
        manualPlaceholder: 'or paste a URL/path manually...',
      },
      dataTable: {
        noResults: 'No results found.',
        selected: 'selected',
        selectedPlural: 'selected',
        itemsPerPage: 'Items per page',
        pageOf: 'Page {current} of {total}',
        items: 'items',
      },
      auditLog: {
        title: 'Audit Log',
        subtitle: 'Last 100 actions recorded in the panel.',
        loading: 'Loading...',
        loadError: 'Could not connect to the API.',
        empty: 'No actions recorded yet.',
        created: 'Created', updated: 'Updated', deleted: 'Deleted',
        system: 'System',
        entityContentItem: 'Content', entityJutsu: 'Jutsu', entityMastery: 'Mastery',
      },
      masteries: {
        title: 'Masteries',
        subtitle: 'The 8 elements are fixed — to add/edit techniques, go to Jutsus.',
        loading: 'Loading...',
        loadError: 'Could not connect to the API.',
        genericLoadError: 'Error loading',
        elemental: 'Elemental', nonElemental: 'Non-elemental',
        paths: 'Paths', edit: 'Edit', viewJutsus: 'View this mastery’s jutsus',
      },
      translation: {
        sectionTitle: 'Translation (Portuguese)',
        retranslate: 'Retranslate',
        retranslating: 'Retranslating...',
        retranslateConfirm: 'This will replace the current Portuguese translation with a freshly generated one. Continue?',
        nameLabel: 'Name (Portuguese)',
        descriptionLabel: 'Description (Portuguese)',
        loreLabel: 'Lore (Portuguese)',
        synergyLabel: 'Synergy (Portuguese)',
        spawnLocationLabel: 'Spawn location (Portuguese)',
        emptyHint: 'Not translated yet — save the entry to auto-generate it (if the DeepL key is configured), or write it here by hand.',
        retranslateError: 'Error retranslating. Is the API running? Is the DeepL key configured?',
      },
      masteryEditor: {
        title: 'Edit Mastery',
        loading: 'Loading...',
        loadError: 'Error loading mastery.',
        saveError: 'Error saving. Is the API running?',
        save: 'Save',
        nonElemental: 'Non-elemental',
        name: 'Name',
        englishName: 'English name',
        icon: 'Icon',
        color: 'Color',
        image: 'Image',
        gifLabel: 'GIF (sheet)',
        shortDescription: 'Short description',
        shortDescriptionPlaceholder: 'One-line summary...',
        fullDescription: 'Full description',
        fullDescriptionPlaceholder: 'Detailed explanation...',
        linkedAttributes: 'Linked attributes',
        paths: 'Paths',
        addPath: 'Add path',
        pathIdPlaceholder: 'id (e.g. fire-inferno)',
        pathNamePlaceholder: 'Path name',
        pathDescriptionPlaceholder: 'Description',
        pathRequirementPlaceholder: 'Requirement (optional, e.g. Level 30)',
        noPaths: 'No paths — this mastery is a single line.',
        pathIncompleteError: 'Every path needs an id and a name filled in (or remove the incomplete path).',
        pathDuplicateIdError: 'Two paths have the same id - each one needs to be unique.',
      },
      jutsusList: {
        title: 'Jutsus',
        newJutsu: 'New jutsu',
        all: 'All',
        searchPlaceholder: 'Search by name...',
        loading: 'Loading...',
        loadError: 'Could not connect to the API. Is it running on localhost:8000?',
        genericLoadError: 'Error loading',
        empty: 'No jutsus found.',
        colName: 'Name', colMastery: 'Mastery', colTier: 'Tier', colChakra: 'Chakra',
        selectAll: 'Select all', selectRow: 'Select row',
        edit: 'Edit', delete: 'Delete',
        deleteConfirm: 'Delete jutsu "{name}"? This action cannot be undone.',
        deleteError: 'Error deleting.',
        bulkDeleteConfirm: 'Delete {count} selected jutsus? This action cannot be undone.',
        bulkDeleteError: 'Error bulk deleting.',
      },
      jutsuEditor: {
        back: 'Back',
        editTitle: 'Edit jutsu',
        newTitle: 'New jutsu',
        loading: 'Loading...',
        loadError: 'Error loading.',
        saveError: 'Error saving. Is the API running?',
        save: 'Save',
        name: 'Name',
        englishName: 'English name',
        idSlug: 'Id / slug',
        idSlugLocked: '(cannot be changed)',
        idPlaceholder: 'e.g. katon-goukakyuu',
        mastery: 'Mastery',
        path: 'Path (optional)',
        pathNone: 'None',
        tier: 'Tier (1-5)',
        chakraCost: 'Chakra cost',
        icon: 'Icon',
        range: 'Range',
        rangePlaceholder: 'Medium (5-10m)',
        castTime: 'Cast time',
        castTimePlaceholder: '1 seal',
        cooldown: 'Cooldown',
        cooldownPlaceholder: '3 seconds',
        effect: 'Effect',
        effectPlaceholder: 'Area fire damage',
        shortDescription: 'Short description',
        shortDescriptionPlaceholder: 'Short description, always visible...',
        fullDescription: 'Full description',
        fullDescriptionPlaceholder: 'Detailed explanation of the technique...',
        gif: 'Demo GIF (optional)',
        history: 'History',
      },
      contentList: {
        filterAll: 'All',
        newEntry: 'New entry',
        searchPlaceholder: 'Search by name...',
        loading: 'Loading...',
        loadError: 'Could not connect to the API. Is it running on localhost:8000?',
        genericLoadError: 'Error loading',
        empty: 'No entries found.',
        colName: 'Name', colCategory: 'Category', colLevel: 'Level', colRarity: 'Rarity', colStatus: 'Status',
        selectAll: 'Select all', selectRow: 'Select row',
        edit: 'Edit', delete: 'Delete', published: 'Published', draft: 'Draft',
        deleteConfirm: 'Delete "{name}"? This action cannot be undone.',
        deleteError: 'Error deleting.',
        bulkStatusError: 'Error bulk updating.',
        bulkDeleteConfirm: 'Delete {count} selected entries? This action cannot be undone.',
        bulkDeleteError: 'Error bulk deleting.',
        publish: 'Publish', markDraft: 'Mark as draft',
      },
      contentEditor: {
        catMobs: 'Mobs', catItems: 'Items', catWeapons: 'Weapons', catMissions: 'Missions', catGuides: 'Guides',
        mobMonster: 'Common monster', mobBoss: 'Boss', mobNpc: 'NPC', mobMount: 'Mount',
        itemGeneral: 'General', itemRing: 'Ring', itemConsumable: 'Consumable', itemMaterial: 'Material',
        itemCurrency: 'Currency', itemCast: 'Cast',
        editTitle: 'Edit entry', newTitle: 'New entry',
        name: 'Name', category: 'Category', mobType: 'Mob type', itemType: 'Item type',
        slugLabel: 'Slug (URL identifier)',
        back: 'Back',
        icon: 'Icon (emoji)',
        speed: 'Speed', speedPlaceholder: 'E.g. 1.5',
        requirement: 'Requirement to use', requirementPlaceholder: 'E.g. 23 Strength',
        weaponNpc: 'NPC (where to get)', weaponNpcPlaceholder: 'E.g. Kuraken',
        weaponType: 'Type', weaponTypePlaceholder: 'E.g. Melee',
        weaponBaseDamage: 'Base Damage', weaponBaseDamagePlaceholder: 'E.g. 54',
        weaponSpecialAbility: 'Special Ability', weaponSpecialAbilityPlaceholder: 'E.g. Knockback',
        weaponKnockbackDistance: 'Knockback Distance', weaponKnockbackDistancePlaceholder: 'E.g. 4 Tiles',
        maxStack: 'Max Stack', maxStackPlaceholder: 'E.g. 29000', castVillage: 'Village that can use it',
        rarity: 'Rarity', level: 'Level', image: 'Image',
        description: 'Description', descriptionPlaceholder: 'Short description, always visible on the page...',
        lore: 'Lore', loreOptional: 'Lore (optional)', lorePlaceholder: 'History, context...',
        synergy: 'Synergy', synergyOptional: 'Synergy (optional)',
        synergyPlaceholder: 'Strategy tip, combination with other techniques...',
        spawnLocation: 'Spawn location (optional)', spawnLocationPlaceholder: 'E.g. Dark Forest, Beginner Fields',
        mobSheet: 'Mob Sheet', health: 'Health', healthPlaceholder: 'E.g. 22',
        damage: 'Damage', damagePlaceholder: 'E.g. 4',
        experience: 'Experience', experiencePlaceholder: 'E.g. 12',
        range: 'Range', rangePlaceholder: 'E.g. 10',
        respawnTime: 'Respawn Time', respawnTimePlaceholder: 'E.g. 10s',
        attacksTitle: 'Jutsu / Attacks', attackPlaceholder: 'E.g. Fire Style: Fireball',
        noAttacks: 'No attacks yet ("None" on the public page).',
        attributesTitle: 'Attributes', attributeLabelPlaceholder: 'Label (e.g. Health)',
        attributeValuePlaceholder: 'Value (e.g. 45)', noAttributes: 'No attributes yet.',
        dropsTitle: 'Drops', dropNamePlaceholder: 'Item name',
        qualifierExact: 'Exact', qualifierOver: 'Over', qualifierBelow: 'Below',
        noDrops: 'No drops yet.',
        history: 'History',
      },
      import: {
        title: 'Bulk JSON Import',
        description: 'Upload a JSON file with a list of names and categories, and creates a draft entry for each one — with no level, description or image filled in (you complete those later, one by one).',
        formatTitle: 'Expected format',
        acceptedCategories: 'Accepted categories',
        chooseFile: 'Choose JSON file',
        entriesReady: 'entries ready',
        entryReady: 'entry ready',
        importing: 'Importing...',
        importButton: 'Import {count} entries',
        created: 'entries created',
        entryCreated: 'entry created',
        skipped: 'were skipped',
        entrySkipped: 'was skipped',
        viewInList: 'View in Content list →',
        invalidJson: 'This file is not valid JSON.',
        importError: 'Error importing. Is the API running?',
        errNeedsEntries: 'The JSON needs an "entries" field with the list of items.',
        errEntriesArray: '"entries" needs to be a list.',
        errEntriesEmpty: 'The "entries" list is empty.',
        errTooMany: 'Maximum of 5000 entries per import (this file has {count}). Split into smaller batches.',
        errItemNotObject: 'Item {index}: needs to be an object.',
        errNameMissing: 'Item {index}: "name" field missing or empty.',
        errInvalidCategory: 'Item {index} ("{name}"): "category" needs to be one of: {categories}.',
      },
    },
  },
};

// Funcao de acesso usada pelo LanguageProvider - devolve o dicionario
// inteiro do idioma pedido.
export function getDict(locale: Locale): Dictionary {
  return dictionaries[locale];
}
