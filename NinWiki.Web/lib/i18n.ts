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
/** Textos das novidades do blog: editor, pagina do post, leitores (curtir/comentar) e moderacao. */
export interface BlogxDict {
  editor: {
    image: string; imageAlt: string; imageError: string; quote: string; codeBlock: string; video: string;
    videoPrompt: string; videoInvalid: string; spoiler: string; spoilerTitle: string; words: string; characters: string;
  };
  post: {
    tagsLabel: string; tagsHint: string; newTagPlaceholder: string; addTag: string; tagError: string; tagsMax: string;
    seoTitle: string; seoHint: string; metaTitleLabel: string; metaDescLabel: string; metaTitleHint: string; metaDescHint: string;
    scheduleLabel: string; scheduleHint: string; scheduleClear: string; schedule: string; scheduledBadge: string; scheduledPast: string;
    preview: string; previewTitle: string; previewNote: string; close: string; unsavedWarning: string;
    createdTagOk: string;
  };
  public: {
    allPosts: string; filterByTag: string; minRead: string; contents: string; published: string;
    like: string; unlike: string; likes: string; comments: string; noComments: string; writeComment: string;
    commentPlaceholder: string; send: string; sending: string; loginToComment: string; loginToLike: string; loginDiscord: string;
    logout: string; signedInAs: string; deleteComment: string; confirmDeleteComment: string; commentError: string; likeError: string;
    charsLeft: string; errBanned: string; errRateLimited: string; errGeneric: string; loadCommentsError: string;
    commentsRules: string; spoilerNote: string; scheduledNote: string;
  };
  moderation: {
    title: string; subtitle: string; search: string; onlyHidden: string; empty: string; hide: string; show: string;
    delete: string; confirmDelete: string; ban: string; unban: string; confirmBan: string; hiddenBy: string; hiddenBadge: string;
    bannedBadge: string; onPost: string; loadError: string; actionError: string; refresh: string; discordId: string;
  };
}

/** Textos da ficha do jutsu (pagina publica) e dos campos novos do editor de jutsu. */
export interface JutsuInfoDict {
  requirements: string; acquisition: string; techniqueDetails: string; battleData: string;
  mastery: string; level: string; stat: string; tier: string; shop: string; maxLevel: string; baseDamage: string;
  chakraCost: string; cooldown: string; castTime: string; castType: string; specialEffect: string;
  jutsuClass: string; range: string; debuff: string; levelWord: string; cpUnit: string;
  allowedWeapons: string; isNpc: string; isNpcHint: string; source: string; npcSource: string;
  // editor
  sheetTitle: string; sheetHint: string; requiredLevel: string; requiredStat: string; scrollType: string; scrollTypeHint: string;
  maxLevelHint: string; perLevelHint: string; levelN: string; tierHint: string;
  levelsTitle: string; levelsHint: string; levelNamePlaceholder: string; nameByLevel: string; nameFromLevel: string; addLevel: string; removeLevel: string;
}

