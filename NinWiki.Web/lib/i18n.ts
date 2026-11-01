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
import { tournamentsEn, tournamentsPt, type TournamentsDict } from './i18n-tournaments';
import { discordEn, discordPt, type DiscordDict } from './i18n-discord';

// A interface Dictionary e' o "contrato": toda chave que existir aqui
// tem que existir OBRIGATORIAMENTE nos dois idiomas abaixo (pt e en).
// O TypeScript acusa erro de compilacao se faltar uma chave em algum
// dos dois - e' a garantia de que nao existe texto traduzido so' num idioma.
/** Textos do formulario publico de voluntarios (/volunteer). */
export interface VolunteerDict {
  title: string; subtitle: string; intro: string; home: string;
  sectionAbout: string; sectionHelp: string; sectionMotivation: string;
  closedTitle: string; closedText: string;
  discord: string; discordPh: string; discordHint: string; gameNick: string; gameNickPh: string;
  languages: string; languagesPh: string; areas: string; areasHint: string; areaNames: Record<string, string>;
  availability: string; availabilityPh: string; motivation: string; motivationPh: string;
  email: string; emailHint: string; consent: string;
  privacyTitle: string; privacyPurpose: string; privacyWho: string; privacyDelete: string; privacyNoIp: string;
  send: string; sending: string; successTitle: string; successText: string; sendAnother: string; fixErrors: string; sendError: string;
  errors: Record<string, string>;
}

/** Textos da tela /admin/volunteers (avaliacao das inscricoes). */
export interface VolunteersPageDict {
  title: string; subtitle: string; refresh: string; all: string; statuses: Record<string, string>; searchPh: string; empty: string;
  loadError: string; actionError: string; newCount: string; submittedOn: string; reviewedBy: string; discord: string; gameNick: string;
  languages: string; areas: string; availability: string; motivation: string; email: string; notes: string; notesPh: string;
  saveNotes: string; saved: string; setStatus: string; delete: string; confirmDelete: string; showing: string; prev: string; next: string; details: string; close: string;
  formOpen: string; formClosed: string; formOpenHint: string; formClosedHint: string; closeForm: string; openForm: string; toggleError: string;
}

/** Textos das novidades do blog: editor, pagina do post, leitores (curtir/comentar) e moderacao. */
export interface BlogxDict {
  editor: {
    image: string; imageAlt: string; imageError: string; quote: string; codeBlock: string; video: string;
    videoPrompt: string; videoInvalid: string; spoiler: string; spoilerTitle: string; words: string; characters: string;
  };
  post: {
    tagsLabel: string; tagsHint: string; newTagPlaceholder: string; addTag: string; tagError: string; tagsMax: string;
    seoTitle: string; seoHint: string; metaTitleLabel: string; metaDescLabel: string; metaTitleHint: string; metaDescHint: string;
    scheduleLabel: string; scheduleHint: string; scheduleClear: string; schedule: string; scheduledBadge: string; 
    preview: string; previewTitle: string; previewNote: string; close: string; unsavedWarning: string;
  };
  public: {
    allPosts: string; filterByTag: string; minRead: string; contents: string; published: string;
    like: string; unlike: string; likes: string; comments: string; noComments: string; writeComment: string;
    commentPlaceholder: string; send: string; sending: string; loginToComment: string; loginToLike: string; loginDiscord: string;
    logout: string; signedInAs: string; deleteComment: string; confirmDeleteComment: string; commentError: string; likeError: string;
    charsLeft: string; errBanned: string; errRateLimited: string; errGeneric: string; loadCommentsError: string;
    commentsRules: string; 
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
  levelN: string; tierHint: string;
  levelsTitle: string; levelsHint: string; levelNamePlaceholder: string; nameByLevel: string; nameFromLevel: string; addLevel: string; removeLevel: string;
}

export interface Dictionary {
  siteName: string;
  siteTagline: string;
  siteSubline: string;
  compare: { title: string; subtitle: string; search: string; noResults: string; change: string; pickBoth: string; button: string };
  nav: { home: string; mobs: string; items: string; guides: string; masteries: string; weapons: string; missions: string; village: string; proficiencies: string; map: string; blog: string; tournaments: string; openMenu: string };
  home: { welcome: string; subtitle: string; };
  news: { title: string; subtitle: string; readMore: string; viewAll: string; empty: string };
  lore: {
    home: string; villagesTitle: string; villagesSubtitle: string; villagesCrumb: string; backToVillages: string;
    back: string; pageNotFound: string; backHome: string;
    aboutVillage: string; clans: string; organizations: string; villageSheet: string; otherVillages: string;
    fName: string; fEnglish: string; fPortuguese: string; fElement: string; fMotto: string; fClimate: string; fLeader: string;
    emblemAlt: string; mapAria: string; mapTitle: string; mapSubtitle: string; mapCrumb: string; mapHint: string; mapDrops: string; mapZoomIn: string; mapZoomOut: string; mapSource: string;
    mapFind: string; mapNoResult: string; mapLegend: string; mapTerritories: string; mapFullscreen: string; mapExitFullscreen: string; mapFit: string; mapPlace: string; mapArea: string; mapKindShop: string; mapKindDungeon: string; mapKindMailbox: string; mapKindNotice: string; mapKindWedding: string;
    mapScroll: string; mapRender: string; mapInfoTitle: string; mapInfoLoading: string; mapZone: string; mapZoneSafe: string; mapZoneDanger: string; mapZoneWar: string; mapZoneNone: string; mapVillage: string; mapHouses: string; mapPlaces: string; mapExits: string; mapNpcs: string; mapMobs: string; mapResources: string; mapRooms: string; mapViewImage: string; mapClose: string; mapLevelShort: string; mapDirNorth: string; mapDirSouth: string; mapDirEast: string; mapDirWest: string; mapDirOther: string;
    mapKindHospital: string; mapKindBounty: string; mapKindMissions: string; mapKindBoss: string; mapKindTravel: string; mapKindBarber: string; mapKindHeadbands: string; mapKindPolling: string; mapKindLeaderboards: string; mapKindCheckpoint: string; mapKindCapture: string; mapLevels: string; mapKey: string; mapShowAll: string; mapHousesN: string; mapLevelRange: string; mapCopyLink: string; mapLinkCopied: string; mapDoors: string; mapPinsTitle: string; mapGoTo: string; mapStatShops: string; mapTravelRoutes: string; mapCollapse: string; mapChief: string; mapInsideOf: string; mapShowMarkers: string; mapMyHint: string;
    demo: string; jutsuDemoAlt: string;
    guideMore: string; guideAttributes: string; guideArcs: string; guideSummons: string;
    guideGathering: string; guideCrafting: string;
    proficienciesTitle: string; proficienciesSubtitle: string; proficienciesCrumb: string; profHowTitle: string; profHowCap: string; profHowBonus: string; profHowFormula: string; profHowExp: string;
    profCalcTitle: string; profCalcFrom: string; profCalcTo: string; profCalcResult: string; profMilestones: string; profColLevel: string; profColXp: string; profColBonus: string;
    profRecipesCount: string; profResourcesCount: string; profToolsCount: string; profSearch: string; profNoMatch: string; profPrice: string; profSources: string; profTipsTitle: string; 
    guideSections: { 'new-player': string; combat: string; progression: string; interface: string; economy: string; systems: string };
    guideBackToGuide: string; guideSystemsMissions: string; guideSystemsProficiencies: string; 
    missionsx: Record<'title' | 'subtitle' | 'searchPlaceholder' | 'results' | 'noResults' | 'clear' | 'filterArea' | 'filterType' | 'filterRank' | 'filterLevel' | 'filterAll' | 'repeatableOnly' | 'levelFmt' | 'levelUnknown' | 'rankFmt' | 'giver' | 'location' | 'requirements' | 'objectives' | 'rewards' | 'rewardExp' | 'rewardRyo' | 'about' | 'request' | 'notes' | 'source' | 'notice' | 'inClient' | 'notInClient' | 'differsFromClient' | 'back' | 'howTitle' | 'howDeskGuide' | 'howLogGuide' | 'partial' | 'sortLevel' | 'crumb' | 'relatedGuides' | 'exp' | 'ryo', string> & { types: Record<'daily' | 'repeatable' | 'story' | 'side', string>; areas: Record<'leaf' | 'sand' | 'mist' | 'takumi' | 'land-of-spirits' | 'land-of-iron', string> };
    guidex: Record<'searchPlaceholder' | 'noResults' | 'startHere' | 'startHereDesc' | 'step' | 'browse' | 'guidesCount' | 'onThisPage' | 'readMin' | 'previous' | 'next' | 'related' | 'topicCount' | 'allTopics' | 'results' | 'topics' | 'beginner' | 'openSection' | 'viewAll', string> & { sectionDesc: Record<'new-player' | 'combat' | 'progression' | 'interface' | 'economy', string> };
    professionBack: string; professionResources: string; professionRecipes: string; professionTools: string; professionLevel: string; professionWorkbench: string; professionLearnedFrom: string; professionNeeds: string; professionNoDetails: string; professionOpen: string; profTabOverview: string; profTabResources: string; profTabRecipes: string; profTabTools: string; profLevelAll: string; profLevelRange: string; profBenchAll: string; profBenchYes: string; profBenchNo: string; profLearnAll: string; profLearnKnown: string; profLearnItem: string; profShowing: string; profClear: string; profWhere: string; profWhereNone: string; profOnMap: string; profDrops: string; profNoRecipesYet: string; profLevelLabel: string; profIngredients: string; profSortLevel: string;
  };
  siteError: { title: string; text: string; retry: string; home: string };
  blogx: BlogxDict;
  volunteer: VolunteerDict;
  tournaments: TournamentsDict;   // torneios e perfis (lib/i18n-tournaments.ts)
  discord: DiscordDict;   // menu do usuario, origem de vila/rank no perfil e painel Discord (lib/i18n-discord.ts)
  maintenance: { title: string; text: string; back: string; siteTitle: string; siteText: string; staffLogin: string; staffChecking: string; staffHint: string; badge: string };
  jutsuInfo: JutsuInfoDict;
  blog: { title: string; subtitle: string; empty: string; loadError: string; notFound: string; back: string; by: string; updated: string; official: string };
  report: { button: string; title: string; subtitle: string; kindLabel: string; outdated: string; translation: string; other: string; messageLabel: string; placeholder: string; send: string; sending: string; cancel: string; thanks: string; close: string; tooShort: string; error: string };
  catalog: { level: string; levelRange: string; results: string; search: string; noResults: string; itemsFilterConsumables: string; itemsFilterMaterials: string; itemsFilterWardrobe: string; itemsFilterTool: string; itemsFilterScroll: string; itemsFilterRings: string; itemsFilterPack: string; itemsFilterSpecial: string };
  detail: { itemDetails: string; itemType: string; attributes: string; drops: string; lore: string; synergy: string; copied: string; back: string; level: string; noDrops: string; droppedBy: string; crafted: string; updatedOn: string; autoTranslated: string; autoTranslatedHint: string; relatedEntries: string; spawnLocation: string; zones: Record<string, string>; soldAt: string; forQty: string; free: string; attacks: string; noAttacks: string; maxStack: string; castVillage: string; speed: string; requirement: string; requirementsSection: string; acquisitionSection: string; weaponDetailsSection: string; battleDataSection: string; levelReq: string; statReq: string; npc: string; weaponClass: string; weaponType: string; baseDamage: string; specialAbility: string; attackSpeed: string; statBonus: string; knockbackDistance: string; mobHealth: string; mobDamage: string; mobExperience: string; mobRange: string; mobRespawn: string; combatStats: string; rarities: Record<string, string> };
  masteryDetail: {
    notFound: string; elemental: string; nonElemental: string;
    aboutMastery: string; masteryPaths: string; noJutsusInPath: string; jutsusOfMastery: string;
    noJutsusYet: string; masterySheet: string; nameLabel: string; typeLabel: string; elementLabel: string;
    jutsusLabel: string; relatedAttributes: string; noAttributesConfirmed: string; paths: string;
    home: string; listSubtitle: string;
    otherJutsus: string; utilityTitle: string; utilitySubtitle: string; utilityIntro: string; utilityEmpty: string; utilityCta: string;
  };
  jutsuDetail: {
    notFound: string; noPath: string;
    aboutJutsu: string; home: string;
    tier1: string; tier2: string; tier3: string; tier4: string; tier5: string;
  };
  footer: { disclaimer: string; madeWith: string };
  invite: { title: string; subtitle: string; button: string; buttonShort: string; perms: string; badge: string; examplesTitle: string; examples: { cmd: string; text: string }[]; stepsTitle: string; steps: { title: string; text: string }[]; note: string };
  announcement: { dismiss: string; learnMore: string };
  admin: {
    login: { welcome: string; subtitle: string; button: string };
    // Fase 2: autenticacao, cargos, equipe e log geral
    auth: {
      checkingSession: string; logout: string; apiUnreachable: string; retry: string;
      noAccessTitle: string; noAccessBody: string; backToOverview: string;
      errNotStaff: string; errMfa: string; errInactive: string; errDiscordFailed: string; errDiscordDenied: string;
      errInvalidState: string; errNotConfigured: string; errGeneric: string; errRateLimited: string;
      devTitle: string; devHint: string; devPlaceholder: string; devButton: string; devError: string;
      roleSuperAdmin: string; roleAdmin: string; roleCreator: string;
      roleDescSuperAdmin: string; roleDescAdmin: string; roleDescCreator: string;
      staffTitle: string; staffSubtitle: string; addStaff: string; discordId: string; discordIdHint: string;
      displayName: string; displayNameHint: string; role: string; status: string; lastLogin: string;
      neverLoggedIn: string; active: string; inactive: string; owner: string; ownerHint: string;
      deactivate: string; activate: string; confirmDeactivate: string; you: string; remove: string; confirmRemove: string;
      add: string; adding: string; noStaff: string; loadError: string; actionError: string; editName: string; saveName: string; cancelName: string; nameHint: string;
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
    // Modo manutencao do site (so' S.Adm)
    maintenanceAdmin: {
      title: string; subtitle: string; statusOn: string; statusOff: string; enable: string; disable: string; confirmEnable: string; confirmDisable: string;
      messageEn: string; messagePt: string; messageHint: string; staffNote: string; loading: string; loadError: string; saveError: string; saving: string; savedOn: string; savedOff: string;
    };
    // Artigos do Guia e Proficiencias (painel)
    guideAdmin: {
      articlesTitle: string; articlesSubtitle: string; newArticle: string; professionsTitle: string; professionsSubtitle: string; newProfession: string;
      loading: string; loadError: string; empty: string; colTitle: string; colSection: string; colStatus: string; colGroup: string; colDetails: string; colName: string;
      edit: string; delete: string; confirmDelete: string; deleteError: string; published: string; draft: string; all: string;
      back: string; saving: string; save: string; saveError: string; newArticleTitle: string; editArticleTitle: string; newProfessionTitle: string; editProfessionTitle: string;
      id: string; idLocked: string; section: string; position: string; icon: string; status: string; statusPublished: string; statusDraft: string;
      title: string; titlePt: string; summary: string; summaryPt: string; body: string; bodyPt: string; translationNote: string;
      name: string; namePt: string; group: string; groupGathering: string; groupCrafting: string; emoji: string; description: string; descriptionPt: string; detailsNote: string; detailsCount: string;
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
    sidebar: { media: string; announcement: string; overview: string; blogPosts: string; comments: string; content: string; contentMobs: string; contentItems: string; contentWeapons: string; contentMissions: string; masteries: string; jutsus: string; bulkImport: string; auditLog: string; users: string; staff: string; permissions: string; errors: string; reports: string; volunteers: string; tournaments: string; discordLinks: string; botServers: string; translations: string; villages: string; organizations: string; guideArticles: string; professions: string; maintenance: string; backToSite: string; groups: { wiki: string; community: string; bot: string; world: string; system: string }; breadcrumbHome: string; viewSite: string; panelTitle: string; versionTitle: string };
    gameNames: { title: string; subtitle: string; chooseFiles: string; invalidFile: string; find: string; loadError: string; summary: string; truncated: string; search: string; hideJutsu: string; selectShown: string; clear: string; empty: string; moreHidden: string; createDrafts: string; confirm: string; created: string; note: string; categories: Record<string, string>; hints: Record<string, string> };
    translationsPage: { title: string; subtitle: string; chooseFile: string; invalidFile: string; wrongLanguage: string; fileInfo: string; overwrite: string; overwriteHint: string; preview: string; apply: string; confirmApply: string; working: string; resultTitle: string; applied: string; nothing: string; colType: string; colRecords: string; colChanges: string; colNoMatch: string; types: Record<string, string>; fields: Record<string, string>; samples: string; noMatchNames: string; loadError: string; howTo: string };
    versionHistory: { title: string; hint: string; empty: string; restore: string; confirm: string; by: string; loadError: string; restoreError: string };
    volunteersPage: VolunteersPageDict;
    reportsPage: { title: string; subtitle: string; open: string; resolved: string; dismissed: string; all: string; allKinds: string; kinds: Record<string, string>; targets: Record<string, string>; empty: string; loadError: string; actionError: string; resolve: string; dismiss: string; reopen: string; delete: string; confirmDelete: string; refresh: string; reportedOn: string; handledBy: string; language: string };
    errorsPage: {
      title: string; subtitle: string; open: string; resolved: string; all: string; allSources: string; empty: string; loadError: string; actionError: string;
      occurrences: string; firstSeen: string; lastSeen: string; where: string; route: string; status: string; resolve: string; reopen: string; delete: string;
      confirmDelete: string; trace: string; noTrace: string; resolvedBy: string; ip: string; refresh: string; sources: Record<string, string>;
      howTo: string; hintTitle: string;
    };
    noticeBoard: { title: string; subtitle: string; empty: string; newNotice: string; titleLabel: string; bodyLabel: string; pin: string; pinned: string; save: string; saving: string; cancel: string; edit: string; delete: string; confirmDelete: string; attachFiles: string; files: string; removeFile: string; uploading: string; by: string; loadError: string; saveError: string; uploadError: string; maxInfo: string; fileTooBig: string };
    rolesPage: { preview: string; customTitle: string; customSubtitle: string; newRole: string; editRole: string; roleName: string; roleColor: string; roleDescription: string; createRole: string; saveRole: string; deleteRole: string; confirmDeleteRole: string; membersCount: string; noCustomRoles: string; presetHint: string; selectAll: string; clearAll: string; nameRequired: string; baseNote: string; title: string; subtitle: string; permission: string; locked: string; lockedHint: string; save: string; saving: string; saved: string; reset: string; confirmReset: string; loadError: string; saveError: string; unsavedChanges: string; alwaysAll: string; groups: Record<string, string>; names: Record<string, string> };
    header: { role: { admin: string; mod: string } };
    analytics: { title: string; subtitle: string; views: string; visitors: string; last: string; days: string; countries: string; places: string; placesHint: string; pages: string; noData: string; noDataHint: string; unknown: string; loadError: string; other: string; credit: string };
    overview: {
      title: string; totalPosts: string; recentActivity: string;
      viewAll: string; noActivity: string; system: string;
      entityContentItem: string; entityJutsu: string;
      actionCreated: string; actionUpdated: string; actionDeleted: string;
      contentByCategory: string; noEntriesYet: string;
      publishedVsDraft: string; published: string; draft: string;
      stalePages: string; daysAgo: string; nothingStale: string;
    };
    table: { title: string; category: string; author: string; status: string; actions: string; published: string; draft: string; newPost: string; edit: string; delete: string; search: string };
    editor: { titleLabel: string; categoryLabel: string; contentLabel: string; saveDraft: string; publish: string; back: string; titlePlaceholder: string; contentPlaceholder: string };
    users: { title: string; username: string; role: string; };
    richText: {
      placeholder: string; fichaTitle: string; fichaLabel: string; fichaValue: string;
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
      dropHere: string; progress: string; skipped: string; failedFile: string; retryFailed: string; allCategories: string; uncategorized: string; categoryOf: string; newUploadCategory: string; setCategory: string; applyCategory: string; pageOf: string; prev: string; next: string; noUploadPermission: string; restrictedNotice: string; closedDenied: string; searchingAll: string; resetIds: string; resetIdsConfirm: string; resetIdsDone: string; categories: Record<string, string>; selected: string; selectAll: string; clearSel: string; deleteSelected: string; confirmBulk: string; confirmBulkForce: string; bulkDone: string; select: string; loadError: string; actionError: string; howTo: string; pickTitle: string; pick: string; total: string; loadMore: string; unnamed: string; close: string;
    };
    uploadProgress: { sending: string; processing: string; files: string };
    emojiPicker: string;
    imageUpload: { dropHere: string; library: string; idResolved: string; idNotFound: string; uploading: string; chooseFile: string; removeImage: string; formatsHint: string; uploadError: string; manualPlaceholder: string };
    dataTable: { noResults: string; selected: string; selectedPlural: string; itemsPerPage: string; pageOf: string; items: string };
    auditLog: {
      title: string; subtitle: string; loading: string; loadError: string; empty: string;
      created: string; updated: string; deleted: string; system: string;
      clearLog: string; clearAll: string; clearOlder7: string; clearOlder30: string; clearConfirmAll: string; clearConfirmOlder: string; clearDone: string; clearError: string;
      entityContentItem: string; entityJutsu: string; 
    };
    masteries: {
      title: string; subtitle: string; loading: string; loadError: string; genericLoadError: string;
      elemental: string; nonElemental: string; paths: string; edit: string; viewJutsus: string;
    };
    translation: {
      sectionTitle: string; retranslate: string; retranslating: string; retranslateConfirm: string;
      nameLabel: string; descriptionLabel: string; spawnLocationLabel: string;
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
      colName: string; colMastery: string; colTier: string; colChakra: string; colStatus: string; published: string; draft: string;
      selectAll: string; selectRow: string; edit: string; delete: string;
      deleteConfirm: string; deleteError: string; bulkDeleteConfirm: string; bulkDeleteError: string;
    };
    jutsuEditor: {
      back: string; editTitle: string; newTitle: string; loading: string; loadError: string; saveError: string; save: string;
      name: string; englishName: string; idSlug: string; idSlugLocked: string; idPlaceholder: string;
      mastery: string; masteryUtility: string; path: string; pathNone: string;
      status: string; statusPublished: string; statusDraft: string; saveDraft: string; publish: string;
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
      bulkDeleteConfirm: string; bulkDeleteError: string; bulkItemType: string; bulkItemTypeApply: string; bulkItemTypeConfirm: string; bulkItemTypeError: string; publish: string; markDraft: string;
    };
    contentEditor: {
      catMobs: string; catItems: string; catWeapons: string; catMissions: string; catGuides: string;
      mobMonster: string; mobBoss: string; mobNpc: string; mobMount: string;
      itemGeneral: string; itemRing: string; itemAccessory: string; itemShirt: string; itemVest: string; itemPant: string; itemHat: string; itemMask: string; itemShoe: string; itemConsumable: string; itemMaterial: string; itemCurrency: string; itemCast: string; itemAuthority: string; itemPack: string; itemTool: string; itemScroll: string; itemWardrobe: string; wardrobeKind: string;
      editTitle: string; newTitle: string;
      name: string; category: string; mobType: string; itemType: string; slugLabel: string; back: string; icon: string;
      speed: string; speedPlaceholder: string; requirement: string; requirementPlaceholder: string; addRequirement: string;
      weaponNpc: string; weaponNpcPlaceholder: string; weaponType: string; weaponTypePlaceholder: string;
      weaponBaseDamage: string; weaponBaseDamagePlaceholder: string;
      weaponSpecialAbility: string; weaponSpecialAbilityPlaceholder: string;
      weaponKnockbackDistance: string; weaponKnockbackDistancePlaceholder: string;
      levelZeroHint: string; levelUnknown: string; maxStack: string; maxStackPlaceholder: string; castVillage: string;
      rarity: string; level: string; image: string;
      description: string; descriptionPlaceholder: string; optionalSuffix: string;
      lore: string; 
      synergy: string; 
      spawnLocation: string; spawnLocationPlaceholder: string; addLocation: string; locationPlaceholder: string; zoneLabel: string; removeLocation: string; zones: Record<string, string>;
      weaponNpcHint: string; weaponNpcLinked: string; convertText: string; salesTitle: string; addSale: string; saleShop: string; salePrice: string; saleCurrency: string; saleQty: string; removeSale: string;
      mobSheet: string; health: string; healthPlaceholder: string; damage: string; damagePlaceholder: string;
      experience: string; experiencePlaceholder: string; range: string; rangePlaceholder: string;
      respawnTime: string; respawnTimePlaceholder: string;
      attacksTitle: string; attackPlaceholder: string; noAttacks: string;
      attributesTitle: string; attributeValuePlaceholder: string; noAttributes: string;
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
    siteName: 'Nin Codex',
    siteTagline: 'A enciclopédia definitiva do mundo Nin',
    siteSubline: 'WIKI · MAPA · FERRAMENTAS',
    compare: {
      title: 'Comparar itens', subtitle: 'Escolha dois itens ou armas para ver os dados lado a lado. As linhas diferentes ficam destacadas.',
      search: 'Buscar item ou arma…', noResults: 'Nada encontrado.', change: 'Trocar', pickBoth: 'Escolha os dois lados para comparar.', button: 'Comparar',
    },
    nav: {
      home: 'Início',
      openMenu: 'Abrir menu',
      blog: 'Blog',
      tournaments: 'Torneios',
      mobs: 'Monstros',
      items: 'Itens',
      guides: 'Guias',
      masteries: 'Maestrias',
      weapons: 'Armas',
      missions: 'Missões',
      village: 'Vilas',
      proficiencies: 'Proficiências',
      map: 'Mapa',
    },
    home: {
      welcome: 'Bem-vindo à',
      subtitle: 'Explore o mundo de Nin Online — monstros, itens, armas e muito mais.',
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
      villagesCrumb: 'Vilas', backToVillages: 'Voltar para Vilas',
      back: 'Voltar', pageNotFound: 'Página não encontrada.', backHome: 'Voltar ao início',
      aboutVillage: 'Sobre a Vila', clans: 'Clãs', organizations: 'Organizações', villageSheet: 'Ficha da Vila', otherVillages: 'Outras Vilas',
      fName: 'Nome', fEnglish: 'Inglês', fPortuguese: 'Português', fElement: 'Elemento', fMotto: 'Lema', fClimate: 'Clima', fLeader: 'Líder',
      emblemAlt: 'Emblema da {name}', mapAria: 'Mapa do mundo de Nin', mapTitle: 'Mapa do Mundo', mapSubtitle: 'O mapa-múndi e as áreas do jogo.', mapCrumb: 'Mapa',
      mapHint: 'Arraste para mover, use a roda do mouse para dar zoom, busque um lugar ou clique numa área para ver o mapa dela.', mapDrops: 'Drops', mapZoomIn: 'Aumentar zoom', mapZoomOut: 'Diminuir zoom', mapSource: 'Imagens extraídas do cliente do jogo.',
      mapFind: 'Buscar lugar ou área...', mapNoResult: 'Nada encontrado.', mapLegend: 'Legenda', mapTerritories: 'Territórios das vilas', mapFullscreen: 'Tela cheia', mapExitFullscreen: 'Sair da tela cheia', mapFit: 'Ver o mundo inteiro', mapPlace: 'Lugar', mapArea: 'Área', mapKindShop: 'Lojas', mapKindDungeon: 'Calabouços', mapKindMailbox: 'Caixas de correio', mapKindNotice: 'Murais', mapKindWedding: 'Casamento',
      mapScroll: 'Pergaminho', mapRender: 'Render', mapInfoTitle: 'Informações da área', mapInfoLoading: 'Carregando...', mapZone: 'Zona', mapZoneSafe: 'Zona segura', mapZoneDanger: 'Zona de perigo', mapZoneWar: 'Zona de guerra', mapZoneNone: 'Sem zona', mapVillage: 'Vila', mapHouses: 'Casas', mapPlaces: 'Lugares', mapExits: 'Saídas', mapNpcs: 'NPCs', mapMobs: 'Monstros', mapResources: 'Recursos', mapRooms: 'Prédios', mapViewImage: 'Ver mapa da área', mapClose: 'Fechar', mapLevelShort: 'Nv.', mapDirNorth: 'Norte', mapDirSouth: 'Sul', mapDirEast: 'Leste', mapDirWest: 'Oeste', mapDirOther: 'Outra',
      mapKindHospital: 'Hospitais', mapKindBounty: 'Posto de recompensas', mapKindMissions: 'Missões', mapKindBoss: 'Chefes', mapKindTravel: 'Viagem', mapKindBarber: 'Barbeiro', mapKindHeadbands: 'Bandanas', mapKindPolling: 'Urna de votação', mapKindLeaderboards: 'Rankings', mapKindCheckpoint: 'Ponto de retorno', mapKindCapture: 'Ponto de captura', mapLevels: 'Níveis dos mobs', mapKey: 'Legenda do mapa', mapShowAll: 'Mostrar tudo', mapHousesN: '{n} casas', mapLevelRange: 'Nv {lv}', mapCopyLink: 'Copiar link', mapLinkCopied: 'Link copiado', mapDoors: 'Portas para outras áreas', mapPinsTitle: 'Mostrar na área', mapGoTo: 'Ir para', mapStatShops: 'Lojas', mapTravelRoutes: 'Rotas de viagem', mapCollapse: 'Recolher painel', mapChief: 'Chefe', mapInsideOf: 'Dentro de {name}', mapShowMarkers: 'Mostrar ou ocultar marcadores', mapMyHint: 'Arraste para mover, use a roda ou pinça para dar zoom e clique numa área para ver o que há dentro.',
      demo: 'Demonstração', jutsuDemoAlt: 'Demonstração do jutsu {name}',
      guideMore: 'Mais em Guias', guideAttributes: 'Atributos', guideArcs: 'Story Arcs', guideSummons: 'Summons',
      guideGathering: 'Coleta', guideCrafting: 'Criação',
      proficienciesTitle: 'Proficiências', proficienciesSubtitle: 'As habilidades de coleta e criação do jogo: o que cada uma faz, como evoluir e todas as receitas.', proficienciesCrumb: 'Proficiências',
      profHowTitle: 'Como funcionam', profHowCap: 'Cada proficiência evolui sozinha, até o nível 500.', profHowBonus: 'A cada 10 níveis você ganha +1% de bônus de habilidade (até +50% no nível 500).',
      profHowFormula: 'O bônus multiplica a chance base da receita: chance final = base × (1 + bônus). Uma receita de 90% chega a 100% no nível 120; uma de 50% termina em uns 75% no nível 500.',
      profHowExp: 'XP para passar de um nível L: 128 × L − 64. XP total do nível 1 até o nível N: 64 × (N − 1)².',
      profCalcTitle: 'Calculadora de XP', profCalcFrom: 'Do nível', profCalcTo: 'Até o nível', profCalcResult: 'XP necessário', profMilestones: 'Marcos', profColLevel: 'Nível', profColXp: 'XP total', profColBonus: 'Bônus',
      profRecipesCount: '{n} receitas', profResourcesCount: '{n} recursos', profToolsCount: '{n} ferramentas', profSearch: 'Buscar receita...', profNoMatch: 'Nada encontrado.', profPrice: 'Preço', profSources: 'Valores registrados pela comunidade (Nin Online Wiki, no Fandom) e pelo Nin Atlas; o jogo pode mudá-los.', profTipsTitle: 'Dicas', 
      guideSections: { 'new-player': 'Comece por aqui', combat: 'Combate e PvP', progression: 'Progressão', interface: 'Controles e interface', economy: 'Dinheiro', systems: 'Sistemas do jogo' },
      guideBackToGuide: 'Voltar ao Guia', guideSystemsMissions: 'Lista de missões, recompensas e passos para concluir.', guideSystemsProficiencies: 'Coleta e criação: níveis, bônus, XP e todas as receitas.', 
      missionsx: {
        title: 'Missões', subtitle: 'Todas as missões documentadas do Nin Online: nível, rank, quem dá, objetivos e recompensas.', searchPlaceholder: 'Buscar missão ou NPC...',
        results: '{n} missões', noResults: 'Nenhuma missão encontrada com esses filtros.', clear: 'Limpar filtros', filterArea: 'Região', filterType: 'Tipo', filterRank: 'Rank', filterLevel: 'Nível',
        filterAll: 'Todas', repeatableOnly: 'Só repetíveis', levelFmt: 'Nível {n}+', levelUnknown: 'Nível ?', rankFmt: 'Rank {r}', giver: 'Quem dá a missão', location: 'Local',
        requirements: 'Requisitos', objectives: 'Objetivos', rewards: 'Recompensas', rewardExp: 'EXP', rewardRyo: 'Ryo', about: 'Sobre a missão', request: 'Pedido (texto do jogo)', notes: 'Observações',
        source: 'Fonte: Nin Online Wiki (Fandom), licença CC-BY-SA.', notice: 'Dados da comunidade, ainda em revisão: valores podem mudar a cada atualização do jogo.',
        inClient: 'Nome confirmado nos arquivos do jogo', notInClient: 'Não encontrada nos arquivos do jogo (pode ter sido removida ou renomeada)', differsFromClient: 'Difere dos arquivos do jogo', back: 'Voltar às missões', howTitle: 'Como as missões funcionam', howDeskGuide: 'Mesa de designação de missões', howLogGuide: 'Diário de missões e rastreador',
        partial: 'Ficha parcial: objetivos ou recompensas ainda não registrados.', sortLevel: 'Ordenado por nível', crumb: 'Missões', relatedGuides: 'Guias relacionados', exp: 'EXP', ryo: 'Ryo',
        types: { daily: 'Diária', repeatable: 'Repetível', story: 'História', side: 'Secundária' },
        areas: { leaf: 'Folha', sand: 'Areia', mist: 'Névoa', takumi: 'Takumi', 'land-of-spirits': 'Terra dos Espíritos', 'land-of-iron': 'Terra do Ferro' },
      },
      guidex: {
        searchPlaceholder: 'Buscar no Guia...', noResults: 'Nenhum guia encontrado.', startHere: 'Comece por aqui', startHereDesc: 'Leia nesta ordem se você acabou de chegar ao Nin Online.', step: 'Passo {n}',
        browse: 'Explorar por assunto', guidesCount: '{n} guias', onThisPage: 'Nesta página', readMin: '{n} min de leitura', previous: 'Anterior', next: 'Próximo', related: 'Guias relacionados',
        topicCount: '{n} guias', allTopics: 'Todos os assuntos', results: '{n} resultados', topics: 'Assuntos', beginner: 'Para iniciantes', openSection: 'Ver assunto', viewAll: 'Ver todos',
        sectionDesc: { 'new-player': 'O que saber nos primeiros dias: academia, vila, missões e regras que pegam novatos de surpresa.', combat: 'PvP, zonas, recompensas, crimes e como se recuperar de uma derrota.', progression: 'Níveis, atributos, maestrias, cargos e tudo que faz seu ninja crescer.', interface: 'Teclas, comandos de chat, amigos e o painel do jogo.', economy: 'Como ganhar Ryo, cupons de evento e o que o Gold Ninja oferece.' },
      },
      professionBack: 'Voltar às Proficiências', professionResources: 'O que se coleta', professionRecipes: 'Receitas', professionTools: 'Ferramentas', professionLevel: 'Nível', professionWorkbench: 'Bancada', professionLearnedFrom: 'Aprendida com', professionNeeds: 'Ingredientes', professionNoDetails: 'Ainda não há mais informações sobre esta profissão.', professionOpen: 'Ver detalhes', profTabOverview: 'Visão geral', profTabResources: 'Recursos', profTabRecipes: 'Receitas', profTabTools: 'Ferramentas', profLevelAll: 'Todos os níveis', profLevelRange: 'Níveis {a}–{b}', profBenchAll: 'Qualquer estação', profBenchYes: 'Precisa de Bancada', profBenchNo: 'Sem Bancada', profLearnAll: 'Qualquer origem', profLearnKnown: 'Conhecida de início', profLearnItem: 'Aprendida com um item', profShowing: 'Mostrando {n} de {m}', profClear: 'Limpar filtros', profWhere: 'Onde coletar', profWhereNone: 'Local ainda desconhecido.', profOnMap: 'Abrir no mapa', profDrops: 'Rende', profNoRecipesYet: 'Nenhuma receita registrada ainda.', profLevelLabel: 'Nível', profIngredients: 'Ingredientes', profSortLevel: 'Ordenado por nível',
    },
    siteError: { title: 'Algo deu errado', text: 'A equipe já foi avisada. Tente de novo em instantes.', retry: 'Tentar de novo', home: 'Voltar ao início' },
    blog: {
      title: 'Blog',
      subtitle: 'Notícias, patch notes e novidades do mundo Nin.',
      empty: 'Nenhum post publicado ainda.',
      loadError: 'Não foi possível carregar os posts agora.',
      notFound: 'Post não encontrado.',
      back: 'Voltar para o Blog',
      official: 'Post oficial da Hitspark',
      by: 'por',
      updated: 'Atualizado em',
    },
    report: {
      button: 'Reportar', title: 'Reportar um problema', subtitle: 'Achou uma informação desatualizada ou um erro de tradução? Conte pra gente — a equipe vai revisar.',
      kindLabel: 'O que está errado?', outdated: 'Informação desatualizada', translation: 'Erro de tradução', other: 'Outro problema',
      messageLabel: 'Descreva o problema', placeholder: 'Ex.: A chance de drop mudou para 5% na última atualização.',
      send: 'Enviar report', sending: 'Enviando…', cancel: 'Cancelar', thanks: 'Obrigado! Seu report foi enviado para a equipe.', close: 'Fechar',
      tooShort: 'Escreva pelo menos 10 caracteres.', error: 'Não foi possível enviar o report. Tente de novo daqui a pouco.',
    },
    tournaments: tournamentsPt,
    discord: discordPt,
    volunteer: {
      title: 'Seja voluntário', subtitle: 'Ajude a manter o Nin Codex completo e atualizado.',
      intro: 'O Nin Codex é feito por fãs, de graça. Se você quer ajudar (traduzir, editar, coletar dados...), conte um pouco sobre você. A equipe lê todas as inscrições e responde pelo Discord.',
      home: 'Início', sectionAbout: 'Sobre você', sectionHelp: 'Como você quer ajudar', sectionMotivation: 'Motivação',
      closedTitle: 'Inscrições fechadas', closedText: 'No momento não estamos aceitando novos voluntários. Fique de olho nos avisos do site e do Discord: avisaremos quando reabrir.',
      discord: 'Usuário do Discord', discordPh: 'ex.: usuario123', discordHint: 'É por aqui que a equipe vai te chamar.',
      gameNick: 'Nick no Nin Online', gameNickPh: 'Seu personagem principal', languages: 'Idiomas que você fala', languagesPh: 'ex.: Português, Inglês',
      areas: 'Áreas de interesse', areasHint: 'Marque pelo menos uma.',
      areaNames: { translation: 'Tradução', 'wiki-editing': 'Edição do wiki', 'data-collection': 'Coleta de dados e prints', mapping: 'Mapas', moderation: 'Moderação', other: 'Outro' },
      availability: 'Disponibilidade', availabilityPh: 'ex.: umas 5 horas por semana, à noite',
      motivation: 'Por que você quer ajudar?', motivationPh: 'Escreva com suas palavras.',
      email: 'E-mail (opcional)', emailHint: 'Só se você preferir ser contatado por e-mail.',
      consent: 'Concordo que a equipe do Nin Codex guarde estes dados para avaliar minha inscrição.',
      privacyTitle: 'Privacidade', privacyPurpose: 'Para que usamos: apenas para avaliar sua inscrição e falar com você.',
      privacyWho: 'Quem vê: somente a equipe do Nin Codex. Nada é publicado.',
      privacyDelete: 'Para apagar seus dados, é só pedir pela equipe no Discord do projeto.', privacyNoIp: 'Não guardamos o seu IP.',
      send: 'Enviar inscrição', sending: 'Enviando…', successTitle: 'Inscrição enviada!', successText: 'Obrigado! A equipe vai avaliar e entrar em contato pelo Discord.',
      sendAnother: 'Enviar outra', fixErrors: 'Corrija os campos marcados e tente de novo.', sendError: 'Não foi possível enviar agora. Tente de novo daqui a pouco.',
      errors: { required: 'Campo obrigatório.', tooShort: 'Escreva um pouco mais.', tooLong: 'Texto longo demais.', pickArea: 'Escolha pelo menos uma área.', invalidEmail: 'E-mail inválido.', consentRequired: 'Você precisa concordar para enviar.' },
    },
    catalog: {
      level: 'Nível',
      levelRange: 'Níveis',
      results: 'resultados',
      search: 'Buscar...',
      noResults: 'Nenhum resultado encontrado.',
      itemsFilterConsumables: 'Consumíveis',
      itemsFilterMaterials: 'Materiais',
      itemsFilterWardrobe: 'Gear',
      itemsFilterRings: 'Anéis',
      itemsFilterPack: 'Pack',
      itemsFilterTool: 'Ferramentas',
      itemsFilterScroll: 'Pergaminhos / Manuais',
      itemsFilterSpecial: 'Itens Especiais',
    },
    detail: {
      attributes: 'Atributos',
      drops: 'Drops',
      lore: 'História',
      synergy: 'Sinergia & Build',
      copied: 'Copiado!',
      back: 'Voltar',
      level: 'Nível',
      noDrops: 'Este item não possui drops registrados.',
      droppedBy: 'Dropado por',
      crafted: 'Feito por craft',
      updatedOn: 'Atualizado em', autoTranslated: 'Tradução automática', autoTranslatedHint: 'Este texto em português foi traduzido automaticamente e ainda não foi revisado. Achou um erro? Use o botão Reportar.',
      relatedEntries: 'Relacionados',
      spawnLocation: 'Onde encontrar', zones: { safe: 'Zona Segura', danger: 'Zona de Perigo', war: 'Zona de Guerra', arena: 'Zona de Arena', parkour: 'Zona de Parkour', none: 'Sem zona' }, soldAt: 'Vendido em', forQty: 'por {n}', free: 'Grátis',
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
      rarities: { common: 'Comum', uncommon: 'Incomum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário', event: 'Evento', unique: 'Único', enchanted: 'Encantado', premium: 'Premium', organization: 'Organização' },
      knockbackDistance: 'Distância de Knockback',
      mobHealth: 'Vida', mobDamage: 'Dano', mobExperience: 'Experiência', mobRange: 'Alcance', mobRespawn: 'Reaparecimento', combatStats: 'Combate',
    },
    masteryDetail: {
      notFound: 'Mastery não encontrada.',
      elemental: 'Elemental',
      nonElemental: 'Não-elemental',
      aboutMastery: 'Sobre a Mastery',
      masteryPaths: 'Caminhos da Mastery',
      noJutsusInPath: 'Nenhum jutsu classificado neste caminho ainda.',
      jutsusOfMastery: 'Jutsus da Mastery',
      noJutsusYet: 'Nenhum jutsu cadastrado para esta mastery ainda.',
      otherJutsus: 'Outros jutsus da mastery',
      utilityTitle: 'Técnicas Utilitárias',
      utilitySubtitle: 'Fora das masteries',
      utilityIntro: 'Estas técnicas não pertencem a nenhuma mastery: todo jogador pode aprender e usar, seja qual for a mastery escolhida.',
      utilityEmpty: 'Nenhuma técnica utilitária cadastrada ainda.',
      utilityCta: 'Técnicas Utilitárias (todos podem aprender)',
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
      noPath: 'Nenhum',
      aboutJutsu: 'Sobre o Jutsu',
      home: 'Início',
      tier1: 'Básico', tier2: 'Intermediário', tier3: 'Avançado', tier4: 'Especialista', tier5: 'Mestre',
    },
    footer: {
      disclaimer: 'Este é um projeto de fã não oficial. Nin Online é propriedade de seus respectivos criadores.',
      madeWith: 'Feito pela comunidade',
    },
    invite: {
      title: 'Leve o Nin Codex para o seu servidor', subtitle: 'Consulte itens, mobs, armas, jutsus e receitas sem sair do Discord. Rápido, gratuito e no idioma do seu servidor.',
      button: 'Convidar o bot para o seu servidor', buttonShort: 'Convidar o bot', perms: 'Pede só o essencial: ver canais, enviar mensagens, links incorporados, anexar arquivos e ler o histórico. Nunca pede administrador.',
      badge: 'Bot do Discord', examplesTitle: 'O que ele faz',
      examples: [
        { cmd: '/search', text: 'Procura qualquer coisa no wiki' },
        { cmd: '/item · /mob · /jutsu · /mastery', text: 'Consulta uma coisa pelo nome' },
        { cmd: '/drop', text: 'Quem dropa o item e com que chance' },
        { cmd: '/recipe', text: 'Como fazer um item: ingredientes, profissão e nível' },
        { cmd: '/compare', text: 'Dois itens lado a lado' },
        { cmd: '/patchnotes', text: 'Últimas notícias e patch notes' },
      ],
      stepsTitle: 'Como começar',
      steps: [
        { title: 'Convidar', text: 'Clique no botão e escolha o servidor.' },
        { title: 'Autorizar', text: 'Confirme as permissões na tela do Discord.' },
        { title: 'Digitar /help', text: 'Veja a lista de comandos no seu servidor.' },
      ],
      note: 'Você precisa da permissão Gerenciar servidor para adicionar bots.',
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
        scheduleClear: 'Limpar data', schedule: 'Agendar', scheduledBadge: 'Agendado', 
        preview: 'Pré-visualizar', previewTitle: 'Pré-visualização', previewNote: 'É assim que o post aparece para os leitores (com o texto ainda não salvo).', close: 'Fechar',
        unsavedWarning: 'Há alterações não salvas. Sair mesmo assim?', 
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
        commentsRules: 'Seja respeitoso. A equipe pode esconder comentários e bloquear contas.', 
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
      levelN: 'Nível {n}', tierHint: 'De 1 a 5 (o máximo é 5).',
      levelsTitle: 'Níveis: nome, dano base e recarga', levelsHint: 'Uma linha por nível do jutsu (o nível máximo é a quantidade de linhas). O nome é opcional: preencha só nos níveis em que o jutsu muda de nome (ex.: nível 4). Clique em "Adicionar nível" quando o jutsu subir de nível.', levelNamePlaceholder: 'Nome neste nível (opcional)', nameByLevel: 'Nome por nível', nameFromLevel: 'A partir do nível {n}: {name}',
      addLevel: 'Adicionar nível', removeLevel: 'Remover nível',
    },
    maintenance: { title: 'Página em manutenção', text: 'Estamos construindo esta página. Volte em breve!', back: 'Voltar ao início', siteTitle: 'Site em manutenção', siteText: 'Estamos melhorando o wiki. Voltamos em breve!', staffLogin: 'Entrar (equipe)', staffChecking: 'Verificando seu acesso...', staffHint: 'Só a equipe entra durante a manutenção: faça o login e o site abre normalmente.', badge: 'Em manutenção' },
    admin: {
      login: {
        welcome: 'Bem-vindo de volta',
        subtitle: 'Acesse o painel de administração da Wiki',
        button: 'Entrar com Discord',
      },
      auth: {
        checkingSession: 'Verificando sessão...',
        logout: 'Sair',
        apiUnreachable: 'Não consegui falar com o servidor da API. Verifique se ele está ligado e tente de novo.',
        retry: 'Tentar de novo',
        noAccessTitle: 'Sem acesso a esta página',
        noAccessBody: 'O seu cargo não tem permissão para ver esta área.',
        backToOverview: 'Voltar à Visão Geral',
        errMfa: 'Para entrar no painel, a sua conta do Discord precisa ter a verificação em duas etapas (2FA) ligada. Ative em Discord > Configurações > Minha conta > Ativar autenticação de dois fatores e tente de novo.',
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
        dropHere: 'Solte as imagens aqui para enviar', progress: 'Enviando {done}/{total}...', skipped: '{n} arquivo(s) ignorado(s): só PNG, JPG, GIF e WEBP.', failedFile: '{name}: {error}', retryFailed: 'Tentar de novo ({n} com falha)', allCategories: 'Todas', uncategorized: 'Sem categoria', categoryOf: 'Categoria', newUploadCategory: 'Categoria dos novos envios', setCategory: 'Mudar categoria...', applyCategory: 'Aplicar', pageOf: 'Página {page} de {pages}', prev: 'Anterior', next: 'Próxima', noUploadPermission: 'Você não tem permissão para enviar imagens aqui (peça ao S.Adm).', resetIds: 'Resetar IDs', searchingAll: 'Buscando em todas as categorias (as visíveis para você).', restrictedNotice: 'Existe imagem com esse nome/ID numa categoria fechada. Você não tem acesso para ver essa informação.', closedDenied: 'Acesso negado: essa imagem está numa categoria fechada e você não tem acesso para vê-la.', resetIdsConfirm: 'Renumerar TODAS as imagens a partir do #1 (a mais antiga vira #1)? Os arquivos e o conteúdo já salvo não mudam, mas quem digitou um ID e ainda não salvou perde a referência. Com a biblioteca vazia, a contagem volta para #1.', resetIdsDone: 'IDs renumerados ({n} imagens).', categories: { weapon: 'Armas', gear: 'Equipamentos', consumable: 'Consumíveis', currency: 'Moedas', material: 'Materiais', ring: 'Anéis', scroll: 'Pergaminhos', npc: 'NPCs', monster: 'Monstros', furniture: 'Móveis', hair_beard: 'Cabelo/Barba', skin: 'Skins', vanity: 'Vanity', tools: 'Ferramentas', closed: 'Fechadas (só S.Adm)', other: 'Outros' },
        selected: '{n} selecionada(s)', selectAll: 'Selecionar todas desta página', clearSel: 'Limpar seleção', deleteSelected: 'Apagar selecionadas',
        confirmBulk: 'Apagar {n} imagem(ns)? Os arquivos somem do servidor.', confirmBulkForce: '{n} imagem(ns) estão em uso (ex.: {where}). Apagar mesmo assim? Esses lugares ficarão com a imagem quebrada.',
        bulkDone: '{n} imagem(ns) apagada(s).', select: 'Selecionar',
        loadError: 'Não foi possível carregar as imagens.', actionError: 'Não foi possível concluir a ação.',
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
      maintenanceAdmin: {
        title: 'Modo manutenção', subtitle: 'Liga ou desliga a página de manutenção do site inteiro. Só o S.Adm vê esta tela.',
        statusOn: 'LIGADA: os visitantes veem a página de manutenção', statusOff: 'Desligada: o site está aberto para todos', enable: 'Ligar manutenção', disable: 'Desligar manutenção',
        confirmEnable: 'Ligar a manutenção? Os visitantes deixam de ver o site; a equipe continua entrando depois do login.', confirmDisable: 'Desligar a manutenção e abrir o site para todos?',
        messageEn: 'Mensagem (inglês, opcional)', messagePt: 'Mensagem (português, opcional)', messageHint: 'Vazio = texto padrão da página.',
        staffNote: 'A equipe (qualquer cargo) entra no site normalmente depois de fazer login pela própria página de manutenção; o painel (/admin) e o login continuam abertos.',
        loading: 'Carregando...', loadError: 'Não foi possível ler o estado do site.', saveError: 'Erro ao salvar.', saving: 'Salvando...', savedOn: 'Manutenção ligada.', savedOff: 'Manutenção desligada: o site está aberto.',
      },
      guideAdmin: {
        articlesTitle: 'Artigos do Guia', articlesSubtitle: 'Os artigos do Guia (Zonas, Crime, Equipes, Controles...), por seção. Rascunho só a equipe vê.', newArticle: 'Novo artigo',
        professionsTitle: 'Proficiências', professionsSubtitle: 'As proficiências de coleta e criação. As receitas, recursos e ferramentas vêm da importação do Atlas.', newProfession: 'Nova proficiência',
        loading: 'Carregando...', loadError: 'Erro ao carregar.', empty: 'Nada cadastrado ainda.', colTitle: 'Título', colSection: 'Seção', colStatus: 'Situação', colGroup: 'Tipo', colDetails: 'Conteúdo', colName: 'Nome',
        edit: 'Editar', delete: 'Apagar', confirmDelete: 'Apagar "{name}"? Essa ação não pode ser desfeita.', deleteError: 'Erro ao apagar.', published: 'Publicado', draft: 'Rascunho', all: 'Todos',
        back: 'Voltar', saving: 'Salvando...', save: 'Salvar', saveError: 'Erro ao salvar.', newArticleTitle: 'Novo artigo', editArticleTitle: 'Editar artigo', newProfessionTitle: 'Nova proficiência', editProfessionTitle: 'Editar proficiência',
        id: 'ID (slug)', idLocked: '(não pode mudar)', section: 'Seção', position: 'Posição na seção', icon: 'Ícone', status: 'Situação', statusPublished: 'Publicado (aparece no Guia)', statusDraft: 'Rascunho (só a equipe vê)',
        title: 'Título (inglês)', titlePt: 'Título (português)', summary: 'Resumo (inglês)', summaryPt: 'Resumo (português)', body: 'Texto (inglês)', bodyPt: 'Texto (português)',
        translationNote: 'O inglês é o idioma principal. O que ficar vazio em português é traduzido pela DeepL ao salvar (se estiver configurada).',
        name: 'Nome (inglês)', namePt: 'Nome (português)', group: 'Tipo', groupGathering: 'Coleta', groupCrafting: 'Criação', emoji: 'Emoji', description: 'Descrição (inglês)', descriptionPt: 'Descrição (português)',
        detailsNote: 'Receitas, recursos e ferramentas não são editados aqui: vêm de scripts/importar_profissoes_atlas.py.', detailsCount: '{r} receitas · {s} recursos · {t} ferramentas',
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
        contentMobs: 'Monstros',
        contentItems: 'Itens',
        contentWeapons: 'Armas',
        contentMissions: 'Missões',
        masteries: 'Masteries',
        jutsus: 'Jutsus',
        bulkImport: 'Importar JSON',
        auditLog: 'Log de Auditoria',
        users: 'Usuários',
        staff: 'Equipe',
        permissions: 'Permissões',
        errors: 'Erros',
        reports: 'Reports',
        volunteers: 'Voluntários',
        tournaments: 'Torneios',
        discordLinks: 'Ligações com o Discord', botServers: 'Servidores do bot',
        translations: 'Traduções oficiais',
        villages: 'Vilas',
        organizations: 'Organizações',
        guideArticles: 'Artigos do Guia',
        professions: 'Proficiências',
        maintenance: 'Manutenção',
        backToSite: 'Voltar ao site',
        groups: { wiki: 'Conteúdo', community: 'Comunidade', bot: 'Bot', world: 'Mundo', system: 'Sistema' },
        breadcrumbHome: 'Painel',
        viewSite: 'Ver site', panelTitle: 'Painel Admin', versionTitle: 'Versão publicada (commit do GitHub)',
      },
      gameNames: {
        title: 'Nomes novos do arquivo do jogo', subtitle: 'Escolha o arquivo em inglês exportado do Nin Online (e, junto, o de Brazilian Portuguese para já trazer o nome oficial em português). O wiki lista os textos que parecem nomes e que você ainda não tem — nem como rascunho da importação.',
        chooseFiles: 'Escolher arquivo(s) .json', invalidFile: 'Arquivo inválido: não é um arquivo de tradução do Nin Online.', find: 'Procurar nomes novos', loadError: 'Não foi possível concluir.',
        summary: '{total} textos no arquivo · {names} parecem nomes · {have} o wiki já tem · {new} novos.', truncated: '(mostrando os 5.000 primeiros)', search: 'Filtrar…',
        hideJutsu: 'Esconder o que parece jutsu', selectShown: 'Marcar todos da lista', clear: 'Limpar marcação', empty: 'Nada por aqui.', moreHidden: '+{n} nomes fora da tela: use o filtro para chegar neles (o "Marcar todos" vale para todos).',
        createDrafts: 'Criar rascunhos', confirm: 'Criar {n} rascunhos na categoria "{category}"?', created: '{n} rascunhos criados ({s} já existiam e foram pulados). Abra cada um em Conteúdo para completar nível, descrição e imagem.',
        note: 'A lista é um palpite: o arquivo do jogo mistura itens, mobs, NPCs, lugares e textos de tela, e não diz qual é qual. Confira antes de criar; tudo nasce como rascunho.',
        categories: { items: 'Itens', weapons: 'Armas', mobs: 'Mobs', missions: 'Missões', guides: 'Guias' }, hints: { jutsu: 'parece jutsu', recipe: 'parece receita' },
      },
      translationsPage: {
        title: 'Traduções oficiais do jogo', subtitle: 'Importe o arquivo de tradução do próprio Nin Online (Brazilian Portuguese .json) e o wiki preenche o português dos conteúdos, jutsus, masteries, vilas, clãs e organizações com o texto oficial.',
        chooseFile: 'Escolher arquivo .json', invalidFile: 'Arquivo inválido: não é um arquivo de tradução do Nin Online.', wrongLanguage: 'Este é o arquivo em outro idioma. Envie o arquivo "Brazilian Portuguese".',
        fileInfo: 'idioma: {language} · {count} textos · exportado em {date}', overwrite: 'Trocar também o português que já existe',
        overwriteHint: 'Desligado (recomendado): só preenche o que está vazio ou veio da tradução automática; o português escrito à mão é mantido. Ligado: o texto oficial substitui tudo que for diferente.',
        preview: 'Ver o que vai mudar', apply: 'Aplicar traduções', confirmApply: 'Gravar {n} alterações no português do wiki?', working: 'Processando…', resultTitle: 'Resultado', applied: 'Pronto! {n} campos atualizados.',
        nothing: 'Nada para mudar: tudo que tem tradução oficial já está igual.', colType: 'Tipo', colRecords: 'Registros', colChanges: 'Alterações', colNoMatch: 'Sem tradução oficial',
        types: { content: 'Conteúdo', jutsu: 'Jutsus', mastery: 'Masteries', village: 'Vilas', clan: 'Clãs', organization: 'Organizações' },
        fields: { name_pt: 'Nome', description_pt: 'Descrição', long_description_pt: 'Descrição completa', lore_pt: 'Lore', synergy_pt: 'Sinergia', spawn_location_pt: 'Local de spawn', motto_pt: 'Lema', climate_pt: 'Clima', name_by_level_pt: 'Nome por nível' },
        samples: 'Exemplos do que muda', noMatchNames: 'Nomes (em inglês) sem tradução oficial — confira a grafia:', loadError: 'Não foi possível ler o arquivo.',
        howTo: 'Só acertos exatos do texto em inglês (sem diferenciar maiúsculas). Nada é apagado; dá para rodar de novo quando o jogo atualizar a tradução.',
      },
      versionHistory: {
        title: 'Versões anteriores', hint: 'Cada edição guarda o estado de antes (últimas 25). Restaurar volta a página para aquela versão — e também entra aqui, então dá para desfazer.',
        empty: 'Nenhuma versão anterior ainda: aparece depois da primeira edição.', restore: 'Restaurar', confirm: 'Voltar esta página para essa versão? O estado atual fica salvo no histórico.',
        by: 'por', loadError: 'Não foi possível carregar o histórico.', restoreError: 'Não foi possível restaurar.',
      },
      reportsPage: {
        title: 'Reports dos visitantes', subtitle: 'Informações desatualizadas e erros de tradução apontados nas páginas.',
        open: 'Abertos', resolved: 'Resolvidos', dismissed: 'Descartados', all: 'Todos', allKinds: 'Todos os tipos',
        kinds: { outdated: 'Desatualizado', translation: 'Tradução', other: 'Outro' }, targets: { content: 'Conteúdo', jutsu: 'Jutsu', mastery: 'Mastery' },
        empty: 'Nenhum report por aqui.', loadError: 'Não foi possível carregar os reports.', actionError: 'Não foi possível concluir a ação.',
        resolve: 'Resolver', dismiss: 'Descartar', reopen: 'Reabrir', delete: 'Apagar', confirmDelete: 'Apagar este report?',
        refresh: 'Atualizar', reportedOn: 'Enviado em', handledBy: 'Tratado por', language: 'Idioma do visitante',
      },
      volunteersPage: {
        title: 'Voluntários', subtitle: 'Inscrições enviadas pelo formulário /volunteer. Só a equipe vê.', refresh: 'Atualizar', all: 'Todos',
        statuses: { new: 'Nova', reviewing: 'Em avaliação', approved: 'Aprovada', rejected: 'Recusada', contacted: 'Contatada' },
        searchPh: 'Buscar por Discord ou nick', empty: 'Nenhuma inscrição por aqui.', loadError: 'Não foi possível carregar as inscrições.', actionError: 'Não foi possível concluir a ação.', newCount: 'novas', submittedOn: 'Enviada em', reviewedBy: 'Avaliada por',
        discord: 'Discord', gameNick: 'Nick no jogo', languages: 'Idiomas', areas: 'Áreas', availability: 'Disponibilidade', motivation: 'Motivação', email: 'E-mail',
        notes: 'Notas internas (só a equipe vê)', notesPh: 'Anotações sobre esta pessoa…', saveNotes: 'Salvar notas', saved: 'Salvo', setStatus: 'Status', delete: 'Apagar', confirmDelete: 'Apagar esta inscrição e todos os dados dela? Não dá para desfazer.',
        showing: 'Mostrando', prev: 'Anterior', next: 'Próxima', details: 'Ver detalhes', close: 'Fechar',
        formOpen: 'Formulário aberto', formClosed: 'Formulário fechado', formOpenHint: 'Qualquer pessoa pode se inscrever em /volunteer.', formClosedHint: 'A página /volunteer mostra "inscrições fechadas" e a API recusa novos envios.', closeForm: 'Fechar inscrições', openForm: 'Abrir inscrições', toggleError: 'Não foi possível mudar o formulário.',
      },
      errorsPage: {
        title: 'Erros e problemas', subtitle: 'Tudo que quebrou no wiki (API, site, tradução, ataques). O bot também avisa no Discord.',
        open: 'Abertos', resolved: 'Resolvidos', all: 'Todos', allSources: 'Todas as origens', empty: 'Nenhum problema por aqui. 🎉',
        loadError: 'Não foi possível carregar os erros.', actionError: 'Não foi possível concluir a ação.',
        occurrences: 'ocorrências', firstSeen: 'Primeira vez', lastSeen: 'Última vez', where: 'Onde no código', route: 'Rota / página', status: 'Status HTTP',
        resolve: 'Marcar como resolvido', reopen: 'Reabrir', delete: 'Apagar', confirmDelete: 'Apagar este registro de erro?',
        trace: 'Traceback (mascarado)', noTrace: 'Sem traceback para este tipo de problema.', resolvedBy: 'Resolvido por', ip: 'IP da última ocorrência', refresh: 'Atualizar',
        sources: { api: 'API', web: 'Site', deepl: 'DeepL', security: 'Segurança' },
        howTo: 'Se voltar a acontecer, o problema reabre sozinho e o bot avisa de novo.', hintTitle: 'O que pode estar acontecendo',
      },
      noticeBoard: {
        title: 'Quadro de avisos', subtitle: 'Recados e arquivos para a equipe.', empty: 'Nenhum aviso por enquanto.',
        newNotice: 'Novo aviso', titleLabel: 'Título', bodyLabel: 'Mensagem', pin: 'Fixar no topo', pinned: 'Fixado',
        save: 'Publicar', saving: 'Salvando...', cancel: 'Cancelar', edit: 'Editar', delete: 'Apagar',
        confirmDelete: 'Apagar o aviso "{title}" e os arquivos anexados?', attachFiles: 'Anexar arquivo', files: 'Arquivos',
        removeFile: 'Remover arquivo', uploading: 'Enviando...', by: 'por',
        loadError: 'Não foi possível carregar os avisos.', saveError: 'Não foi possível salvar o aviso.',
        uploadError: 'Não foi possível enviar o arquivo.', maxInfo: 'Até 10 arquivos por aviso — aceita .zip, .rar, .7z, PDF, imagens e outros (máx. 200 MB cada).', fileTooBig: 'O arquivo "{name}" passa de {mb} MB.',
      },
      rolesPage: {
        preview: 'Pré-visualização',
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
          'content.bulk_type': 'Mudar o tipo (Item type) de vários itens de uma vez', 'content.create': 'Criar conteúdo', 'content.edit': 'Editar conteúdo', 'content.publish': 'Publicar / despublicar conteúdo', 'content.delete': 'Apagar conteúdo', 'content.import': 'Importar conteúdo em massa',
          'posts.create': 'Criar posts', 'posts.edit': 'Editar posts', 'posts.publish': 'Publicar / despublicar posts', 'posts.delete': 'Apagar posts', 'comments.moderate': 'Moderar comentários e banir leitores', 'translation.import': 'Importar as traduções oficiais do jogo', 'reports.manage': 'Ver e tratar os reports dos visitantes', 'volunteers.manage': 'Ver, avaliar e apagar as inscrições de voluntários', 'tournaments.manage': 'Moderar torneios dos jogadores (esconder, corrigir texto, apagar)', 'discord.links': 'Ligar servidores e cargos do Discord à vila e ao rank do perfil dos jogadores',
          'lore.edit': 'Editar Masteries, Jutsus, Vilas e Organizações', 'lore.delete': 'Apagar Jutsus, Vilas e Organizações',
          'uploads.create': 'Enviar imagens', 'translation.retranslate': 'Retraduzir conteúdo',
          'notices.view': 'Ver avisos e baixar arquivos', 'notices.manage': 'Postar, editar e apagar avisos', 'announcement.manage': 'Editar o anúncio da Home', 'media.manage': 'Renomear/apagar imagens do banco de imagens', 'media.categorize': 'Mudar a categoria das imagens do banco de imagens', 'site.maintenance': 'Ligar/desligar o modo manutenção do site', 'media.upload': 'Enviar imagens pelo banco de imagens (lote)', 'media.reset_ids': 'Renumerar os IDs do banco de imagens', 'media.closed': 'Ver a categoria fechada do banco de imagens', 'media.cat.weapon': 'Ver imagens: Armas', 'media.cat.gear': 'Ver imagens: Equipamentos', 'media.cat.consumable': 'Ver imagens: Consumíveis', 'media.cat.currency': 'Ver imagens: Moedas', 'media.cat.material': 'Ver imagens: Materiais', 'media.cat.ring': 'Ver imagens: Anéis', 'media.cat.scroll': 'Ver imagens: Pergaminhos', 'media.cat.npc': 'Ver imagens: NPCs', 'media.cat.monster': 'Ver imagens: Monstros', 'media.cat.furniture': 'Ver imagens: Móveis', 'media.cat.hair_beard': 'Ver imagens: Cabelo/Barba', 'media.cat.skin': 'Ver imagens: Skins', 'media.cat.vanity': 'Ver imagens: Vanity', 'media.cat.tools': 'Ver imagens: Ferramentas', 'media.cat.other': 'Ver imagens: Outros', 'media.cat.none': 'Ver imagens: Sem categoria',
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
      },
      richText: {
        placeholder: 'Escreva aqui...', fichaTitle: 'Título da ficha', fichaLabel: 'Rótulo', fichaValue: 'Valor',
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
        entityContentItem: 'Conteúdo', entityJutsu: 'Jutsu', 
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
        colName: 'Nome', colMastery: 'Mastery', colTier: 'Tier', colChakra: 'Chakra', colStatus: 'Situação', published: 'Publicado', draft: 'Rascunho',
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
        status: 'Situação', statusPublished: 'Publicado (aparece no site)', statusDraft: 'Rascunho (só a equipe vê)', saveDraft: 'Salvar rascunho', publish: 'Publicar',
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
        bulkItemType: 'Mudar o tipo do item...', bulkItemTypeApply: 'Aplicar tipo', bulkItemTypeConfirm: 'Mudar o tipo de {count} itens para "{type}"?', bulkItemTypeError: 'Não foi possível mudar o tipo dos itens.', bulkDeleteConfirm: 'Apagar {count} entries selecionadas? Essa ação não pode ser desfeita.',
        bulkDeleteError: 'Erro ao apagar em massa.',
        publish: 'Publicar', markDraft: 'Marcar rascunho',
      },
      contentEditor: {
        catMobs: 'Mobs', catItems: 'Itens', catWeapons: 'Armas', catMissions: 'Missões', catGuides: 'Guias',
        mobMonster: 'Monstro', mobBoss: 'Boss', mobNpc: 'NPC', mobMount: 'Montaria',
        itemGeneral: 'Geral', itemRing: 'Ring', itemAccessory: 'Acessório', itemShirt: 'Camisa', itemVest: 'Colete', itemPant: 'Calça', itemHat: 'Chapéu', itemMask: 'Máscara', itemShoe: 'Sapato', itemConsumable: 'Consumível', itemMaterial: 'Material',
        itemCurrency: 'Moeda', itemCast: 'Cast', itemAuthority: 'Autoridade', itemPack: 'Pack', itemTool: 'Ferramenta', itemScroll: 'Pergaminho / Manual', itemWardrobe: 'Gear', wardrobeKind: 'Tipo de peça',
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
        levelZeroHint: 'Nível 0 = item sem nível (nada aparece no site).', levelUnknown: 'Nível desconhecido (o site mostra ???)', maxStack: 'Max Stack', maxStackPlaceholder: '', castVillage: 'Vila que pode usar',
        rarity: 'Raridade', level: 'Nível', image: 'Imagem',
        description: 'Descrição', descriptionPlaceholder: 'Descrição curta, sempre visível na página...', optionalSuffix: '(opcional)',
        lore: 'Lore', 
        synergy: 'Sinergia', 
        spawnLocation: 'Onde encontrar (lugares)', spawnLocationPlaceholder: '', addLocation: 'Adicionar lugar', locationPlaceholder: 'Nome do lugar (ex.: Larva Road)', zoneLabel: 'Zona', removeLocation: 'Remover lugar', zones: { safe: 'Zona Segura', danger: 'Zona de Perigo', war: 'Zona de Guerra', arena: 'Zona de Arena', parkour: 'Zona de Parkour', none: 'Sem zona' },
        weaponNpcHint: 'Escolha a página do NPC para virar link; quem DROPA a arma aparece sozinho em "Dropado por".', weaponNpcLinked: 'Ligado à página do NPC (o nome acompanha a página)', convertText: 'Transformar o texto antigo em lista', salesTitle: 'Vendido por NPCs (lojas)', addSale: 'Adicionar loja', saleShop: 'Loja', salePrice: 'Preço', saleCurrency: 'Moeda', saleQty: 'Qtd', removeSale: 'Remover loja',
        mobSheet: 'Ficha do Mob', health: 'Health', healthPlaceholder: '',
        damage: 'Damage', damagePlaceholder: '',
        experience: 'Experience', experiencePlaceholder: '',
        range: 'Range', rangePlaceholder: '',
        respawnTime: 'Respawn Time', respawnTimePlaceholder: '',
        attacksTitle: 'Jutsu / Attacks', attackPlaceholder: '',
        noAttacks: 'Nenhum ataque ainda ("None" na ficha pública).',
        attributesTitle: 'Atributos', 
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
    siteName: 'Nin Codex',
    siteTagline: 'The definitive encyclopedia of the Nin world',
    siteSubline: 'WIKI · MAP · TOOLS',
    compare: {
      title: 'Compare items', subtitle: 'Pick two items or weapons to see their data side by side. Rows that differ are highlighted.',
      search: 'Search item or weapon…', noResults: 'Nothing found.', change: 'Change', pickBoth: 'Pick both sides to compare.', button: 'Compare',
    },
    nav: {
      home: 'Home',
      openMenu: 'Open menu',
      blog: 'Blog',
      tournaments: 'Tournaments',
      mobs: 'Bestiary',
      items: 'Items',
      guides: 'Guides',
      masteries: 'Masteries',
      weapons: 'Weapons',
      missions: 'Missions',
      village: 'Villages',
      proficiencies: 'Proficiencies',
      map: 'Map',
    },
    home: {
      welcome: 'Welcome to the',
      subtitle: 'Explore the world of Nin Online — mobs, items, weapons and more.',
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
      villagesCrumb: 'Villages', backToVillages: 'Back to Villages',
      back: 'Back', pageNotFound: 'Page not found.', backHome: 'Back to home',
      aboutVillage: 'About the Village', clans: 'Clans', organizations: 'Organizations', villageSheet: 'Village Sheet', otherVillages: 'Other Villages',
      fName: 'Name', fEnglish: 'English', fPortuguese: 'Portuguese', fElement: 'Element', fMotto: 'Motto', fClimate: 'Climate', fLeader: 'Leader',
      emblemAlt: 'Emblem of {name}', mapAria: 'Map of the Nin world', mapTitle: 'World Map', mapSubtitle: 'The world map and the game areas.', mapCrumb: 'Map',
      mapHint: 'Drag to move, use the mouse wheel to zoom, search for a place or click an area to see its map.', mapDrops: 'Drops', mapZoomIn: 'Zoom in', mapZoomOut: 'Zoom out', mapSource: 'Images extracted from the game client.',
      mapFind: 'Search place or area...', mapNoResult: 'Nothing found.', mapLegend: 'Legend', mapTerritories: 'Village territories', mapFullscreen: 'Full screen', mapExitFullscreen: 'Exit full screen', mapFit: 'Show the whole world', mapPlace: 'Place', mapArea: 'Area', mapKindShop: 'Shops', mapKindDungeon: 'Dungeons', mapKindMailbox: 'Mailboxes', mapKindNotice: 'Notice boards', mapKindWedding: 'Wedding',
      mapScroll: 'Scroll', mapRender: 'Render', mapInfoTitle: 'Area info', mapInfoLoading: 'Loading...', mapZone: 'Zone', mapZoneSafe: 'Safe zone', mapZoneDanger: 'Danger zone', mapZoneWar: 'War zone', mapZoneNone: 'No zone', mapVillage: 'Village', mapHouses: 'Houses', mapPlaces: 'Places', mapExits: 'Exits', mapNpcs: 'NPCs', mapMobs: 'Mobs', mapResources: 'Resources', mapRooms: 'Buildings', mapViewImage: 'View area map', mapClose: 'Close', mapLevelShort: 'Lv.', mapDirNorth: 'North', mapDirSouth: 'South', mapDirEast: 'East', mapDirWest: 'West', mapDirOther: 'Other',
      mapKindHospital: 'Hospitals', mapKindBounty: 'Bounty stations', mapKindMissions: 'Missions', mapKindBoss: 'Bosses', mapKindTravel: 'Travel', mapKindBarber: 'Barber', mapKindHeadbands: 'Headbands', mapKindPolling: 'Polling station', mapKindLeaderboards: 'Leaderboards', mapKindCheckpoint: 'Checkpoints', mapKindCapture: 'Capture points', mapLevels: 'Mob levels', mapKey: 'Map key', mapShowAll: 'Show all', mapHousesN: '{n} houses', mapLevelRange: 'Lv {lv}', mapCopyLink: 'Copy link', mapLinkCopied: 'Link copied', mapDoors: 'Doors to other areas', mapPinsTitle: 'Show on the area', mapGoTo: 'Go to', mapStatShops: 'Shops', mapTravelRoutes: 'Travel routes', mapCollapse: 'Collapse panel', mapChief: 'Boss', mapInsideOf: 'Inside {name}', mapShowMarkers: 'Show or hide markers', mapMyHint: 'Drag to move, scroll or pinch to zoom, click any area to see what is inside.',
      demo: 'Demonstration', jutsuDemoAlt: 'Demonstration of the jutsu {name}',
      guideMore: 'More in Guides', guideAttributes: 'Attributes', guideArcs: 'Story Arcs', guideSummons: 'Summons',
      guideGathering: 'Gathering', guideCrafting: 'Crafting',
      proficienciesTitle: 'Proficiencies', proficienciesSubtitle: 'The game\'s gathering and crafting skills: what each one does, how to level it and every recipe.', proficienciesCrumb: 'Proficiencies',
      profHowTitle: 'How they work', profHowCap: 'Every proficiency levels on its own, up to level 500.', profHowBonus: 'Every 10 levels gives +1% skill bonus (up to +50% at level 500).',
      profHowFormula: 'The bonus multiplies the recipe\'s base rate: final rate = base × (1 + bonus). A 90% recipe reaches 100% at level 120; a 50% one tops out around 75% at level 500.',
      profHowExp: 'XP to clear level L: 128 × L − 64. Total XP from level 1 to level N: 64 × (N − 1)².',
      profCalcTitle: 'XP calculator', profCalcFrom: 'From level', profCalcTo: 'To level', profCalcResult: 'XP needed', profMilestones: 'Milestones', profColLevel: 'Level', profColXp: 'Total XP', profColBonus: 'Bonus',
      profRecipesCount: '{n} recipes', profResourcesCount: '{n} resources', profToolsCount: '{n} tools', profSearch: 'Search recipe...', profNoMatch: 'Nothing found.', profPrice: 'Price', profSources: 'Values recorded by the community (Nin Online Wiki on Fandom) and the Nin Atlas; the game may change them.', profTipsTitle: 'Tips', 
      guideSections: { 'new-player': 'Start here', combat: 'Combat & PvP', progression: 'Progression', interface: 'Controls & interface', economy: 'Money', systems: 'Gameplay systems' },
      guideBackToGuide: 'Back to the Guide', guideSystemsMissions: 'Mission list, rewards and steps to complete them.', guideSystemsProficiencies: 'Gathering and crafting: levels, bonuses, XP and every recipe.', 
      missionsx: {
        title: 'Missions', subtitle: 'Every documented Nin Online mission: level, rank, who gives it, objectives and rewards.', searchPlaceholder: 'Search mission or NPC...',
        results: '{n} missions', noResults: 'No mission matches these filters.', clear: 'Clear filters', filterArea: 'Region', filterType: 'Type', filterRank: 'Rank', filterLevel: 'Level',
        filterAll: 'All', repeatableOnly: 'Repeatable only', levelFmt: 'Level {n}+', levelUnknown: 'Level ?', rankFmt: 'Rank {r}', giver: 'Given by', location: 'Location',
        requirements: 'Requirements', objectives: 'Objectives', rewards: 'Rewards', rewardExp: 'EXP', rewardRyo: 'Ryo', about: 'About this mission', request: 'Mission text (in game)', notes: 'Notes',
        source: 'Source: Nin Online Wiki (Fandom), CC-BY-SA license.', notice: 'Community data, still being reviewed: values may change with game updates.',
        inClient: 'Name confirmed in the game files', notInClient: 'Not found in the game files (may be removed or renamed)', differsFromClient: 'Differs from the game files', back: 'Back to missions', howTitle: 'How missions work', howDeskGuide: 'Mission Assignment Desk', howLogGuide: 'Mission Log and tracker',
        partial: 'Partial sheet: objectives or rewards not recorded yet.', sortLevel: 'Sorted by level', crumb: 'Missions', relatedGuides: 'Related guides', exp: 'EXP', ryo: 'Ryo',
        types: { daily: 'Daily', repeatable: 'Repeatable', story: 'Story', side: 'Side' },
        areas: { leaf: 'Leaf', sand: 'Sand', mist: 'Mist', takumi: 'Takumi', 'land-of-spirits': 'Land of Spirits', 'land-of-iron': 'Land of Iron' },
      },
      guidex: {
        searchPlaceholder: 'Search the Guide...', noResults: 'No guide found.', startHere: 'Start here', startHereDesc: 'Read these in order if you just arrived in Nin Online.', step: 'Step {n}',
        browse: 'Browse by topic', guidesCount: '{n} guides', onThisPage: 'On this page', readMin: '{n} min read', previous: 'Previous', next: 'Next', related: 'Related guides',
        topicCount: '{n} guides', allTopics: 'All topics', results: '{n} results', topics: 'Topics', beginner: 'For beginners', openSection: 'Open topic', viewAll: 'View all',
        sectionDesc: { 'new-player': 'What to know in the first days: academy, village, missions and the rules that catch newcomers out.', combat: 'PvP, zones, bounties, crimes and how to recover from a defeat.', progression: 'Levels, stats, masteries, ranks and everything that makes your ninja grow.', interface: 'Keys, chat commands, friends and the in-game panels.', economy: 'How to earn Ryo, event coupons and what Gold Ninja offers.' },
      },
      professionBack: 'Back to Proficiencies', professionResources: 'What you gather', professionRecipes: 'Recipes', professionTools: 'Tools', professionLevel: 'Level', professionWorkbench: 'Workbench', professionLearnedFrom: 'Learned from', professionNeeds: 'Ingredients', professionNoDetails: 'There is no more information about this profession yet.', professionOpen: 'View details', profTabOverview: 'Overview', profTabResources: 'Resources', profTabRecipes: 'Recipes', profTabTools: 'Tools', profLevelAll: 'All levels', profLevelRange: 'Levels {a}–{b}', profBenchAll: 'Any station', profBenchYes: 'Needs Workbench', profBenchNo: 'No Workbench', profLearnAll: 'Any source', profLearnKnown: 'Known by default', profLearnItem: 'Learned from an item', profShowing: 'Showing {n} of {m}', profClear: 'Clear filters', profWhere: 'Where to gather', profWhereNone: 'No known location yet.', profOnMap: 'Open on the map', profDrops: 'Drops', profNoRecipesYet: 'No recipes recorded yet.', profLevelLabel: 'Level', profIngredients: 'Ingredients', profSortLevel: 'Sorted by level',
    },
    siteError: { title: 'Something went wrong', text: 'The team has been notified. Please try again in a moment.', retry: 'Try again', home: 'Back to home' },
    blog: {
      title: 'Blog',
      subtitle: 'News, patch notes and updates from the Nin world.',
      empty: 'No posts published yet.',
      loadError: 'Could not load posts right now.',
      notFound: 'Post not found.',
      back: 'Back to the Blog',
      official: 'Official post by Hitspark',
      by: 'by',
      updated: 'Updated on',
    },
    report: {
      button: 'Report', title: 'Report a problem', subtitle: 'Found outdated information or a translation mistake? Tell us — the team will review it.',
      kindLabel: 'What is wrong?', outdated: 'Outdated information', translation: 'Translation error', other: 'Something else',
      messageLabel: 'Describe the problem', placeholder: 'e.g. The drop chance changed to 5% in the latest update.',
      send: 'Send report', sending: 'Sending…', cancel: 'Cancel', thanks: 'Thank you! Your report was sent to the team.', close: 'Close',
      tooShort: 'Please write at least 10 characters.', error: 'Could not send the report. Try again in a moment.',
    },
    tournaments: tournamentsEn,
    discord: discordEn,
    volunteer: {
      title: 'Become a volunteer', subtitle: 'Help keep Nin Codex complete and up to date.',
      intro: 'Nin Codex is a free, fan-made project. If you want to help (translating, editing, collecting data...), tell us a bit about yourself. The team reads every application and replies on Discord.',
      home: 'Home', sectionAbout: 'About you', sectionHelp: 'How you want to help', sectionMotivation: 'Motivation',
      closedTitle: 'Applications closed', closedText: 'We are not accepting new volunteers right now. Keep an eye on the site and Discord announcements: we will say when it reopens.',
      discord: 'Discord username', discordPh: 'e.g. user123', discordHint: 'This is how the team will reach you.',
      gameNick: 'Nin Online nickname', gameNickPh: 'Your main character', languages: 'Languages you speak', languagesPh: 'e.g. Portuguese, English',
      areas: 'Areas of interest', areasHint: 'Pick at least one.',
      areaNames: { translation: 'Translation', 'wiki-editing': 'Wiki editing', 'data-collection': 'Data collection and screenshots', mapping: 'Mapping', moderation: 'Moderation', other: 'Other' },
      availability: 'Availability', availabilityPh: 'e.g. about 5 hours a week, evenings',
      motivation: 'Why do you want to help?', motivationPh: 'Write in your own words.',
      email: 'E-mail (optional)', emailHint: 'Only if you prefer to be contacted by e-mail.',
      consent: 'I agree that the Nin Codex team stores this data to review my application.',
      privacyTitle: 'Privacy', privacyPurpose: 'What we use it for: only to review your application and contact you.',
      privacyWho: 'Who sees it: only the Nin Codex team. Nothing is published.',
      privacyDelete: 'To delete your data, just ask the team on the project Discord.', privacyNoIp: 'We do not store your IP address.',
      send: 'Send application', sending: 'Sending…', successTitle: 'Application sent!', successText: 'Thank you! The team will review it and contact you on Discord.',
      sendAnother: 'Send another', fixErrors: 'Fix the highlighted fields and try again.', sendError: 'Could not send right now. Please try again in a moment.',
      errors: { required: 'Required field.', tooShort: 'Please write a little more.', tooLong: 'Text is too long.', pickArea: 'Pick at least one area.', invalidEmail: 'Invalid e-mail.', consentRequired: 'You must agree to submit.' },
    },
    catalog: {
      level: 'Level',
      levelRange: 'Levels',
      results: 'results',
      search: 'Search...',
      noResults: 'No results found.',
      itemsFilterConsumables: 'Consumables',
      itemsFilterMaterials: 'Materials',
      itemsFilterWardrobe: 'Gear',
      itemsFilterRings: 'Rings',
      itemsFilterPack: 'Pack',
      itemsFilterTool: 'Tools',
      itemsFilterScroll: 'Scrolls / Manuals',
      itemsFilterSpecial: 'Special Items',
    },
    detail: {
      attributes: 'Attributes',
      drops: 'Drops',
      lore: 'Lore',
      synergy: 'Synergy & Build',
      copied: 'Copied!',
      back: 'Back',
      level: 'Level',
      noDrops: 'This entry has no recorded drops.',
      droppedBy: 'Dropped by',
      crafted: 'Crafted',
      updatedOn: 'Updated', autoTranslated: 'Auto-translated', autoTranslatedHint: 'This Portuguese text was translated automatically and has not been reviewed yet. Found a mistake? Use the Report button.',
      relatedEntries: 'Related',
      spawnLocation: 'Where to find', zones: { safe: 'Safe Zone', danger: 'Danger Zone', war: 'War Zone', arena: 'Arena Zone', parkour: 'Parkour Zone', none: 'No Zone' }, soldAt: 'Sold at', forQty: 'for {n}', free: 'Free',
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
      rarities: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', event: 'Event', unique: 'Unique', enchanted: 'Enchanted', premium: 'Premium', organization: 'Organization' },
      knockbackDistance: 'Knockback Distance',
      mobHealth: 'Health', mobDamage: 'Damage', mobExperience: 'Experience', mobRange: 'Range', mobRespawn: 'Respawn', combatStats: 'Combat',
    },
    masteryDetail: {
      notFound: 'Mastery not found.',
      elemental: 'Elemental',
      nonElemental: 'Non-elemental',
      aboutMastery: 'About the Mastery',
      masteryPaths: 'Mastery Paths',
      noJutsusInPath: 'No jutsu classified in this path yet.',
      jutsusOfMastery: 'Mastery Jutsus',
      noJutsusYet: 'No jutsu registered for this mastery yet.',
      otherJutsus: 'Other jutsus of this mastery',
      utilityTitle: 'Utility Techniques',
      utilitySubtitle: 'Not a mastery',
      utilityIntro: 'These techniques do not belong to any mastery: every player can learn and use them, whatever mastery they chose.',
      utilityEmpty: 'No utility technique registered yet.',
      utilityCta: 'Utility Techniques (anyone can learn)',
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
      noPath: 'None',
      aboutJutsu: 'About the Jutsu',
      home: 'Home',
      tier1: 'Basic', tier2: 'Intermediate', tier3: 'Advanced', tier4: 'Expert', tier5: 'Master',
    },
    footer: {
      disclaimer: 'This is an unofficial fan project. Nin Online is property of its respective creators.',
      madeWith: 'Made by the community',
    },
    invite: {
      title: 'Bring Nin Codex to your server', subtitle: 'Look up items, mobs, weapons, jutsus and recipes without leaving Discord. Fast, free and in your server\'s language.',
      button: 'Invite the bot to your server', buttonShort: 'Invite the bot', perms: 'It only asks for the essentials: view channels, send messages, embed links, attach files and read history. Never administrator.',
      badge: 'Discord bot', examplesTitle: 'What it does',
      examples: [
        { cmd: '/search', text: 'Find anything on the wiki' },
        { cmd: '/item · /mob · /jutsu · /mastery', text: 'Look up one thing by name' },
        { cmd: '/drop', text: 'Who drops an item, and how likely' },
        { cmd: '/recipe', text: 'How to craft an item: ingredients, profession and level' },
        { cmd: '/compare', text: 'Two items side by side' },
        { cmd: '/patchnotes', text: 'Latest news and patch notes' },
      ],
      stepsTitle: 'Get started',
      steps: [
        { title: 'Invite', text: 'Click the button and pick your server.' },
        { title: 'Authorize', text: 'Confirm the permissions on Discord\'s screen.' },
        { title: 'Type /help', text: 'See the command list in your server.' },
      ],
      note: 'You need the Manage Server permission to add bots.',
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
        scheduleClear: 'Clear date', schedule: 'Schedule', scheduledBadge: 'Scheduled', 
        preview: 'Preview', previewTitle: 'Preview', previewNote: 'This is how the post looks to readers (with the text you have not saved yet).', close: 'Close',
        unsavedWarning: 'You have unsaved changes. Leave anyway?', 
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
        commentsRules: 'Be respectful. The team can hide comments and block accounts.', 
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
      levelN: 'Level {n}', tierHint: 'From 1 to 5 (5 is the maximum).',
      levelsTitle: 'Levels: name, base damage and cooldown', levelsHint: 'One row per jutsu level (the maximum level is the number of rows). The name is optional: fill it only on the levels where the jutsu changes name (e.g. level 4). Click "Add level" when the jutsu levels up.', levelNamePlaceholder: 'Name at this level (optional)', nameByLevel: 'Name by level', nameFromLevel: 'From level {n}: {name}',
      addLevel: 'Add level', removeLevel: 'Remove level',
    },
    maintenance: { title: 'Under maintenance', text: 'We are building this page. Please come back soon!', back: 'Back to home', siteTitle: 'Site under maintenance', siteText: 'We are improving the wiki. We will be back soon!', staffLogin: 'Staff login', staffChecking: 'Checking your access...', staffHint: 'Only the staff can get in during maintenance: log in and the site opens normally.', badge: 'Under maintenance' },
    admin: {
      login: {
        welcome: 'Welcome back',
        subtitle: 'Sign in to the Wiki admin dashboard',
        button: 'Login with Discord',
      },
      auth: {
        checkingSession: 'Checking session...',
        logout: 'Log out',
        apiUnreachable: 'Could not reach the API server. Check that it is running and try again.',
        retry: 'Try again',
        noAccessTitle: 'No access to this page',
        noAccessBody: 'Your role does not have permission to view this area.',
        backToOverview: 'Back to Overview',
        errMfa: 'To sign in to the panel, your Discord account must have two-factor authentication (2FA) turned on. Enable it in Discord > Settings > My Account > Enable Two-Factor Auth and try again.',
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
        dropHere: 'Drop the images here to upload', progress: 'Uploading {done}/{total}...', skipped: '{n} file(s) skipped: only PNG, JPG, GIF and WEBP.', failedFile: '{name}: {error}', retryFailed: 'Retry {n} failed', allCategories: 'All', uncategorized: 'Uncategorized', categoryOf: 'Category', newUploadCategory: 'Category for new uploads', setCategory: 'Set category...', applyCategory: 'Apply', pageOf: 'Page {page} of {pages}', prev: 'Previous', next: 'Next', noUploadPermission: 'You are not allowed to upload images here (ask the S.Adm).', resetIds: 'Reset IDs', searchingAll: 'Searching all categories (the ones you can see).', restrictedNotice: 'An image with that name/ID exists in a closed category. You do not have access to view that information.', closedDenied: 'Access denied: this image is in a closed category and you are not allowed to view it.', resetIdsConfirm: 'Renumber ALL images from #1 (the oldest becomes #1)? Files and saved content are not affected, but anyone who typed an ID and has not saved yet loses that reference. With an empty library the count restarts at #1.', resetIdsDone: 'IDs renumbered ({n} images).', categories: { weapon: 'Weapons', gear: 'Gear', consumable: 'Consumables', currency: 'Currency', material: 'Materials', ring: 'Rings', scroll: 'Scrolls', npc: 'NPCs', monster: 'Monsters', furniture: 'Furniture', hair_beard: 'Hair/Beard', skin: 'Skins', vanity: 'Vanity', tools: 'Tools', closed: 'Closed (S.Adm only)', other: 'Other' },
        selected: '{n} selected', selectAll: 'Select all on this page', clearSel: 'Clear selection', deleteSelected: 'Delete selected',
        confirmBulk: 'Delete {n} image(s)? The files are removed from the server.', confirmBulkForce: '{n} image(s) are in use (e.g. {where}). Delete anyway? Those places will end up with a broken image.',
        bulkDone: '{n} image(s) deleted.', select: 'Select',
        loadError: 'Could not load the images.', actionError: 'Could not complete the action.',
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
      maintenanceAdmin: {
        title: 'Maintenance mode', subtitle: 'Turns the maintenance page for the whole site on or off. Only the S.Adm sees this screen.',
        statusOn: 'ON: visitors see the maintenance page', statusOff: 'Off: the site is open to everyone', enable: 'Turn maintenance on', disable: 'Turn maintenance off',
        confirmEnable: 'Turn maintenance on? Visitors stop seeing the site; the staff still gets in after logging in.', confirmDisable: 'Turn maintenance off and open the site to everyone?',
        messageEn: 'Message (English, optional)', messagePt: 'Message (Portuguese, optional)', messageHint: 'Empty = the page default text.',
        staffNote: 'The staff (any role) gets into the site normally after logging in from the maintenance page itself; the panel (/admin) and the login stay open.',
        loading: 'Loading...', loadError: 'Could not read the site state.', saveError: 'Error saving.', saving: 'Saving...', savedOn: 'Maintenance is on.', savedOff: 'Maintenance is off: the site is open.',
      },
      guideAdmin: {
        articlesTitle: 'Guide articles', articlesSubtitle: 'The Guide articles (Zones, Crime, Teams, Controls...), by section. Only staff can see drafts.', newArticle: 'New article',
        professionsTitle: 'Proficiencies', professionsSubtitle: 'The gathering and crafting proficiencies. Recipes, resources and tools come from the Atlas import.', newProfession: 'New proficiency',
        loading: 'Loading...', loadError: 'Error loading.', empty: 'Nothing registered yet.', colTitle: 'Title', colSection: 'Section', colStatus: 'Status', colGroup: 'Type', colDetails: 'Content', colName: 'Name',
        edit: 'Edit', delete: 'Delete', confirmDelete: 'Delete "{name}"? This action cannot be undone.', deleteError: 'Error deleting.', published: 'Published', draft: 'Draft', all: 'All',
        back: 'Back', saving: 'Saving...', save: 'Save', saveError: 'Error saving.', newArticleTitle: 'New article', editArticleTitle: 'Edit article', newProfessionTitle: 'New proficiency', editProfessionTitle: 'Edit proficiency',
        id: 'ID (slug)', idLocked: '(cannot change)', section: 'Section', position: 'Position in section', icon: 'Icon', status: 'Status', statusPublished: 'Published (shown in the Guide)', statusDraft: 'Draft (staff only)',
        title: 'Title (English)', titlePt: 'Title (Portuguese)', summary: 'Summary (English)', summaryPt: 'Summary (Portuguese)', body: 'Text (English)', bodyPt: 'Text (Portuguese)',
        translationNote: 'English is the main language. Anything left empty in Portuguese is translated by DeepL on save (if configured).',
        name: 'Name (English)', namePt: 'Name (Portuguese)', group: 'Type', groupGathering: 'Gathering', groupCrafting: 'Crafting', emoji: 'Emoji', description: 'Description (English)', descriptionPt: 'Description (Portuguese)',
        detailsNote: 'Recipes, resources and tools are not edited here: they come from scripts/importar_profissoes_atlas.py.', detailsCount: '{r} recipes · {s} resources · {t} tools',
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
        contentMobs: 'Bestiary',
        contentItems: 'Items',
        contentWeapons: 'Weapons',
        contentMissions: 'Missions',
        masteries: 'Masteries',
        jutsus: 'Jutsus',
        bulkImport: 'Import JSON',
        auditLog: 'Audit Log',
        users: 'Users',
        staff: 'Staff',
        permissions: 'Permissions',
        errors: 'Errors',
        reports: 'Reports',
        volunteers: 'Volunteers',
        tournaments: 'Tournaments',
        discordLinks: 'Discord links', botServers: 'Bot servers',
        translations: 'Official translations',
        villages: 'Villages',
        organizations: 'Organizations',
        guideArticles: 'Guide articles',
        professions: 'Proficiencies',
        maintenance: 'Maintenance',
        backToSite: 'Back to site',
        groups: { wiki: 'Content', community: 'Community', bot: 'Bot', world: 'World', system: 'System' },
        breadcrumbHome: 'Admin',
        viewSite: 'View site', panelTitle: 'Admin Panel', versionTitle: 'Published version (GitHub commit)',
      },
      gameNames: {
        title: 'New names from the game file', subtitle: 'Choose the English file exported from Nin Online (and the Brazilian Portuguese one with it to bring the official Portuguese name). The wiki lists the texts that look like names and that you do not have yet — not even as an import draft.',
        chooseFiles: 'Choose .json file(s)', invalidFile: 'Invalid file: this is not a Nin Online translation file.', find: 'Find new names', loadError: 'Could not finish.',
        summary: '{total} texts in the file · {names} look like names · {have} already in the wiki · {new} new.', truncated: '(showing the first 5,000)', search: 'Filter…',
        hideJutsu: 'Hide what looks like a jutsu', selectShown: 'Select all in list', clear: 'Clear selection', empty: 'Nothing here.', moreHidden: '+{n} names off screen: use the filter to reach them ("Select all" covers all of them).',
        createDrafts: 'Create drafts', confirm: 'Create {n} drafts in the "{category}" category?', created: '{n} drafts created ({s} already existed and were skipped). Open each one in Content to fill in level, description and image.',
        note: 'The list is a guess: the game file mixes items, mobs, NPCs, places and screen texts, and does not say which is which. Check before creating; everything starts as a draft.',
        categories: { items: 'Items', weapons: 'Weapons', mobs: 'Mobs', missions: 'Missions', guides: 'Guides' }, hints: { jutsu: 'looks like a jutsu', recipe: 'looks like a recipe' },
      },
      translationsPage: {
        title: 'Official game translations', subtitle: 'Import the translation file from Nin Online itself (Brazilian Portuguese .json) and the wiki fills the Portuguese of content, jutsus, masteries, villages, clans and organizations with the official text.',
        chooseFile: 'Choose .json file', invalidFile: 'Invalid file: this is not a Nin Online translation file.', wrongLanguage: 'This is the file for another language. Send the "Brazilian Portuguese" file.',
        fileInfo: 'language: {language} · {count} texts · exported {date}', overwrite: 'Also replace Portuguese that already exists',
        overwriteHint: 'Off (recommended): only fills what is empty or came from automatic translation; hand-written Portuguese is kept. On: the official text replaces anything that differs.',
        preview: 'Preview changes', apply: 'Apply translations', confirmApply: 'Write {n} changes to the wiki Portuguese?', working: 'Working…', resultTitle: 'Result', applied: 'Done! {n} fields updated.',
        nothing: 'Nothing to change: everything with an official translation is already the same.', colType: 'Type', colRecords: 'Records', colChanges: 'Changes', colNoMatch: 'No official translation',
        types: { content: 'Content', jutsu: 'Jutsus', mastery: 'Masteries', village: 'Villages', clan: 'Clans', organization: 'Organizations' },
        fields: { name_pt: 'Name', description_pt: 'Description', long_description_pt: 'Full description', lore_pt: 'Lore', synergy_pt: 'Synergy', spawn_location_pt: 'Spawn location', motto_pt: 'Motto', climate_pt: 'Climate', name_by_level_pt: 'Name per level' },
        samples: 'Examples of what changes', noMatchNames: 'Names (in English) without an official translation — check the spelling:', loadError: 'Could not read the file.',
        howTo: 'Exact matches of the English text only (case-insensitive). Nothing is deleted; run it again whenever the game updates the translation.',
      },
      versionHistory: {
        title: 'Previous versions', hint: 'Every edit saves the state from before (last 25). Restoring brings the page back to that version — and is saved here too, so you can undo it.',
        empty: 'No previous versions yet: they show up after the first edit.', restore: 'Restore', confirm: 'Bring this page back to that version? The current state is kept in the history.',
        by: 'by', loadError: 'Could not load the history.', restoreError: 'Could not restore.',
      },
      reportsPage: {
        title: 'Visitor reports', subtitle: 'Outdated information and translation errors reported on the pages.',
        open: 'Open', resolved: 'Resolved', dismissed: 'Dismissed', all: 'All', allKinds: 'All types',
        kinds: { outdated: 'Outdated', translation: 'Translation', other: 'Other' }, targets: { content: 'Content', jutsu: 'Jutsu', mastery: 'Mastery' },
        empty: 'No reports here.', loadError: 'Could not load the reports.', actionError: 'Could not complete the action.',
        resolve: 'Resolve', dismiss: 'Dismiss', reopen: 'Reopen', delete: 'Delete', confirmDelete: 'Delete this report?',
        refresh: 'Refresh', reportedOn: 'Reported on', handledBy: 'Handled by', language: 'Visitor language',
      },
      volunteersPage: {
        title: 'Volunteers', subtitle: 'Applications sent through the /volunteer form. Staff only.', refresh: 'Refresh', all: 'All',
        statuses: { new: 'New', reviewing: 'Reviewing', approved: 'Approved', rejected: 'Rejected', contacted: 'Contacted' },
        searchPh: 'Search by Discord or nickname', empty: 'No applications here.', loadError: 'Could not load the applications.', actionError: 'Could not complete the action.', newCount: 'new', submittedOn: 'Sent on', reviewedBy: 'Reviewed by',
        discord: 'Discord', gameNick: 'Game nickname', languages: 'Languages', areas: 'Areas', availability: 'Availability', motivation: 'Motivation', email: 'E-mail',
        notes: 'Internal notes (staff only)', notesPh: 'Notes about this person…', saveNotes: 'Save notes', saved: 'Saved', setStatus: 'Status', delete: 'Delete', confirmDelete: 'Delete this application and all its data? This cannot be undone.',
        showing: 'Showing', prev: 'Previous', next: 'Next', details: 'View details', close: 'Close',
        formOpen: 'Form open', formClosed: 'Form closed', formOpenHint: 'Anyone can apply at /volunteer.', formClosedHint: 'The /volunteer page shows "applications closed" and the API rejects new submissions.', closeForm: 'Close applications', openForm: 'Open applications', toggleError: 'Could not change the form.',
      },
      errorsPage: {
        title: 'Errors and problems', subtitle: 'Everything that broke in the wiki (API, website, translation, attacks). The bot also alerts on Discord.',
        open: 'Open', resolved: 'Resolved', all: 'All', allSources: 'All sources', empty: 'No problems here. 🎉',
        loadError: 'Could not load the errors.', actionError: 'Could not complete the action.',
        occurrences: 'occurrences', firstSeen: 'First seen', lastSeen: 'Last seen', where: 'Where in the code', route: 'Route / page', status: 'HTTP status',
        resolve: 'Mark as resolved', reopen: 'Reopen', delete: 'Delete', confirmDelete: 'Delete this error record?',
        trace: 'Traceback (masked)', noTrace: 'No traceback for this kind of problem.', resolvedBy: 'Resolved by', ip: 'IP of the last occurrence', refresh: 'Refresh',
        sources: { api: 'API', web: 'Website', deepl: 'DeepL', security: 'Security' },
        howTo: 'If it happens again the problem reopens by itself and the bot alerts again.', hintTitle: 'What may be happening',
      },
      noticeBoard: {
        title: 'Notice board', subtitle: 'Announcements and files for the team.', empty: 'No notices yet.',
        newNotice: 'New notice', titleLabel: 'Title', bodyLabel: 'Message', pin: 'Pin to top', pinned: 'Pinned',
        save: 'Post', saving: 'Saving...', cancel: 'Cancel', edit: 'Edit', delete: 'Delete',
        confirmDelete: 'Delete the notice "{title}" and its attached files?', attachFiles: 'Attach file', files: 'Files',
        removeFile: 'Remove file', uploading: 'Uploading...', by: 'by',
        loadError: 'Could not load the notices.', saveError: 'Could not save the notice.',
        uploadError: 'Could not upload the file.', maxInfo: 'Up to 10 files per notice — accepts .zip, .rar, .7z, PDF, images and more (max 200 MB each).', fileTooBig: 'The file "{name}" is larger than {mb} MB.',
      },
      rolesPage: {
        preview: 'Preview',
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
          'content.bulk_type': 'Change the type (Item type) of several items at once', 'content.create': 'Create content', 'content.edit': 'Edit content', 'content.publish': 'Publish / unpublish content', 'content.delete': 'Delete content', 'content.import': 'Bulk import content',
          'posts.create': 'Create posts', 'posts.edit': 'Edit posts', 'posts.publish': 'Publish / unpublish posts', 'posts.delete': 'Delete posts', 'comments.moderate': 'Moderate comments and ban readers', 'translation.import': 'Import the official game translations', 'reports.manage': 'View and handle visitor reports', 'volunteers.manage': 'View, review and delete volunteer applications', 'tournaments.manage': 'Moderate player tournaments (hide, fix text, delete)', 'discord.links': 'Link Discord servers and roles to the player profile village and rank',
          'lore.edit': 'Edit Masteries, Jutsus, Villages and Organizations', 'lore.delete': 'Delete Jutsus, Villages and Organizations',
          'uploads.create': 'Upload images', 'translation.retranslate': 'Re-translate content',
          'notices.view': 'View notices and download files', 'notices.manage': 'Post, edit and delete notices', 'announcement.manage': 'Edit the Home announcement', 'media.manage': 'Rename/delete images in the image library', 'media.categorize': 'Change the category of images in the image library', 'site.maintenance': 'Turn the site maintenance mode on/off', 'media.upload': 'Upload images to the image library (bulk)', 'media.reset_ids': 'Renumber the image library IDs', 'media.closed': 'See the closed category of the image library', 'media.cat.weapon': 'See images: Weapons', 'media.cat.gear': 'See images: Gear', 'media.cat.consumable': 'See images: Consumables', 'media.cat.currency': 'See images: Currency', 'media.cat.material': 'See images: Materials', 'media.cat.ring': 'See images: Rings', 'media.cat.scroll': 'See images: Scrolls', 'media.cat.npc': 'See images: NPCs', 'media.cat.monster': 'See images: Monsters', 'media.cat.furniture': 'See images: Furniture', 'media.cat.hair_beard': 'See images: Hair/Beard', 'media.cat.skin': 'See images: Skins', 'media.cat.vanity': 'See images: Vanity', 'media.cat.tools': 'See images: Tools', 'media.cat.other': 'See images: Other', 'media.cat.none': 'See images: Uncategorized',
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
      },
      richText: {
        placeholder: 'Write here...', fichaTitle: 'Sheet title', fichaLabel: 'Label', fichaValue: 'Value',
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
        entityContentItem: 'Content', entityJutsu: 'Jutsu', 
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
        colName: 'Name', colMastery: 'Mastery', colTier: 'Tier', colChakra: 'Chakra', colStatus: 'Status', published: 'Published', draft: 'Draft',
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
        status: 'Status', statusPublished: 'Published (shown on the site)', statusDraft: 'Draft (staff only)', saveDraft: 'Save draft', publish: 'Publish',
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
        bulkItemType: 'Change item type...', bulkItemTypeApply: 'Apply type', bulkItemTypeConfirm: 'Change the type of {count} items to "{type}"?', bulkItemTypeError: 'Could not change the item type.', bulkDeleteConfirm: 'Delete {count} selected entries? This action cannot be undone.',
        bulkDeleteError: 'Error bulk deleting.',
        publish: 'Publish', markDraft: 'Mark as draft',
      },
      contentEditor: {
        catMobs: 'Mobs', catItems: 'Items', catWeapons: 'Weapons', catMissions: 'Missions', catGuides: 'Guides',
        mobMonster: 'Monster', mobBoss: 'Boss', mobNpc: 'NPC', mobMount: 'Mount',
        itemGeneral: 'General', itemRing: 'Ring', itemAccessory: 'Accessory', itemShirt: 'Shirt', itemVest: 'Vest', itemPant: 'Pant', itemHat: 'Hat', itemMask: 'Mask', itemShoe: 'Shoe', itemConsumable: 'Consumable', itemMaterial: 'Material',
        itemCurrency: 'Currency', itemCast: 'Cast', itemAuthority: 'Authority', itemPack: 'Pack', itemTool: 'Tool', itemScroll: 'Scroll / Manual', itemWardrobe: 'Gear', wardrobeKind: 'Piece type',
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
        levelZeroHint: 'Level 0 = item without a level (nothing is shown on the site).', levelUnknown: 'Level unknown (the site shows ???)', maxStack: 'Max Stack', maxStackPlaceholder: '', castVillage: 'Village that can use it',
        rarity: 'Rarity', level: 'Level', image: 'Image',
        description: 'Description', descriptionPlaceholder: 'Short description, always visible on the page...', optionalSuffix: '(optional)',
        lore: 'Lore', 
        synergy: 'Synergy', 
        spawnLocation: 'Where to find (places)', spawnLocationPlaceholder: '', addLocation: 'Add place', locationPlaceholder: 'Place name (e.g. Larva Road)', zoneLabel: 'Zone', removeLocation: 'Remove place', zones: { safe: 'Safe Zone', danger: 'Danger Zone', war: 'War Zone', arena: 'Arena Zone', parkour: 'Parkour Zone', none: 'No Zone' },
        weaponNpcHint: 'Pick the NPC page to make it a link; mobs that DROP the weapon show up by themselves under "Dropped by".', weaponNpcLinked: 'Linked to the NPC page (the name follows the page)', convertText: 'Turn the old text into a list', salesTitle: 'Sold by NPCs (shops)', addSale: 'Add shop', saleShop: 'Shop', salePrice: 'Price', saleCurrency: 'Currency', saleQty: 'Qty', removeSale: 'Remove shop',
        mobSheet: 'Mob Sheet', health: 'Health', healthPlaceholder: '',
        damage: 'Damage', damagePlaceholder: '',
        experience: 'Experience', experiencePlaceholder: '',
        range: 'Range', rangePlaceholder: '',
        respawnTime: 'Respawn Time', respawnTimePlaceholder: '',
        attacksTitle: 'Jutsu / Attacks', attackPlaceholder: '',
        noAttacks: 'No attacks yet ("None" on the public page).',
        attributesTitle: 'Attributes', 
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