export interface Dictionary {
  siteName: string;
  siteTagline: string;
  nav: { home: string; mobs: string; items: string; guides: string; masteries: string; weapons: string; missions: string; village: string; map: string; blog: string };
  home: { welcome: string; subtitle: string; browseAll: string };
  news: { title: string; subtitle: string; readMore: string; viewAll: string; empty: string };
  lore: {
    home: string; villagesTitle: string; villagesSubtitle: string; villagesCrumb: string; villageNotFound: string; backToVillages: string;
    masteryNotFound: string; backToMasteries: string; jutsuNotFound: string; entryNotFound: string; back: string; pageNotFound: string; backHome: string;
    aboutVillage: string; clans: string; organizations: string; villageSheet: string; otherVillages: string;
    fName: string; fEnglish: string; fPortuguese: string; fElement: string; fMotto: string; fClimate: string; fLeader: string;
    emblemAlt: string; mapTitle: string; mapSubtitle: string; mapCrumb: string; mapMarkerAria: string; mapHint: string;
    demo: string; jutsuDemoAlt: string;
    guideMore: string; guideAttributes: string; guideProfessions: string; guideRanks: string; guideArcs: string; guideSummons: string;
    guideGathering: string; guideCrafting: string;
  };
  siteError: { title: string; text: string; retry: string; home: string };
  blogx: BlogxDict;
  maintenance: { title: string; text: string; back: string };
  jutsuInfo: JutsuInfoDict;
  blog: { title: string; subtitle: string; empty: string; loadError: string; notFound: string; back: string; by: string; updated: string };
  catalog: { level: string; levelRange: string; results: string; search: string; noResults: string; allLevels: string; filterByLevel: string; itemsFilterAll: string; itemsFilterConsumables: string; itemsFilterMaterials: string; itemsFilterWardrobe: string; itemsFilterRings: string; itemsFilterPack: string; itemsFilterSpecial: string };
  detail: { itemDetails: string; itemType: string; attributes: string; drops: string; lore: string; synergy: string; copyAttributes: string; copied: string; back: string; level: string; noDrops: string; relatedEntries: string; spawnLocation: string; attacks: string; noAttacks: string; maxStack: string; castVillage: string; speed: string; requirement: string; requirementsSection: string; acquisitionSection: string; weaponDetailsSection: string; battleDataSection: string; levelReq: string; statReq: string; npc: string; weaponClass: string; weaponType: string; baseDamage: string; specialAbility: string; attackSpeed: string; statBonus: string; knockbackDistance: string; mobHealth: string; mobDamage: string; mobExperience: string; mobRange: string; mobRespawn: string; combatStats: string };
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
  invite: { title: string; subtitle: string; button: string; buttonShort: string; perms: string };
  announcement: { dismiss: string; learnMore: string };
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
      deactivate: string; activate: string; confirmDeactivate: string; you: string; remove: string; confirmRemove: string;
      add: string; adding: string; noStaff: string; loadError: string; actionError: string; noManageable: string; editName: string; saveName: string; cancelName: string; nameHint: string;
      logByLabel: string; logAll: string; logContent: string; logAuth: string; logStaff: string; logSecurity: string;
      logActions: Record<string, string>; logEntities: Record<string, string>; logSources: Record<string, string>;
    };
    // Blog (posts) no painel
    blogAdmin: {
      subtitle: string; newPost: string; search: string; colTitle: string; colAuthor: string; colStatus: string; colUpdated: string;
      published: string; draft: string; edit: string; delete: string; confirmDelete: string; empty: string;
      loading: string; loadError: string; deleteError: string;
      editTitle: string; newTitle: string; back: string; titleLabel: string; titlePlaceholder: string;
      slugLabel: string; slugHint: string; excerptLabel: string; excerptHint: string; coverLabel: string; bannerLabel: string; bannerHint: string;
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
      shortDescription: string; longDescription: string;
      clansTitle: string; addClan: string; clanName: string; clanId: string; clanImage: string; clanImageHint: string; clanDescription: string;
      removeClan: string; noClans: string;
      orgsTitle: string; orgsSubtitle: string; newOrg: string; orgName: string; orgDescription: string; orgVillages: string;
      orgConfirmDelete: string; orgEmpty: string; orgSave: string; orgCancel: string; orgEditTitle: string; backToVillages: string; noVillagesYet: string;
      orgNameRequired: string; orgIdInvalid: string; orgTranslationNote: string; clanTranslationNote: string;
    };
    announcementPage: {
      title: string; subtitle: string; message: string; messageHint: string; messagePt: string; messagePtHint: string; link: string; linkHint: string;
      linkLabel: string; level: string; levels: Record<string, string>; preview: string; save: string; saving: string; saved: string; clear: string;
      confirmClear: string; none: string; loadError: string; saveError: string; updatedBy: string; counter: string;
    };
    sidebar: { media: string; announcement: string; overview: string; blogPosts: string; comments: string; content: string; masteries: string; jutsus: string; bulkImport: string; auditLog: string; users: string; staff: string; permissions: string; errors: string; villages: string; organizations: string; backToSite: string; groups: { wiki: string; community: string; world: string; system: string }; breadcrumbHome: string; viewSite: string };
    errorsPage: {
      title: string; subtitle: string; open: string; resolved: string; all: string; allSources: string; empty: string; loadError: string; actionError: string;
      occurrences: string; firstSeen: string; lastSeen: string; where: string; route: string; status: string; resolve: string; reopen: string; delete: string;
      confirmDelete: string; trace: string; noTrace: string; resolvedBy: string; ip: string; refresh: string; sources: Record<string, string>;
      howTo: string;
    };
    noticeBoard: { title: string; subtitle: string; empty: string; newNotice: string; titleLabel: string; bodyLabel: string; pin: string; pinned: string; save: string; saving: string; cancel: string; edit: string; delete: string; confirmDelete: string; attachFiles: string; files: string; download: string; removeFile: string; uploading: string; by: string; loadError: string; saveError: string; uploadError: string; maxInfo: string; fileTooBig: string };
    rolesPage: { customTitle: string; customSubtitle: string; newRole: string; editRole: string; roleName: string; roleColor: string; roleDescription: string; createRole: string; saveRole: string; deleteRole: string; confirmDeleteRole: string; membersCount: string; noCustomRoles: string; presetHint: string; selectAll: string; clearAll: string; nameRequired: string; baseNote: string; title: string; subtitle: string; permission: string; locked: string; lockedHint: string; save: string; saving: string; saved: string; reset: string; confirmReset: string; loadError: string; saveError: string; unsavedChanges: string; alwaysAll: string; groups: Record<string, string>; names: Record<string, string> };
    header: { role: { admin: string; mod: string } };
    analytics: { title: string; subtitle: string; views: string; visitors: string; last: string; days: string; countries: string; places: string; placesHint: string; pages: string; noData: string; noDataHint: string; unknown: string; loadError: string; other: string; credit: string };
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
      fontSize: string; highlightColor: string; automatic: string; noFill: string; themeColors: string; standardColors: string; recentColors: string; moreColors: string; clearFormat: string; defaultFont: string;
    };
    jutsuPicker: { linked: string; linkedTitle: string; placeholder: string; loading: string; noResults: string };
    dropPicker: { linked: string; linkedTitle: string; searchPlaceholder: string; searching: string; noResults: string; categoryMobs: string; categoryItems: string; categoryWeapons: string; categoryMissions: string; categoryGuides: string };
    entryHistory: { loading: string; loadError: string; empty: string; bySystem: string; created: string; updated: string; deleted: string };
    steamImport: { title: string; desc: string; run: string; running: string; importPost: string; postPlaceholder: string; importThis: string; refreshAll: string; last: string; seenTitle: string; capsuleNotes: string; noTags: string; result: string; none: string; draftMode: string; liveMode: string };
    mediaPage: {
      title: string; subtitle: string; upload: string; uploading: string; search: string; empty: string; sync: string; syncing: string; syncDone: string;
      rename: string; renamePrompt: string; delete: string; confirmDelete: string; confirmForce: string; copyId: string; copyUrl: string; copied: string;
      dropHere: string; progress: string; skipped: string; failedFile: string; retryFailed: string; allCategories: string; uncategorized: string; categoryOf: string; newUploadCategory: string; setCategory: string; applyCategory: string; pageOf: string; prev: string; next: string; noUploadPermission: string; restrictedNotice: string; closedDenied: string; searchingAll: string; resetIds: string; resetIdsConfirm: string; resetIdsDone: string; categories: Record<string, string>; selected: string; selectAll: string; clearSel: string; deleteSelected: string; confirmBulk: string; confirmBulkForce: string; bulkDone: string; select: string; usedIn: string; notUsed: string; loadError: string; actionError: string; howTo: string; pickTitle: string; pick: string; total: string; loadMore: string; unnamed: string; close: string;
    };
    uploadProgress: { sending: string; processing: string; files: string };
    emojiPicker: string;
    imageUpload: { dropHere: string; library: string; idResolved: string; idNotFound: string; uploading: string; chooseFile: string; removeImage: string; formatsHint: string; uploadError: string; manualPlaceholder: string };
    dataTable: { noResults: string; selected: string; selectedPlural: string; itemsPerPage: string; pageOf: string; items: string };
    auditLog: {
      title: string; subtitle: string; loading: string; loadError: string; empty: string;
      created: string; updated: string; deleted: string; system: string;
      clearLog: string; clearAll: string; clearOlder7: string; clearOlder30: string; clearConfirmAll: string; clearConfirmOlder: string; clearDone: string; clearError: string;
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
      mottoLabel: string; climateLabel: string; longDescriptionLabel: string; titleLabel: string; excerptLabel: string; contentLabel: string;
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
      mastery: string; masteryUtility: string; path: string; pathNone: string;
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
      itemGeneral: string; itemRing: string; itemAccessory: string; itemShirt: string; itemVest: string; itemPant: string; itemHat: string; itemMask: string; itemShoe: string; itemConsumable: string; itemMaterial: string; itemCurrency: string; itemCast: string; itemAuthority: string; itemPack: string; itemWardrobe: string; wardrobeKind: string;
      editTitle: string; newTitle: string;
      name: string; category: string; mobType: string; itemType: string; slugLabel: string; back: string; icon: string;
      speed: string; speedPlaceholder: string; requirement: string; requirementPlaceholder: string; addRequirement: string;
      weaponNpc: string; weaponNpcPlaceholder: string; weaponType: string; weaponTypePlaceholder: string;
      weaponBaseDamage: string; weaponBaseDamagePlaceholder: string;
      weaponSpecialAbility: string; weaponSpecialAbilityPlaceholder: string;
      weaponKnockbackDistance: string; weaponKnockbackDistancePlaceholder: string;
      levelZeroHint: string; maxStack: string; maxStackPlaceholder: string; castVillage: string;
      rarity: string; level: string; image: string;
      description: string; descriptionPlaceholder: string; optionalSuffix: string;
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
    siteName: 'Nin Online Wiki',
    siteTagline: 'A enciclopédia definitiva do mundo Nin',
    nav: {
      home: 'Início',
      blog: 'Blog',
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
      empty: 'Nenhuma notícia publicada ainda.',
    },
    lore: {
      home: 'Início', villagesTitle: 'Vilas Ocultas', villagesSubtitle: 'As grandes potências shinobi — cada uma com sua cultura e elemento.',
      villagesCrumb: 'Vilas', villageNotFound: 'Vila não encontrada.', backToVillages: 'Voltar para Vilas',
      masteryNotFound: 'Mastery não encontrada.', backToMasteries: 'Voltar para Masteries', jutsuNotFound: 'Jutsu não encontrado.',
      entryNotFound: 'Entry não encontrada.', back: 'Voltar', pageNotFound: 'Página não encontrada.', backHome: 'Voltar ao início',
      aboutVillage: 'Sobre a Vila', clans: 'Clãs', organizations: 'Organizações', villageSheet: 'Ficha da Vila', otherVillages: 'Outras Vilas',
      fName: 'Nome', fEnglish: 'Inglês', fPortuguese: 'Português', fElement: 'Elemento', fMotto: 'Lema', fClimate: 'Clima', fLeader: 'Líder',
      emblemAlt: 'Emblema da {name}', mapTitle: 'Mapa do Mundo', mapSubtitle: 'As três grandes nações shinobi e seus territórios.', mapCrumb: 'Mapa',
      mapMarkerAria: 'Ver informação sobre {title}', mapHint: 'Passe o mouse sobre um ponto — ou use Tab — para ver informações sobre o local.',
      demo: 'Demonstração', jutsuDemoAlt: 'Demonstração do jutsu {name}',
      guideMore: 'Mais em Guias', guideAttributes: 'Atributos', guideProfessions: 'Profissões', guideRanks: 'Ranks Ninja', guideArcs: 'Story Arcs', guideSummons: 'Summons',
      guideGathering: 'Coleta', guideCrafting: 'Criação',
    },
    siteError: { title: 'Algo deu errado', text: 'A equipe já foi avisada. Tente de novo em instantes.', retry: 'Tentar de novo', home: 'Voltar ao início' },
    blog: {
      title: 'Blog',
      subtitle: 'Notícias, patch notes e novidades do mundo Nin.',
      empty: 'Nenhum post publicado ainda.',
      loadError: 'Não foi possível carregar os posts agora.',
      notFound: 'Post não encontrado.',
      back: 'Voltar para o Blog',
      by: 'por',
      updated: 'Atualizado em',
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
      itemsFilterWardrobe: 'Guarda-roupa',
      itemsFilterRings: 'Anéis',
      itemsFilterPack: 'Pack',
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
      itemDetails: 'Detalhes', itemType: 'Tipo',
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
      mobHealth: 'Vida', mobDamage: 'Dano', mobExperience: 'Experiência', mobRange: 'Alcance', mobRespawn: 'Reaparecimento', combatStats: 'Combate',
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
    invite: {
      title: 'Leve o NinWiki para o seu servidor', subtitle: 'O bot do Wiki busca itens, mobs, armas e jutsus direto no Discord (/search) e mostra se o site está no ar (/status).',
      button: 'Convidar o bot para o seu servidor', buttonShort: 'Convidar o bot', perms: 'Pede só o essencial: ver canais, enviar mensagens, links incorporados e histórico.',
    },
    announcement: { dismiss: 'Fechar anúncio', learnMore: 'Saiba mais' },
    blogx: {
      editor: {
        image: 'Inserir imagem (envio)', imageAlt: 'Texto alternativo da imagem (descreva o que aparece; ajuda quem usa leitor de tela):',
        imageError: 'Não foi possível enviar a imagem.', quote: 'Citação', codeBlock: 'Bloco de código', video: 'Vídeo do YouTube ou Twitch',
        videoPrompt: 'Cole o link do vídeo (YouTube ou Twitch):', videoInvalid: 'Link não reconhecido. Use um link do YouTube ou da Twitch.',
        spoiler: 'Spoiler (esconde o texto selecionado até o leitor clicar)', spoilerTitle: 'Spoiler — clique para ver', words: 'palavras', characters: 'caracteres',
      },
      post: {
        tagsLabel: 'Tags / categorias', tagsHint: 'Até 8. Ajudam o leitor a filtrar o blog.', newTagPlaceholder: 'Nova tag (em inglês)...', addTag: 'Criar tag',
        tagError: 'Não foi possível criar a tag.', tagsMax: 'Máximo de 8 tags.',
        seoTitle: 'SEO (Google e redes sociais)', seoHint: 'Opcional. Se ficar vazio, usamos o título e o resumo do post.',
        metaTitleLabel: 'Título para o Google', metaDescLabel: 'Descrição para o Google', metaTitleHint: 'Até 70 caracteres.', metaDescHint: 'Até 200 caracteres.',
        scheduleLabel: 'Data de publicação', scheduleHint: 'Deixe vazio para publicar agora. Uma data no futuro agenda o post: ele só aparece para os leitores quando o horário chegar.',
        scheduleClear: 'Limpar data', schedule: 'Agendar', scheduledBadge: 'Agendado', scheduledPast: 'Escolha uma data no futuro para agendar.',
        preview: 'Pré-visualizar', previewTitle: 'Pré-visualização', previewNote: 'É assim que o post aparece para os leitores (com o texto ainda não salvo).', close: 'Fechar',
        unsavedWarning: 'Há alterações não salvas. Sair mesmo assim?', createdTagOk: 'Tag criada.',
      },
      public: {
        allPosts: 'Todos', filterByTag: 'Filtrar por tag', minRead: 'min de leitura', contents: 'Neste post', published: 'Publicado em',
        like: 'Curtir', unlike: 'Descurtir', likes: 'curtidas', comments: 'Comentários', noComments: 'Ninguém comentou ainda. Seja o primeiro!',
        writeComment: 'Escreva um comentário', commentPlaceholder: 'O que você achou?', send: 'Comentar', sending: 'Enviando...',
        loginToComment: 'Entre com o Discord para comentar.', loginToLike: 'Entre com o Discord para curtir.', loginDiscord: 'Entrar com o Discord',
        logout: 'Sair', signedInAs: 'Você está como', deleteComment: 'Apagar', confirmDeleteComment: 'Apagar o seu comentário?',
        commentError: 'Não foi possível enviar o comentário.', likeError: 'Não foi possível registrar a curtida.',
        charsLeft: 'caracteres restantes', errBanned: 'Sua conta não pode mais comentar neste site.', errRateLimited: 'Muitas tentativas. Espere um pouco e tente de novo.',
        errGeneric: 'Não foi possível entrar com o Discord. Tente de novo.', loadCommentsError: 'Não foi possível carregar os comentários.',
        commentsRules: 'Seja respeitoso. A equipe pode esconder comentários e bloquear contas.', spoilerNote: 'Spoiler — clique para abrir', scheduledNote: 'Este post está agendado e ainda não está visível para os leitores.',
      },
      moderation: {
        title: 'Comentários', subtitle: 'Modere os comentários dos leitores nos posts do blog.', search: 'Buscar no texto ou no nome...', onlyHidden: 'Só escondidos',
        empty: 'Nenhum comentário.', hide: 'Esconder', show: 'Mostrar', delete: 'Apagar', confirmDelete: 'Apagar este comentário de vez?',
        ban: 'Banir leitor', unban: 'Desbanir', confirmBan: 'Banir "{name}"? A pessoa perde o acesso para comentar e curtir na hora.',
        hiddenBy: 'escondido por', hiddenBadge: 'Escondido', bannedBadge: 'Banido', onPost: 'no post', loadError: 'Erro ao carregar os comentários.',
        actionError: 'Não foi possível concluir a ação.', refresh: 'Atualizar', discordId: 'ID do Discord',
      },
    },
    jutsuInfo: {
      requirements: 'Requisitos', acquisition: 'Aquisição', techniqueDetails: 'Detalhes da técnica', battleData: 'Dados de batalha',
      mastery: 'Mastery', level: 'Nível', stat: 'Atributo', tier: 'Tier', shop: 'Loja', maxLevel: 'Nível máximo', baseDamage: 'Dano base',
      chakraCost: 'Custo de chakra', cooldown: 'Recarga', castTime: 'Tempo de conjuração', castType: 'Tipo de conjuração', specialEffect: 'Efeito especial',
      jutsuClass: 'Classe', range: 'Alcance', debuff: 'Debuff', levelWord: 'Nível', cpUnit: 'CP',
      allowedWeapons: 'Armas permitidas', isNpc: 'Jutsu NPC', isNpcHint: 'Versão do jutsu ensinada/usada por NPC: fica numa seção própria (card NPC em Masteries).', source: 'Fonte', npcSource: 'NPC',
      sheetTitle: 'Ficha do jutsu', sheetHint: 'Cada linha vazia some da página. Os valores ficam em inglês (termos do jogo).',
      requiredLevel: 'Nível exigido', requiredStat: 'Atributo exigido', scrollType: 'Tipo de pergaminho',
      scrollTypeHint: 'Aparece em Aquisição > Tier junto com o numeral do tier (1 a 5 vira I a V).',
      maxLevelHint: 'De 1 a 10. Define quantos campos por nível aparecem abaixo.', perLevelHint: 'Um valor por nível; deixe vazio o que não se aplica.',
      levelN: 'Nível {n}', tierHint: 'De 1 a 5 (o máximo é 5).',
      levelsTitle: 'Níveis: nome, dano base e recarga', levelsHint: 'Uma linha por nível do jutsu (o nível máximo é a quantidade de linhas). O nome é opcional: preencha só nos níveis em que o jutsu muda de nome (ex.: nível 4). Clique em "Adicionar nível" quando o jutsu subir de nível.', levelNamePlaceholder: 'Nome neste nível (opcional)', nameByLevel: 'Nome por nível', nameFromLevel: 'A partir do nível {n}: {name}',
      addLevel: 'Adicionar nível', removeLevel: 'Remover nível',
    },
    maintenance: { title: 'Página em manutenção', text: 'Estamos construindo esta página. Volte em breve!', back: 'Voltar ao início' },
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
        roleDescSuperAdmin: 'Dono do sistema: acesso total, Equipe e Permissões (só ele).',
        roleDescAdmin: 'Publica, apaga, edita Lore e posta avisos (ajustável em Permissões).',
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
        remove: 'Remover', confirmRemove: 'REMOVER {name} da equipe de vez? A pessoa perde o acesso na hora e não dá para desfazer (o histórico dela no log continua). Para só tirar o acesso por um tempo, use Desativar.',
        you: 'você',
        add: 'Cadastrar', adding: 'Cadastrando...',
        noStaff: 'Nenhum membro cadastrado.',
        loadError: 'Erro ao carregar a equipe.',
        actionError: 'Não foi possível concluir a ação.',
        noManageable: 'sem permissão',
        editName: 'Editar nome', saveName: 'Salvar', cancelName: 'Cancelar', nameHint: 'O nome fica salvo e o login com o Discord não o troca mais.',
        logByLabel: 'Tipo',
        logAll: 'Tudo', logContent: 'Conteúdo', logAuth: 'Logins', logStaff: 'Equipe', logSecurity: 'Segurança',
        logActions: {
          create: 'criou', update: 'editou', delete: 'apagou', upload: 'enviou imagem',
          'bulk-status': 'mudou o status de', 'bulk-delete': 'apagou em massa', 'bulk-import': 'importou',
          login: 'entrou', logout: 'saiu', login_denied: 'teve o login negado', role_change: 'mudou o cargo de', rename: 'renomeou', clear_log: 'limpou o log', clear: 'removeu', sync: 'importou imagens para',
          activate: 'reativou', deactivate: 'desativou', bootstrap: 'foi criado como dono', bootstrap_restore: 'teve o cargo de dono restaurado',
          permission_denied: 'tentou algo sem permissão em', resolve: 'resolveu', reopen: 'reabriu', reset: 'restaurou o padrão de', delete_file: 'removeu um arquivo de',
        },
        logEntities: {
          content_item: 'entry', jutsu: 'jutsu', mastery: 'mastery', upload: 'arquivo',
          auth: 'sessão', staff: 'membro', security: 'rota', village: 'vila', organization: 'organização', post: 'post', roles: 'permissões do cargo', notice: 'aviso', announcement: 'anúncio da Home', media: 'imagem', error: 'erro',
        },
        logSources: { panel: 'Painel', bot: 'Bot', auth: 'Login', system: 'Sistema' },
      },
      steamImport: {
        title: 'Notícias da Steam', desc: 'Copia sozinho para o blog (tag Patch Notes) cada post de atualização novo do jogo na Steam.', run: 'Importar agora', running: 'Conferindo a Steam...',
        importPost: 'Importar um post específico (mesmo antigo ou sem a tag)', postPlaceholder: 'Cole o link do post na Steam (…/news/app/…/view/123456789)', importThis: 'Importar este post', refreshAll: 'Atualizar posts já importados (corrige imagens e formatação)', last: 'Última conferência', seenTitle: 'O que a Steam devolveu (título · tags) — se nenhum tem a tag de atualização, ela não marcou seus posts como patchnotes:', capsuleNotes: 'Miniaturas: a Steam não devolveu a imagem de alguns posts (ficou a primeira imagem do texto):', noTags: 'sem tags', result: '{fetched} lidos · {matched} de atualização · {imported} importados · {skipped} já existiam', none: 'Nenhum post novo.',
        draftMode: 'Modo: entra como rascunho (revise e publique)', liveMode: 'Modo: publica direto',
      },
      mediaPage: {
        title: 'Banco de imagens', subtitle: 'Toda imagem enviada ganha um ID. Digite o ID (img:12, #12 ou só 12) em qualquer campo de imagem: conteúdo, blog, jutsu, mastery, vila, clã...',
        upload: 'Enviar imagens', uploading: 'Enviando...', search: 'Buscar por nome ou ID...', empty: 'Nenhuma imagem ainda.',
        sync: 'Importar da pasta de uploads', syncing: 'Importando...', syncDone: '{n} imagem(ns) importada(s).',
        rename: 'Renomear', renamePrompt: 'Nome da imagem #{id}:', delete: 'Apagar', confirmDelete: 'Apagar a imagem #{id}? O arquivo some do servidor.',
        confirmForce: 'A imagem #{id} está em uso ({uses}). Apagar mesmo assim? Esses lugares ficarão com a imagem quebrada.', copyId: 'Copiar ID', copyUrl: 'Copiar endereço', copied: 'Copiado!',
        dropHere: 'Solte as imagens aqui para enviar', progress: 'Enviando {done}/{total}...', skipped: '{n} arquivo(s) ignorado(s): só PNG, JPG, GIF e WEBP.', failedFile: '{name}: {error}', retryFailed: 'Tentar de novo ({n} com falha)', allCategories: 'Todas', uncategorized: 'Sem categoria', categoryOf: 'Categoria', newUploadCategory: 'Categoria dos novos envios', setCategory: 'Mudar categoria...', applyCategory: 'Aplicar', pageOf: 'Página {page} de {pages}', prev: 'Anterior', next: 'Próxima', noUploadPermission: 'Você não tem permissão para enviar imagens aqui (peça ao S.Adm).', resetIds: 'Resetar IDs', searchingAll: 'Buscando em todas as categorias (as visíveis para você).', restrictedNotice: 'Existe imagem com esse nome/ID numa categoria fechada. Você não tem acesso para ver essa informação.', closedDenied: 'Acesso negado: essa imagem está numa categoria fechada e você não tem acesso para vê-la.', resetIdsConfirm: 'Renumerar TODAS as imagens a partir do #1 (a mais antiga vira #1)? Os arquivos e o conteúdo já salvo não mudam, mas quem digitou um ID e ainda não salvou perde a referência. Com a biblioteca vazia, a contagem volta para #1.', resetIdsDone: 'IDs renumerados ({n} imagens).', categories: { weapon: 'Armas', clothing: 'Roupas', consumable: 'Consumíveis', currency: 'Moedas', material: 'Materiais', ring: 'Anéis', scroll: 'Pergaminhos', npc: 'NPCs', monster: 'Monstros', furniture: 'Móveis', hair_beard: 'Cabelo/Barba', closed: 'Fechadas (só S.Adm)', other: 'Outros' },
        selected: '{n} selecionada(s)', selectAll: 'Selecionar todas desta página', clearSel: 'Limpar seleção', deleteSelected: 'Apagar selecionadas',
        confirmBulk: 'Apagar {n} imagem(ns)? Os arquivos somem do servidor.', confirmBulkForce: '{n} imagem(ns) estão em uso (ex.: {where}). Apagar mesmo assim? Esses lugares ficarão com a imagem quebrada.',
        bulkDone: '{n} imagem(ns) apagada(s).', select: 'Selecionar',
        usedIn: 'Usada em', notUsed: 'Não está em uso.', loadError: 'Não foi possível carregar as imagens.', actionError: 'Não foi possível concluir a ação.',
        howTo: 'Como usar: copie o ID e cole no campo de imagem.', pickTitle: 'Escolher imagem do banco', pick: 'Usar esta', total: '{n} imagem(ns)', loadMore: 'Carregar mais', unnamed: 'sem nome', close: 'Fechar',
      },
      announcementPage: {
        title: 'Anúncio da Home', subtitle: 'Uma mensagem em destaque no topo da página inicial. Sem mensagem, nada aparece.',
        message: 'Mensagem (em inglês)', messageHint: 'Escreva em inglês: a tradução para português é automática (com a chave da DeepL) e aparece para quem usa o site em português.',
        messagePt: 'Mensagem em português (opcional)', messagePtHint: 'Deixe vazio para traduzir sozinho. Preencha só se quiser corrigir a tradução.',
        link: 'Link (opcional)', linkHint: 'https://... ou um caminho do site, como /blog', linkLabel: 'Texto do botão do link', level: 'Estilo',
        levels: { info: 'Informação', success: 'Novidade', warning: 'Aviso', event: 'Evento' }, preview: 'Como vai aparecer',
        save: 'Publicar anúncio', saving: 'Salvando...', saved: 'Anúncio publicado!', clear: 'Remover anúncio',
        confirmClear: 'Remover o anúncio? A Home volta a ficar sem nada.', none: 'Sem anúncio no ar agora.', loadError: 'Não foi possível carregar o anúncio.',
        saveError: 'Não foi possível salvar o anúncio.', updatedBy: 'Atualizado por {name}', counter: '{n}/600',
      },
      blogAdmin: {
        subtitle: 'Notícias e atualizações do site.', newPost: 'Novo post', search: 'Buscar pelo título...',
        colTitle: 'Título', colAuthor: 'Autor', colStatus: 'Status', colUpdated: 'Atualizado',
        published: 'Publicado', draft: 'Rascunho', edit: 'Editar', delete: 'Apagar',
        confirmDelete: 'Apagar o post "{title}"? Isso não pode ser desfeito.', empty: 'Nenhum post ainda.',
        loading: 'Carregando posts...', loadError: 'Erro ao carregar os posts.', deleteError: 'Não foi possível apagar.',
        editTitle: 'Editar post', newTitle: 'Novo post', back: 'Voltar', titleLabel: 'Título', titlePlaceholder: 'Título do post',
        slugLabel: 'Slug (endereço na URL)', slugHint: 'Gerado a partir do título; só letras minúsculas, números e hífen.',
        excerptLabel: 'Resumo', excerptHint: 'Texto curto que aparece na lista de posts.', coverLabel: 'Imagem de capa (miniatura)', bannerLabel: 'Banner do topo do post', bannerHint: 'Imagem larga (ideal ~5:1) no topo da página do post. Vazio = usa a capa.',
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
        
        shortDescription: 'Descrição curta (aparece no cartão)', longDescription: 'Descrição completa',
        clansTitle: 'Clãs', addClan: 'Adicionar clã', clanName: 'Nome', clanId: 'ID', clanImage: 'Imagem do clã', clanImageHint: 'Envie uma imagem com a logo e a roupa que o clã usa.', clanDescription: 'Descrição',
        removeClan: 'Remover clã', noClans: 'Nenhum clã. Clique em "Adicionar clã".',
        orgsTitle: 'Organizações', orgsSubtitle: 'Corpos especializados (ANBU, Hunter Nin...) que podem existir em mais de uma vila.',
        newOrg: 'Nova organização', orgName: 'Nome', orgDescription: 'Descrição', orgVillages: 'Atua nas vilas',
        orgConfirmDelete: 'Apagar a organização "{name}"?', orgEmpty: 'Nenhuma organização cadastrada.', orgSave: 'Salvar organização',
        orgCancel: 'Cancelar', orgEditTitle: 'Editar organização', backToVillages: 'Voltar às vilas', noVillagesYet: 'Cadastre uma vila primeiro.',
        orgNameRequired: 'O nome é obrigatório.', orgIdInvalid: 'O id deve ter só letras minúsculas, números e hífen (ex: anbu).',
        orgTranslationNote: 'Escreva em inglês (idioma principal). A versão em português é gerada pela DeepL ao salvar; você pode corrigi-la na mão.',
        clanTranslationNote: 'Versão em português deste clã (vazio = a DeepL traduz ao salvar).',
      },
      sidebar: {
        media: 'Imagens',
        announcement: 'Anúncio da Home',
        overview: 'Visão Geral',
        blogPosts: 'Postagens do Blog',
        comments: 'Comentários',
        content: 'Conteúdo',
        masteries: 'Masteries',
        jutsus: 'Jutsus',
        bulkImport: 'Importar JSON',
        auditLog: 'Log de Auditoria',
        users: 'Usuários',
        staff: 'Equipe',
        permissions: 'Permissões',
        errors: 'Erros',
        villages: 'Vilas',
        organizations: 'Organizações',
        backToSite: 'Voltar ao site',
        groups: { wiki: 'Wiki', community: 'Comunidade', world: 'Mundo', system: 'Sistema' },
        breadcrumbHome: 'Painel',
        viewSite: 'Ver site',
      },
      errorsPage: {
        title: 'Erros e problemas', subtitle: 'Tudo que quebrou no wiki (API, site, tradução, ataques). O bot também avisa no Discord.',
        open: 'Abertos', resolved: 'Resolvidos', all: 'Todos', allSources: 'Todas as origens', empty: 'Nenhum problema por aqui. 🎉',
        loadError: 'Não foi possível carregar os erros.', actionError: 'Não foi possível concluir a ação.',
        occurrences: 'ocorrências', firstSeen: 'Primeira vez', lastSeen: 'Última vez', where: 'Onde no código', route: 'Rota / página', status: 'Status HTTP',
        resolve: 'Marcar como resolvido', reopen: 'Reabrir', delete: 'Apagar', confirmDelete: 'Apagar este registro de erro?',
        trace: 'Traceback (mascarado)', noTrace: 'Sem traceback para este tipo de problema.', resolvedBy: 'Resolvido por', ip: 'IP da última ocorrência', refresh: 'Atualizar',
        sources: { api: 'API', web: 'Site', deepl: 'DeepL', security: 'Segurança' },
        howTo: 'Se voltar a acontecer, o problema reabre sozinho e o bot avisa de novo.',
      },
      noticeBoard: {
        title: 'Quadro de avisos', subtitle: 'Recados e arquivos para a equipe.', empty: 'Nenhum aviso por enquanto.',
        newNotice: 'Novo aviso', titleLabel: 'Título', bodyLabel: 'Mensagem', pin: 'Fixar no topo', pinned: 'Fixado',
        save: 'Publicar', saving: 'Salvando...', cancel: 'Cancelar', edit: 'Editar', delete: 'Apagar',
        confirmDelete: 'Apagar o aviso "{title}" e os arquivos anexados?', attachFiles: 'Anexar arquivo', files: 'Arquivos',
        download: 'Baixar', removeFile: 'Remover arquivo', uploading: 'Enviando...', by: 'por',
        loadError: 'Não foi possível carregar os avisos.', saveError: 'Não foi possível salvar o aviso.',
        uploadError: 'Não foi possível enviar o arquivo.', maxInfo: 'Até 10 arquivos por aviso — aceita .zip, .rar, .7z, PDF, imagens e outros (máx. 200 MB cada).', fileTooBig: 'O arquivo "{name}" passa de {mb} MB.',
      },
      rolesPage: {
        customTitle: 'Cargos personalizados', customSubtitle: 'Crie cargos como Tradutor, Moderador ou Redator, escolha o que cada um pode fazer e dê o cargo na tela Staff.',
        newRole: 'Novo cargo', editRole: 'Editar cargo', roleName: 'Nome do cargo', roleColor: 'Cor', roleDescription: 'Descrição (opcional)',
        createRole: 'Criar cargo', saveRole: 'Salvar cargo', deleteRole: 'Apagar cargo', confirmDeleteRole: 'Apagar o cargo "{name}"? Isso não pode ser desfeito.',
        membersCount: '{n} pessoa(s)', noCustomRoles: 'Nenhum cargo personalizado ainda.',
        presetHint: 'Começa com as permissões de um Creator; marque ou desmarque o que quiser.', selectAll: 'Marcar tudo', clearAll: 'Limpar', nameRequired: 'Dê um nome ao cargo.',
        baseNote: 'Cargos personalizados ficam no nível do Creator: nunca gerenciam a equipe nem as permissões (isso é só do S.Adm).',
        title: 'Permissões por cargo', subtitle: 'Defina o que cada cargo pode fazer no painel. As alterações valem na hora.',
        permission: 'Permissão', locked: 'Só S.Adm', lockedHint: 'Exclusiva do S.Adm: não pode ser dada a outros cargos.',
        save: 'Salvar', saving: 'Salvando...', saved: 'Salvo!', reset: 'Restaurar padrão',
        confirmReset: 'Voltar as permissões de {role} ao padrão?', loadError: 'Não foi possível carregar as permissões.',
        saveError: 'Não foi possível salvar.', unsavedChanges: 'Alterações não salvas', alwaysAll: 'O S.Adm sempre tem todas as permissões.',
        groups: { content: 'Conteúdo', posts: 'Blog', lore: 'Lore (Masteries, Jutsus, Vilas)', tools: 'Ferramentas', imagecats: 'Categorias do banco de imagens (desmarque para TRANCAR a categoria para este cargo)', notices: 'Quadro de avisos', staff: 'Equipe e cargos', audit: 'Log', analytics: 'Acessos' },
        names: {
          'content.create': 'Criar conteúdo', 'content.edit': 'Editar conteúdo', 'content.publish': 'Publicar / despublicar conteúdo', 'content.delete': 'Apagar conteúdo', 'content.import': 'Importar conteúdo em massa',
          'posts.create': 'Criar posts', 'posts.edit': 'Editar posts', 'posts.publish': 'Publicar / despublicar posts', 'posts.delete': 'Apagar posts', 'comments.moderate': 'Moderar comentários e banir leitores',
          'lore.edit': 'Editar Masteries, Jutsus, Vilas e Organizações', 'lore.delete': 'Apagar Jutsus, Vilas e Organizações',
          'uploads.create': 'Enviar imagens', 'translation.retranslate': 'Retraduzir conteúdo',
          'notices.view': 'Ver avisos e baixar arquivos', 'notices.manage': 'Postar, editar e apagar avisos', 'announcement.manage': 'Editar o anúncio da Home', 'media.manage': 'Renomear/apagar imagens do banco de imagens', 'media.upload': 'Enviar imagens pelo banco de imagens (lote)', 'media.reset_ids': 'Renumerar os IDs do banco de imagens', 'media.closed': 'Ver a categoria fechada do banco de imagens', 'media.cat.weapon': 'Ver imagens: Armas', 'media.cat.clothing': 'Ver imagens: Roupas', 'media.cat.consumable': 'Ver imagens: Consumíveis', 'media.cat.currency': 'Ver imagens: Moedas', 'media.cat.material': 'Ver imagens: Materiais', 'media.cat.ring': 'Ver imagens: Anéis', 'media.cat.scroll': 'Ver imagens: Pergaminhos', 'media.cat.npc': 'Ver imagens: NPCs', 'media.cat.monster': 'Ver imagens: Monstros', 'media.cat.furniture': 'Ver imagens: Móveis', 'media.cat.hair_beard': 'Ver imagens: Cabelo/Barba', 'media.cat.other': 'Ver imagens: Outros', 'media.cat.none': 'Ver imagens: Sem categoria',
          'staff.view': 'Ver a equipe', 'staff.create': 'Cadastrar equipe', 'staff.edit': 'Trocar cargo', 'staff.deactivate': 'Desativar / reativar equipe', 'staff.delete': 'Remover alguém da equipe', 'roles.manage': 'Editar permissões dos cargos', 'errors.view': 'Ver erros e problemas do wiki',
          'audit.view': 'Ver o log de conteúdo', 'audit.view_all': 'Ver o log completo (com IPs)', 'audit.clear': 'Limpar o log', 'analytics.view': 'Ver os acessos ao site',
        },
      },
      analytics: { title: 'Acessos ao site', subtitle: 'Contagem anônima: sem cookies e sem guardar IP.', views: 'Visualizações', visitors: 'Visitantes', last: 'Últimos', days: 'dias', countries: 'Países que mais acessam', places: 'Cidades e estados', placesHint: 'Sem dados ainda. Para aparecer cidade e estado, ligue na Cloudflare: Rules → Settings → Managed Transforms → “Add visitor location headers”.', pages: 'Páginas mais vistas', noData: 'Ainda sem acessos registrados', noDataHint: 'Os números aparecem assim que alguém abrir o site público.', unknown: 'Desconhecido', loadError: 'Não foi possível carregar os acessos.', other: 'Outras', credit: 'Países via Cloudflare ou DB-IP; cidade e estado via Cloudflare.' },
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
        fontSize: 'Tamanho da letra', highlightColor: 'Cor de destaque (fundo)', automatic: 'Automático', noFill: 'Sem preenchimento', themeColors: 'Cores do tema', standardColors: 'Cores padrão', recentColors: 'Usadas recentemente', moreColors: 'Mais cores...', clearFormat: 'Limpar formatação', defaultFont: 'Padrão',
        insertFicha: 'Inserir Ficha', insertTable: 'Inserir Tabela',
      },
      jutsuPicker: { linked: 'Jutsu', linkedTitle: 'Ligado a um jutsu do catálogo — clique para desligar', placeholder: 'Ligar a um jutsu...', loading: 'Carregando...', noResults: 'Nenhum jutsu encontrado.' },
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
      emojiPicker: 'Escolher emoji',
      uploadProgress: { sending: 'Enviando', processing: 'Enviado! O servidor está processando…', files: 'arquivos' },
      imageUpload: {
        dropHere: 'Solte a imagem aqui', library: 'Banco de imagens', idResolved: 'Imagem #{id} do banco', idNotFound: 'Não existe imagem #{id} no banco.',
        uploading: 'Enviando...',
        chooseFile: 'Escolher arquivo',
        removeImage: 'Remover imagem',
        formatsHint: 'PNG, JPG, GIF ou WEBP, até 5MB.',
        uploadError: 'Erro ao enviar imagem.',
        manualPlaceholder: 'ou cole uma URL, um caminho ou o ID da imagem (img:12)...',
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
        clearLog: 'Limpar log', clearAll: 'Apagar tudo', clearOlder7: 'Mais antigos que 7 dias', clearOlder30: 'Mais antigos que 30 dias',
        clearConfirmAll: 'Apagar TODO o log? A equipe não verá mais nenhum registro anterior. Isso não pode ser desfeito (a limpeza fica registrada).',
        clearConfirmOlder: 'Apagar os registros com mais de {days} dias? Isso não pode ser desfeito (a limpeza fica registrada).',
        clearDone: '{n} registros apagados.', clearError: 'Não foi possível limpar o log.',
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
        mottoLabel: 'Lema (Português)', climateLabel: 'Clima (Português)', longDescriptionLabel: 'Descrição completa (Português)',
        titleLabel: 'Título (Português)', excerptLabel: 'Resumo (Português)', contentLabel: 'Conteúdo (Português)',
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
        pathIdPlaceholder: 'id',
        pathNamePlaceholder: 'Nome do caminho',
        pathDescriptionPlaceholder: 'Descrição',
        pathRequirementPlaceholder: 'Requisito (opcional)',
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
        idPlaceholder: '',
        mastery: 'Mastery',
        path: 'Caminho (opcional)',
        pathNone: 'Nenhum',
        masteryUtility: 'Utility (sem mastery — qualquer pessoa pode usar)',
        tier: 'Tier (1-5)',
        chakraCost: 'Custo de chakra',
        icon: 'Ícone',
        range: 'Alcance',
        rangePlaceholder: '',
        castTime: 'Tempo de conjuração',
        castTimePlaceholder: '',
        cooldown: 'Cooldown',
        cooldownPlaceholder: '',
        effect: 'Efeito',
        effectPlaceholder: '',
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
        mobMonster: 'Monstro', mobBoss: 'Boss', mobNpc: 'NPC', mobMount: 'Montaria',
        itemGeneral: 'Geral', itemRing: 'Ring', itemAccessory: 'Acessório', itemShirt: 'Camisa', itemVest: 'Colete', itemPant: 'Calça', itemHat: 'Chapéu', itemMask: 'Máscara', itemShoe: 'Sapato', itemConsumable: 'Consumível', itemMaterial: 'Material',
        itemCurrency: 'Moeda', itemCast: 'Cast', itemAuthority: 'Autoridade', itemPack: 'Pack', itemWardrobe: 'Guarda-roupa', wardrobeKind: 'Tipo de peça',
        editTitle: 'Editar entry', newTitle: 'Nova entry',
        name: 'Nome', category: 'Categoria', mobType: 'Tipo de mob', itemType: 'Tipo de item',
        slugLabel: 'Slug (identificador na URL)',
        back: 'Voltar',
        icon: 'Ícone (emoji)',
        speed: 'Speed', speedPlaceholder: '',
        requirement: 'Requisito pra usar', requirementPlaceholder: 'Ex.: 60 Agility', addRequirement: 'Adicionar requisito',
        weaponNpc: 'NPC (onde conseguir)', weaponNpcPlaceholder: '',
        weaponType: 'Tipo', weaponTypePlaceholder: '',
        weaponBaseDamage: 'Dano Base', weaponBaseDamagePlaceholder: '',
        weaponSpecialAbility: 'Habilidade Especial', weaponSpecialAbilityPlaceholder: '',
        weaponKnockbackDistance: 'Distância de Knockback', weaponKnockbackDistancePlaceholder: '',
        levelZeroHint: 'Nível 0 = item sem nível (nada aparece no site).', maxStack: 'Max Stack', maxStackPlaceholder: '', castVillage: 'Vila que pode usar',
        rarity: 'Raridade', level: 'Nível', image: 'Imagem',
        description: 'Descrição', descriptionPlaceholder: 'Descrição curta, sempre visível na página...', optionalSuffix: '(opcional)',
        lore: 'Lore', loreOptional: 'Lore (opcional)', lorePlaceholder: 'História, contexto...',
        synergy: 'Sinergia', synergyOptional: 'Sinergia (opcional)',
        synergyPlaceholder: 'Dica de estratégia, combinação com outras técnicas...',
        spawnLocation: 'Local de spawn (opcional)', spawnLocationPlaceholder: '',
        mobSheet: 'Ficha do Mob', health: 'Health', healthPlaceholder: '',
        damage: 'Damage', damagePlaceholder: '',
        experience: 'Experience', experiencePlaceholder: '',
        range: 'Range', rangePlaceholder: '',
        respawnTime: 'Respawn Time', respawnTimePlaceholder: '',
        attacksTitle: 'Jutsu / Attacks', attackPlaceholder: '',
        noAttacks: 'Nenhum ataque ainda ("None" na ficha pública).',
        attributesTitle: 'Atributos', attributeLabelPlaceholder: 'Rótulo',
        attributeValuePlaceholder: 'Valor', noAttributes: 'Nenhum atributo ainda.',
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
    siteName: 'Nin Online Wiki',
    siteTagline: 'The definitive encyclopedia of the Nin world',
    nav: {
      home: 'Home',
      blog: 'Blog',
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
      empty: 'No news published yet.',
    },
    lore: {
      home: 'Home', villagesTitle: 'Hidden Villages', villagesSubtitle: 'The great shinobi powers — each with its own culture and element.',
      villagesCrumb: 'Villages', villageNotFound: 'Village not found.', backToVillages: 'Back to Villages',
      masteryNotFound: 'Mastery not found.', backToMasteries: 'Back to Masteries', jutsuNotFound: 'Jutsu not found.',
      entryNotFound: 'Entry not found.', back: 'Back', pageNotFound: 'Page not found.', backHome: 'Back to home',
      aboutVillage: 'About the Village', clans: 'Clans', organizations: 'Organizations', villageSheet: 'Village Sheet', otherVillages: 'Other Villages',
      fName: 'Name', fEnglish: 'English', fPortuguese: 'Portuguese', fElement: 'Element', fMotto: 'Motto', fClimate: 'Climate', fLeader: 'Leader',
      emblemAlt: 'Emblem of {name}', mapTitle: 'World Map', mapSubtitle: 'The three great shinobi nations and their territories.', mapCrumb: 'Map',
      mapMarkerAria: 'View information about {title}', mapHint: 'Hover over a point — or use Tab — to see information about the place.',
      demo: 'Demonstration', jutsuDemoAlt: 'Demonstration of the jutsu {name}',
      guideMore: 'More in Guides', guideAttributes: 'Attributes', guideProfessions: 'Professions', guideRanks: 'Ninja Ranks', guideArcs: 'Story Arcs', guideSummons: 'Summons',
      guideGathering: 'Gathering', guideCrafting: 'Crafting',
    },
    siteError: { title: 'Something went wrong', text: 'The team has been notified. Please try again in a moment.', retry: 'Try again', home: 'Back to home' },
    blog: {
      title: 'Blog',
      subtitle: 'News, patch notes and updates from the Nin world.',
      empty: 'No posts published yet.',
      loadError: 'Could not load posts right now.',
      notFound: 'Post not found.',
      back: 'Back to the Blog',
      by: 'by',
      updated: 'Updated on',
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
      itemsFilterWardrobe: 'Wardrobe',
      itemsFilterRings: 'Rings',
      itemsFilterPack: 'Pack',
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
      itemDetails: 'Details', itemType: 'Type',
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
      mobHealth: 'Health', mobDamage: 'Damage', mobExperience: 'Experience', mobRange: 'Range', mobRespawn: 'Respawn', combatStats: 'Combat',
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
    invite: {
      title: 'Bring NinWiki to your server', subtitle: 'The wiki bot looks up items, mobs, weapons and jutsus right inside Discord (/search) and shows whether the site is up (/status).',
      button: 'Invite the bot to your server', buttonShort: 'Invite the bot', perms: 'It only asks for the essentials: view channels, send messages, embed links and read history.',
    },
    announcement: { dismiss: 'Dismiss announcement', learnMore: 'Learn more' },
    blogx: {
      editor: {
        image: 'Insert image (upload)', imageAlt: 'Image alt text (describe what it shows; helps screen reader users):',
        imageError: 'Could not upload the image.', quote: 'Quote', codeBlock: 'Code block', video: 'YouTube or Twitch video',
        videoPrompt: 'Paste the video link (YouTube or Twitch):', videoInvalid: 'Link not recognized. Use a YouTube or Twitch link.',
        spoiler: 'Spoiler (hides the selected text until the reader clicks)', spoilerTitle: 'Spoiler — click to reveal', words: 'words', characters: 'characters',
      },
      post: {
        tagsLabel: 'Tags / categories', tagsHint: 'Up to 8. They help readers filter the blog.', newTagPlaceholder: 'New tag (in English)...', addTag: 'Create tag',
        tagError: 'Could not create the tag.', tagsMax: 'Maximum of 8 tags.',
        seoTitle: 'SEO (Google and social media)', seoHint: 'Optional. If left empty, the post title and excerpt are used.',
        metaTitleLabel: 'Title for Google', metaDescLabel: 'Description for Google', metaTitleHint: 'Up to 70 characters.', metaDescHint: 'Up to 200 characters.',
        scheduleLabel: 'Publish date', scheduleHint: 'Leave empty to publish now. A future date schedules the post: readers only see it once the time arrives.',
        scheduleClear: 'Clear date', schedule: 'Schedule', scheduledBadge: 'Scheduled', scheduledPast: 'Pick a date in the future to schedule.',
        preview: 'Preview', previewTitle: 'Preview', previewNote: 'This is how the post looks to readers (with the text you have not saved yet).', close: 'Close',
        unsavedWarning: 'You have unsaved changes. Leave anyway?', createdTagOk: 'Tag created.',
      },
      public: {
        allPosts: 'All', filterByTag: 'Filter by tag', minRead: 'min read', contents: 'In this post', published: 'Published on',
        like: 'Like', unlike: 'Unlike', likes: 'likes', comments: 'Comments', noComments: 'No comments yet. Be the first!',
        writeComment: 'Write a comment', commentPlaceholder: 'What did you think?', send: 'Comment', sending: 'Sending...',
        loginToComment: 'Sign in with Discord to comment.', loginToLike: 'Sign in with Discord to like.', loginDiscord: 'Sign in with Discord',
        logout: 'Sign out', signedInAs: 'You are signed in as', deleteComment: 'Delete', confirmDeleteComment: 'Delete your comment?',
        commentError: 'Could not send the comment.', likeError: 'Could not register the like.',
        charsLeft: 'characters left', errBanned: 'Your account can no longer comment on this site.', errRateLimited: 'Too many attempts. Wait a moment and try again.',
        errGeneric: 'Could not sign in with Discord. Try again.', loadCommentsError: 'Could not load the comments.',
        commentsRules: 'Be respectful. The team can hide comments and block accounts.', spoilerNote: 'Spoiler — click to open', scheduledNote: 'This post is scheduled and not yet visible to readers.',
      },
      moderation: {
        title: 'Comments', subtitle: 'Moderate readers\' comments on blog posts.', search: 'Search text or name...', onlyHidden: 'Hidden only',
        empty: 'No comments.', hide: 'Hide', show: 'Show', delete: 'Delete', confirmDelete: 'Delete this comment for good?',
        ban: 'Ban reader', unban: 'Unban', confirmBan: 'Ban "{name}"? They lose the ability to comment and like immediately.',
        hiddenBy: 'hidden by', hiddenBadge: 'Hidden', bannedBadge: 'Banned', onPost: 'on post', loadError: 'Error loading comments.',
        actionError: 'Could not complete the action.', refresh: 'Refresh', discordId: 'Discord ID',
      },
    },
    jutsuInfo: {
      requirements: 'Requirements', acquisition: 'Acquisition', techniqueDetails: 'Technique Details', battleData: 'Battle Data',
      mastery: 'Mastery', level: 'Level', stat: 'Stat', tier: 'Tier', shop: 'Shop', maxLevel: 'Maximum Level', baseDamage: 'Base Damage',
      chakraCost: 'Chakra Cost', cooldown: 'Cooldown', castTime: 'Cast Time', castType: 'Cast Type', specialEffect: 'Special Effect',
      jutsuClass: 'Class', range: 'Range', debuff: 'Debuff', levelWord: 'Level', cpUnit: 'CP',
      allowedWeapons: 'Allowed weapons', isNpc: 'NPC jutsu', isNpcHint: 'Version of the jutsu taught/used by an NPC: it gets its own section (NPC card in Masteries).', source: 'Source', npcSource: 'NPC',
      sheetTitle: 'Jutsu sheet', sheetHint: 'Empty rows are hidden on the page. Values are in English (game terms).',
      requiredLevel: 'Required level', requiredStat: 'Required stat', scrollType: 'Scroll type',
      scrollTypeHint: 'Shown in Acquisition > Tier with the tier numeral (1 to 5 becomes I to V).',
      maxLevelHint: 'From 1 to 10. Sets how many per-level fields appear below.', perLevelHint: 'One value per level; leave empty what does not apply.',
      levelN: 'Level {n}', tierHint: 'From 1 to 5 (5 is the maximum).',
      levelsTitle: 'Levels: name, base damage and cooldown', levelsHint: 'One row per jutsu level (the maximum level is the number of rows). The name is optional: fill it only on the levels where the jutsu changes name (e.g. level 4). Click "Add level" when the jutsu levels up.', levelNamePlaceholder: 'Name at this level (optional)', nameByLevel: 'Name by level', nameFromLevel: 'From level {n}: {name}',
      addLevel: 'Add level', removeLevel: 'Remove level',
    },
    maintenance: { title: 'Under maintenance', text: 'We are building this page. Please come back soon!', back: 'Back to home' },
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
        roleDescSuperAdmin: 'System owner: full access, Staff and Permissions (only them).',
        roleDescAdmin: 'Publishes, deletes, edits Lore and posts notices (adjustable in Permissions).',
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
        remove: 'Remove', confirmRemove: 'REMOVE {name} from the team for good? They lose access immediately and this cannot be undone (their history in the log stays). To only take access away for a while, use Deactivate.',
        you: 'you',
        add: 'Register', adding: 'Registering...',
        noStaff: 'No members registered.',
        loadError: 'Error loading the staff.',
        actionError: 'Could not complete the action.',
        noManageable: 'no permission',
        editName: 'Edit name', saveName: 'Save', cancelName: 'Cancel', nameHint: 'The name is saved and signing in with Discord no longer changes it.',
        logByLabel: 'Type',
        logAll: 'All', logContent: 'Content', logAuth: 'Logins', logStaff: 'Staff', logSecurity: 'Security',
        logActions: {
          create: 'created', update: 'updated', delete: 'deleted', upload: 'uploaded an image',
          'bulk-status': 'changed the status of', 'bulk-delete': 'bulk-deleted', 'bulk-import': 'imported',
          login: 'signed in', logout: 'signed out', login_denied: 'had a login denied', role_change: 'changed the role of', rename: 'renamed', clear_log: 'cleared the log', clear: 'removed', sync: 'imported images into',
          activate: 'reactivated', deactivate: 'deactivated', bootstrap: 'was created as owner', bootstrap_restore: 'had the owner role restored',
          permission_denied: 'tried something without permission on', resolve: 'resolved', reopen: 'reopened', reset: 'restored the defaults of', delete_file: 'removed a file from',
        },
        logEntities: {
          content_item: 'entry', jutsu: 'jutsu', mastery: 'mastery', upload: 'file',
          auth: 'session', staff: 'member', security: 'route', village: 'village', organization: 'organization', post: 'post', roles: 'role permissions', notice: 'notice', announcement: 'Home announcement', media: 'image', error: 'error',
        },
        logSources: { panel: 'Panel', bot: 'Bot', auth: 'Login', system: 'System' },
      },
      steamImport: {
        title: 'Steam news', desc: 'Automatically copies every new game update post from Steam to the blog (Patch Notes tag).', run: 'Import now', running: 'Checking Steam...',
        importPost: 'Import a specific post (even an old one or without the tag)', postPlaceholder: 'Paste the Steam post link (…/news/app/…/view/123456789)', importThis: 'Import this post', refreshAll: 'Refresh already imported posts (fixes images and formatting)', last: 'Last check', seenTitle: 'What Steam returned (title · tags) — if none has the patch notes tag, Steam did not mark your posts as patchnotes:', capsuleNotes: 'Thumbnails: Steam did not return the image for some posts (the first image of the text was used):', noTags: 'no tags', result: '{fetched} fetched · {matched} patch notes · {imported} imported · {skipped} already there', none: 'No new posts.',
        draftMode: 'Mode: imported as draft (review and publish)', liveMode: 'Mode: publishes directly',
      },
      mediaPage: {
        title: 'Image library', subtitle: 'Every uploaded image gets an ID. Type the ID (img:12, #12 or just 12) in any image field: content, blog, jutsu, mastery, village, clan...',
        upload: 'Upload images', uploading: 'Uploading...', search: 'Search by name or ID...', empty: 'No images yet.',
        sync: 'Import from the uploads folder', syncing: 'Importing...', syncDone: '{n} image(s) imported.',
        rename: 'Rename', renamePrompt: 'Name of image #{id}:', delete: 'Delete', confirmDelete: 'Delete image #{id}? The file is removed from the server.',
        confirmForce: 'Image #{id} is in use ({uses}). Delete anyway? Those places will end up with a broken image.', copyId: 'Copy ID', copyUrl: 'Copy address', copied: 'Copied!',
        dropHere: 'Drop the images here to upload', progress: 'Uploading {done}/{total}...', skipped: '{n} file(s) skipped: only PNG, JPG, GIF and WEBP.', failedFile: '{name}: {error}', retryFailed: 'Retry {n} failed', allCategories: 'All', uncategorized: 'Uncategorized', categoryOf: 'Category', newUploadCategory: 'Category for new uploads', setCategory: 'Set category...', applyCategory: 'Apply', pageOf: 'Page {page} of {pages}', prev: 'Previous', next: 'Next', noUploadPermission: 'You are not allowed to upload images here (ask the S.Adm).', resetIds: 'Reset IDs', searchingAll: 'Searching all categories (the ones you can see).', restrictedNotice: 'An image with that name/ID exists in a closed category. You do not have access to view that information.', closedDenied: 'Access denied: this image is in a closed category and you are not allowed to view it.', resetIdsConfirm: 'Renumber ALL images from #1 (the oldest becomes #1)? Files and saved content are not affected, but anyone who typed an ID and has not saved yet loses that reference. With an empty library the count restarts at #1.', resetIdsDone: 'IDs renumbered ({n} images).', categories: { weapon: 'Weapons', clothing: 'Clothing', consumable: 'Consumables', currency: 'Currency', material: 'Materials', ring: 'Rings', scroll: 'Scrolls', npc: 'NPCs', monster: 'Monsters', furniture: 'Furniture', hair_beard: 'Hair/Beard', closed: 'Closed (S.Adm only)', other: 'Other' },
        selected: '{n} selected', selectAll: 'Select all on this page', clearSel: 'Clear selection', deleteSelected: 'Delete selected',
        confirmBulk: 'Delete {n} image(s)? The files are removed from the server.', confirmBulkForce: '{n} image(s) are in use (e.g. {where}). Delete anyway? Those places will end up with a broken image.',
        bulkDone: '{n} image(s) deleted.', select: 'Select',
        usedIn: 'Used in', notUsed: 'Not in use.', loadError: 'Could not load the images.', actionError: 'Could not complete the action.',
        howTo: 'How to use: copy the ID and paste it into an image field.', pickTitle: 'Pick an image from the library', pick: 'Use this one', total: '{n} image(s)', loadMore: 'Load more', unnamed: 'unnamed', close: 'Close',
      },
      announcementPage: {
        title: 'Home announcement', subtitle: 'A highlighted message at the top of the home page. With no message, nothing is shown.',
        message: 'Message (in English)', messageHint: 'Write it in English: the Portuguese version is automatic (with the DeepL key) and shown to visitors using the site in Portuguese.',
        messagePt: 'Message in Portuguese (optional)', messagePtHint: 'Leave empty to translate automatically. Fill it only to fix the translation.',
        link: 'Link (optional)', linkHint: 'https://... or a page of the site, like /blog', linkLabel: 'Link button text', level: 'Style',
        levels: { info: 'Info', success: 'News', warning: 'Warning', event: 'Event' }, preview: 'How it will look',
        save: 'Publish announcement', saving: 'Saving...', saved: 'Announcement published!', clear: 'Remove announcement',
        confirmClear: 'Remove the announcement? The home page goes back to showing nothing.', none: 'No announcement live right now.', loadError: 'Could not load the announcement.',
        saveError: 'Could not save the announcement.', updatedBy: 'Updated by {name}', counter: '{n}/600',
      },
      blogAdmin: {
        subtitle: 'News and updates for the site.', newPost: 'New post', search: 'Search by title...',
        colTitle: 'Title', colAuthor: 'Author', colStatus: 'Status', colUpdated: 'Updated',
        published: 'Published', draft: 'Draft', edit: 'Edit', delete: 'Delete',
        confirmDelete: 'Delete the post "{title}"? This cannot be undone.', empty: 'No posts yet.',
        loading: 'Loading posts...', loadError: 'Error loading posts.', deleteError: 'Could not delete.',
        editTitle: 'Edit post', newTitle: 'New post', back: 'Back', titleLabel: 'Title', titlePlaceholder: 'Post title',
        slugLabel: 'Slug (URL address)', slugHint: 'Generated from the title; lowercase letters, numbers and hyphens only.',
        excerptLabel: 'Excerpt', excerptHint: 'Short text shown in the post list.', coverLabel: 'Cover image (thumbnail)', bannerLabel: 'Post banner', bannerHint: 'Wide image (about 5:1) at the top of the post page. Empty = uses the cover.',
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
        
        shortDescription: 'Short description (shown on the card)', longDescription: 'Full description',
        clansTitle: 'Clans', addClan: 'Add clan', clanName: 'Name', clanId: 'ID', clanImage: 'Clan image', clanImageHint: 'Upload one image with the clan logo and the outfit its members wear.', clanDescription: 'Description',
        removeClan: 'Remove clan', noClans: 'No clans. Click "Add clan".',
        orgsTitle: 'Organizations', orgsSubtitle: 'Specialized corps (ANBU, Hunter Nin...) that can exist in more than one village.',
        newOrg: 'New organization', orgName: 'Name', orgDescription: 'Description', orgVillages: 'Operates in villages',
        orgConfirmDelete: 'Delete the organization "{name}"?', orgEmpty: 'No organizations registered.', orgSave: 'Save organization',
        orgCancel: 'Cancel', orgEditTitle: 'Edit organization', backToVillages: 'Back to villages', noVillagesYet: 'Register a village first.',
        orgNameRequired: 'The name is required.', orgIdInvalid: 'The id must have only lowercase letters, numbers and hyphens (e.g. anbu).',
        orgTranslationNote: 'Write in English (the main language). The Portuguese version is generated by DeepL when you save; you can correct it by hand.',
        clanTranslationNote: 'Portuguese version of this clan (empty = DeepL translates it on save).',
      },
      sidebar: {
        media: 'Images',
        announcement: 'Home announcement',
        overview: 'Overview',
        blogPosts: 'Blog Posts',
        comments: 'Comments',
        content: 'Content',
        masteries: 'Masteries',
        jutsus: 'Jutsus',
        bulkImport: 'Import JSON',
        auditLog: 'Audit Log',
        users: 'Users',
        staff: 'Staff',
        permissions: 'Permissions',
        errors: 'Errors',
        villages: 'Villages',
        organizations: 'Organizations',
        backToSite: 'Back to site',
        groups: { wiki: 'Wiki', community: 'Community', world: 'World', system: 'System' },
        breadcrumbHome: 'Admin',
        viewSite: 'View site',
      },
      errorsPage: {
        title: 'Errors and problems', subtitle: 'Everything that broke in the wiki (API, website, translation, attacks). The bot also alerts on Discord.',
        open: 'Open', resolved: 'Resolved', all: 'All', allSources: 'All sources', empty: 'No problems here. 🎉',
        loadError: 'Could not load the errors.', actionError: 'Could not complete the action.',
        occurrences: 'occurrences', firstSeen: 'First seen', lastSeen: 'Last seen', where: 'Where in the code', route: 'Route / page', status: 'HTTP status',
        resolve: 'Mark as resolved', reopen: 'Reopen', delete: 'Delete', confirmDelete: 'Delete this error record?',
        trace: 'Traceback (masked)', noTrace: 'No traceback for this kind of problem.', resolvedBy: 'Resolved by', ip: 'IP of the last occurrence', refresh: 'Refresh',
        sources: { api: 'API', web: 'Website', deepl: 'DeepL', security: 'Security' },
        howTo: 'If it happens again the problem reopens by itself and the bot alerts again.',
      },
      noticeBoard: {
        title: 'Notice board', subtitle: 'Announcements and files for the team.', empty: 'No notices yet.',
        newNotice: 'New notice', titleLabel: 'Title', bodyLabel: 'Message', pin: 'Pin to top', pinned: 'Pinned',
        save: 'Post', saving: 'Saving...', cancel: 'Cancel', edit: 'Edit', delete: 'Delete',
        confirmDelete: 'Delete the notice "{title}" and its attached files?', attachFiles: 'Attach file', files: 'Files',
        download: 'Download', removeFile: 'Remove file', uploading: 'Uploading...', by: 'by',
        loadError: 'Could not load the notices.', saveError: 'Could not save the notice.',
        uploadError: 'Could not upload the file.', maxInfo: 'Up to 10 files per notice — accepts .zip, .rar, .7z, PDF, images and more (max 200 MB each).', fileTooBig: 'The file "{name}" is larger than {mb} MB.',
      },
      rolesPage: {
        customTitle: 'Custom roles', customSubtitle: 'Create roles like Translator, Moderator or Writer, choose what each one can do and give the role on the Staff page.',
        newRole: 'New role', editRole: 'Edit role', roleName: 'Role name', roleColor: 'Color', roleDescription: 'Description (optional)',
        createRole: 'Create role', saveRole: 'Save role', deleteRole: 'Delete role', confirmDeleteRole: 'Delete the role "{name}"? This cannot be undone.',
        membersCount: '{n} person(s)', noCustomRoles: 'No custom roles yet.',
        presetHint: 'Starts with a Creator\'s permissions; check or uncheck whatever you like.', selectAll: 'Select all', clearAll: 'Clear', nameRequired: 'Give the role a name.',
        baseNote: 'Custom roles sit at the Creator level: they never manage the staff or the permissions (that is S.Adm only).',
        title: 'Role permissions', subtitle: 'Choose what each role can do in the panel. Changes apply immediately.',
        permission: 'Permission', locked: 'S.Adm only', lockedHint: 'S.Adm exclusive: cannot be given to other roles.',
        save: 'Save', saving: 'Saving...', saved: 'Saved!', reset: 'Restore defaults',
        confirmReset: 'Reset the permissions of {role} to the defaults?', loadError: 'Could not load the permissions.',
        saveError: 'Could not save.', unsavedChanges: 'Unsaved changes', alwaysAll: 'S.Adm always has every permission.',
        groups: { content: 'Content', posts: 'Blog', lore: 'Lore (Masteries, Jutsus, Villages)', tools: 'Tools', imagecats: 'Image library categories (untick to LOCK a category for this role)', notices: 'Notice board', staff: 'Staff and roles', audit: 'Log', analytics: 'Traffic' },
        names: {
          'content.create': 'Create content', 'content.edit': 'Edit content', 'content.publish': 'Publish / unpublish content', 'content.delete': 'Delete content', 'content.import': 'Bulk import content',
          'posts.create': 'Create posts', 'posts.edit': 'Edit posts', 'posts.publish': 'Publish / unpublish posts', 'posts.delete': 'Delete posts', 'comments.moderate': 'Moderate comments and ban readers',
          'lore.edit': 'Edit Masteries, Jutsus, Villages and Organizations', 'lore.delete': 'Delete Jutsus, Villages and Organizations',
          'uploads.create': 'Upload images', 'translation.retranslate': 'Re-translate content',
          'notices.view': 'View notices and download files', 'notices.manage': 'Post, edit and delete notices', 'announcement.manage': 'Edit the Home announcement', 'media.manage': 'Rename/delete images in the image library', 'media.upload': 'Upload images to the image library (bulk)', 'media.reset_ids': 'Renumber the image library IDs', 'media.closed': 'See the closed category of the image library', 'media.cat.weapon': 'See images: Weapons', 'media.cat.clothing': 'See images: Clothing', 'media.cat.consumable': 'See images: Consumables', 'media.cat.currency': 'See images: Currency', 'media.cat.material': 'See images: Materials', 'media.cat.ring': 'See images: Rings', 'media.cat.scroll': 'See images: Scrolls', 'media.cat.npc': 'See images: NPCs', 'media.cat.monster': 'See images: Monsters', 'media.cat.furniture': 'See images: Furniture', 'media.cat.hair_beard': 'See images: Hair/Beard', 'media.cat.other': 'See images: Other', 'media.cat.none': 'See images: Uncategorized',
          'staff.view': 'View staff', 'staff.create': 'Add staff', 'staff.edit': 'Change role', 'staff.deactivate': 'Deactivate / reactivate staff', 'staff.delete': 'Remove someone from the team', 'roles.manage': 'Edit role permissions', 'errors.view': 'View wiki errors and problems',
          'audit.view': 'View the content log', 'audit.view_all': 'View the full log (with IPs)', 'audit.clear': 'Clear the log', 'analytics.view': 'View site traffic',
        },
      },
      analytics: { title: 'Site traffic', subtitle: 'Anonymous counts: no cookies and no stored IPs.', views: 'Views', visitors: 'Visitors', last: 'Last', days: 'days', countries: 'Top countries', places: 'Cities and states', placesHint: 'No data yet. To get city and state, turn on in Cloudflare: Rules → Settings → Managed Transforms → “Add visitor location headers”.', pages: 'Most viewed pages', noData: 'No visits recorded yet', noDataHint: 'Numbers show up as soon as someone opens the public site.', unknown: 'Unknown', loadError: 'Could not load the traffic numbers.', other: 'Other', credit: 'Countries via Cloudflare or DB-IP; city and state via Cloudflare.' },
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
        fontSize: 'Font size', highlightColor: 'Highlight color', automatic: 'Automatic', noFill: 'No fill', themeColors: 'Theme colors', standardColors: 'Standard colors', recentColors: 'Recent colors', moreColors: 'More colors...', clearFormat: 'Clear formatting', defaultFont: 'Default',
        insertFicha: 'Insert Sheet', insertTable: 'Insert Table',
      },
      jutsuPicker: { linked: 'Jutsu', linkedTitle: 'Linked to a catalog jutsu — click to unlink', placeholder: 'Link a jutsu...', loading: 'Loading...', noResults: 'No jutsu found.' },
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
      emojiPicker: 'Pick an emoji',
      uploadProgress: { sending: 'Uploading', processing: 'Sent! The server is processing…', files: 'files' },
      imageUpload: {
        dropHere: 'Drop the image here', library: 'Image library', idResolved: 'Library image #{id}', idNotFound: 'There is no image #{id} in the library.',
        uploading: 'Uploading...',
        chooseFile: 'Choose file',
        removeImage: 'Remove image',
        formatsHint: 'PNG, JPG, GIF or WEBP, up to 5MB.',
        uploadError: 'Error uploading image.',
        manualPlaceholder: 'or paste a URL, a path or the image ID (img:12)...',
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
        clearLog: 'Clear log', clearAll: 'Delete everything', clearOlder7: 'Older than 7 days', clearOlder30: 'Older than 30 days',
        clearConfirmAll: 'Delete the ENTIRE log? The team will no longer see any earlier record. This cannot be undone (the clearing itself is recorded).',
        clearConfirmOlder: 'Delete records older than {days} days? This cannot be undone (the clearing itself is recorded).',
        clearDone: '{n} records deleted.', clearError: 'Could not clear the log.',
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
        mottoLabel: 'Motto (Portuguese)', climateLabel: 'Climate (Portuguese)', longDescriptionLabel: 'Full description (Portuguese)',
        titleLabel: 'Title (Portuguese)', excerptLabel: 'Excerpt (Portuguese)', contentLabel: 'Content (Portuguese)',
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
        pathRequirementPlaceholder: 'Requirement (optional)',
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
        idPlaceholder: '',
        mastery: 'Mastery',
        path: 'Path (optional)',
        pathNone: 'None',
        masteryUtility: 'Utility (no mastery — anyone can use it)',
        tier: 'Tier (1-5)',
        chakraCost: 'Chakra cost',
        icon: 'Icon',
        range: 'Range',
        rangePlaceholder: '',
        castTime: 'Cast time',
        castTimePlaceholder: '',
        cooldown: 'Cooldown',
        cooldownPlaceholder: '',
        effect: 'Effect',
        effectPlaceholder: '',
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
        mobMonster: 'Monster', mobBoss: 'Boss', mobNpc: 'NPC', mobMount: 'Mount',
        itemGeneral: 'General', itemRing: 'Ring', itemAccessory: 'Accessory', itemShirt: 'Shirt', itemVest: 'Vest', itemPant: 'Pant', itemHat: 'Hat', itemMask: 'Mask', itemShoe: 'Shoe', itemConsumable: 'Consumable', itemMaterial: 'Material',
        itemCurrency: 'Currency', itemCast: 'Cast', itemAuthority: 'Authority', itemPack: 'Pack', itemWardrobe: 'Wardrobe', wardrobeKind: 'Piece type',
        editTitle: 'Edit entry', newTitle: 'New entry',
        name: 'Name', category: 'Category', mobType: 'Mob type', itemType: 'Item type',
        slugLabel: 'Slug (URL identifier)',
        back: 'Back',
        icon: 'Icon (emoji)',
        speed: 'Speed', speedPlaceholder: '',
        requirement: 'Requirement to use', requirementPlaceholder: 'e.g. 60 Agility', addRequirement: 'Add requirement',
        weaponNpc: 'NPC (where to get)', weaponNpcPlaceholder: '',
        weaponType: 'Type', weaponTypePlaceholder: '',
        weaponBaseDamage: 'Base Damage', weaponBaseDamagePlaceholder: '',
        weaponSpecialAbility: 'Special Ability', weaponSpecialAbilityPlaceholder: '',
        weaponKnockbackDistance: 'Knockback Distance', weaponKnockbackDistancePlaceholder: '',
        levelZeroHint: 'Level 0 = item without a level (nothing is shown on the site).', maxStack: 'Max Stack', maxStackPlaceholder: '', castVillage: 'Village that can use it',
        rarity: 'Rarity', level: 'Level', image: 'Image',
        description: 'Description', descriptionPlaceholder: 'Short description, always visible on the page...', optionalSuffix: '(optional)',
        lore: 'Lore', loreOptional: 'Lore (optional)', lorePlaceholder: 'History, context...',
        synergy: 'Synergy', synergyOptional: 'Synergy (optional)',
        synergyPlaceholder: 'Strategy tip, combination with other techniques...',
        spawnLocation: 'Spawn location (optional)', spawnLocationPlaceholder: '',
        mobSheet: 'Mob Sheet', health: 'Health', healthPlaceholder: '',
        damage: 'Damage', damagePlaceholder: '',
        experience: 'Experience', experiencePlaceholder: '',
        range: 'Range', rangePlaceholder: '',
        respawnTime: 'Respawn Time', respawnTimePlaceholder: '',
        attacksTitle: 'Jutsu / Attacks', attackPlaceholder: '',
        noAttacks: 'No attacks yet ("None" on the public page).',
        attributesTitle: 'Attributes', attributeLabelPlaceholder: 'Label',
        attributeValuePlaceholder: 'Value', noAttributes: 'No attributes yet.',
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
