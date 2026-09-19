/**
 * NidalPlayer v5.6.2 — Samsung Smart TV (Tizen 4+)
 * High-Performance Smart TV Media Engine
 */
(function () {
'use strict';

// ── RESPONSIVE SCREEN SCALING (Protected against soft-keyboard squishing) ──
function fitToScreen() {
  var targetW = 1920;
  var targetH = 1080;
  var sw = (window.screen && window.screen.width) ? window.screen.width : 0;
  var sh = (window.screen && window.screen.height) ? window.screen.height : 0;
  var w = window.innerWidth || document.documentElement.clientWidth || sw || targetW;
  var h = window.innerHeight || document.documentElement.clientHeight || sh || targetH;

  // TV screen is strictly 16:9 widescreen.
  // If height collapsed (e.g. on-screen Leanback keyboard opened), maintain proper 16:9 scale
  if (h < (w * 9 / 16) * 0.85) {
    h = Math.round(w * (targetH / targetW));
  }
  var sx = w / targetW;
  var sy = h / targetH;
  document.body.style.transform = 'scale(' + sx + ',' + sy + ')';
  document.body.style.webkitTransform = 'scale(' + sx + ',' + sy + ')';
  document.body.style.width = targetW + 'px';
  document.body.style.height = targetH + 'px';
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fitToScreen);
} else {
  fitToScreen();
}
window.addEventListener('resize', fitToScreen);

// ── CONSTANTS ──────────────────────────────────────────────────────────────
var COMPANION = 'http://192.168.11.126:8765';

var PREVIEW_RECT = { x: 1128, y: 100, w: 764, h: 440 };
var FS_RECT      = { x: 0,    y: 0,   w: 1920, h: 1080 };

// ── STATE ──────────────────────────────────────────────────────────────────
var S = {
  lang: 'en', view: 'home',
  playlists: [], activePl: null,
  favs: {}, favsLive: {}, history: {},
  live: [], movies: [], series: [],
  liveCats: [], movieCats: [], seriesCats: [],
  selCat: { live: 'ALL', movies: '🔥 POPULAR', series: '🔥 POPULAR', favs: 'ALL' },
  activeCh: null, activeItem: null,
  seriesEps: [], epIdx: -1,
  isFs: false, isSyncing: false,
  playbackPosition: 0, playbackDuration: 0, playbackPaused: false, playbackTitle: '', playbackType: 'movie',
  modal: null, osdTimer: 0
};

// ── DOM REFS ────────────────────────────────────────────────────────────────
var D = {};

// ── REALTIME LOGGER ────────────────────────────────────────────────────────
function logTV(msg, data) {
  try {
    fetch(COMPANION + '/api/tv-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: msg, data: data })
    }).catch(function(){});
  } catch(e){}
}

// ── i18n MULTI-LANGUAGE ENGINE ─────────────────────────────────────────────
var TR = {
  en: {
    nav_live: 'Live TV',
    nav_series: 'Series',
    nav_movies: 'Movies',
    nav_favorites: 'Favorites',
    nav_settings: 'Settings',
    syncing: '↻ Syncing playlist from server…',
    ready: '✓ Ready to watch',
    ready_c: '✓ {c} Channels • {m} Movies • {s} Series',
    no_pl: '⚡ Add a playlist to get started',
    sync: '↻ SYNC', status: 'STATUS:', pl_label: 'PLAYLIST:',
    all_ch: 'ALL CHANNELS', all_mv: 'ALL MOVIES', all_sr: 'ALL SERIES',
    favorites: 'FAVORITES', all_favs: 'ALL FAVORITES',
    fav_live: 'LIVE CHANNELS', fav_movies: 'MOVIES', fav_series: 'SERIES',
    cats: 'CATEGORIES', mv_genres: 'MOVIE GENRES', sr_genres: 'SERIES GENRES',
    live_prev: 'LIVE PREVIEW', now_pl: 'NOW PLAYING',
    expand: 'PRESS OK FOR FULLSCREEN',
    fav_add: '★ Added to Favorites', fav_rem: 'Removed from Favorites',
    sync_done: 'Sync complete', cache_ok: 'Cache cleared',
    no_stream: 'No stream URL available',
    prev_ep: 'PREV EP', next_ep: 'NEXT EP', pause: 'PAUSE', play: 'PLAY',
    fav: 'FAVORITE', back: 'Back',
    ep_last: 'Last episode reached', ep_first: 'Already first episode',
    app_language: 'Display Language',
    select_language: 'Select interface language',
    playlist_mgmt: 'PLAYLIST MANAGER',
    add_new_playlist: '➕ ADD NEW XTREAM PLAYLIST',
    switched_pl: 'Switched to playlist',
    deleted_pl: 'Playlist deleted',
    active_badge: '● ACTIVE',
    switch_btn: 'SWITCH',
    delete_btn: 'DELETE',
    no_favs: 'No Favorites Saved',
    no_favs_sub: 'Press FAVORITE or use Options while browsing Live TV, Movies, or Series to add them here!',
    watched: 'Watched',
    next_up: 'Next',
    not_started: 'Not started',
    search: 'Search',
    fullscreen: 'Fullscreen',
    home: 'Home',
    play_or_view: 'Play / Details',
    remove_favorite: 'Remove Favorite',
    seasons_episodes: 'Browse Episodes',
    play_now: 'Play Movie',
    cancel: 'CANCEL',
    clear_cache: 'Clear Storage Cache',
    primary_engine: 'Hardware ExoPlayer Engine',
    exp_label: 'EXPIRATION:',
    days_left: 'days left',
    exp_unlimited: 'Unlimited / Permanent',
    expired: 'Expired',
    edit_btn: 'EDIT',
    edit_playlist: 'EDIT PLAYLIST',
    save_changes: 'SAVE CHANGES',
    fav_add_btn: '★ ADD TO FAVORITES',
    fav_remove_btn: '★ REMOVE FROM FAVORITES',
    pop_now: '🔥 POPULAR RIGHT NOW',
    all: 'ALL',
    channels_badge: 'CHANNELS',
    movies_badge: 'MOVIES',
    shows_badge: 'SHOWS',
    saved_badge: 'SAVED',
    badge_preferences: 'PREFERENCES',
    hint_enter: 'Enter Section',
    hint_navigate: 'Navigate',
    hint_exit: 'Exit',
    hint_channels: 'Channels',
    hint_cats_prev: 'Categories & Preview',
    play_movie: '▶ PLAY MOVIE',
    resume_movie: '▶ RESUME ({m} min)',
    seasons: 'Season',
    episodes_label: 'EPISODES',
    close_btn: 'CLOSE',
    select_channel: 'Select a channel',
    live_broadcast: 'Live Broadcast Stream',
    no_playlist_name: 'No Playlist',
    nav_back: 'Back',
    hero_kicker: 'ULTRA LIGHTWEIGHT SMART TV EDITION',
    movie_genres: 'MOVIE GENRES',
    series_genres: 'SERIES GENRES',
    search_placeholder: 'Search channels, movies, or series...',
    categories: 'CATEGORIES',
    add_favorites: 'FAVORITE',
    mobile_remote: 'MOBILE REMOTE CONTROL',
    remote_desc: 'Scan this QR code with your phone camera to control your TV or add playlists.',
    playlist_title_label: 'PLAYLIST NAME',
    username_label: 'USERNAME *',
    server_url_label: 'SERVER URL *',
    password_label: 'PASSWORD *',
    save_sync: 'CONNECT & LOAD ▶'
  },
  fr: {
    nav_live: 'Télé en Direct',
    nav_series: 'Séries',
    nav_movies: 'Films',
    nav_favorites: 'Favoris',
    nav_settings: 'Paramètres',
    syncing: '↻ Synchronisation de la playlist…',
    ready: '✓ Prêt à regarder',
    ready_c: '✓ {c} Chaînes • {m} Films • {s} Séries',
    no_pl: '⚡ Ajoutez une playlist pour commencer',
    sync: '↻ SYNC', status: 'STATUT:', pl_label: 'PLAYLIST:',
    all_ch: 'TOUTES LES CHAÎNES', all_mv: 'TOUS LES FILMS', all_sr: 'TOUTES LES SÉRIES',
    favorites: 'FAVORIS', all_favs: 'TOUS LES FAVORIS',
    fav_live: 'CHAÎNES EN DIRECT', fav_movies: 'FILMS', fav_series: 'SÉRIES',
    cats: 'CATÉGORIES', mv_genres: 'GENRES FILMS', sr_genres: 'GENRES SÉRIES',
    live_prev: 'APERÇU EN DIRECT', now_pl: 'EN COURS DE LECTURE',
    expand: 'APPUYEZ SUR OK POUR PLEIN ÉCRAN',
    fav_add: '★ Ajouté aux favoris', fav_rem: 'Retiré des favoris',
    sync_done: 'Synchronisation terminée', cache_ok: 'Cache effacé',
    no_stream: 'Aucun flux disponible',
    prev_ep: 'ÉP PRÉC', next_ep: 'ÉP SUIV', pause: 'PAUSE', play: 'LECTURE',
    fav: 'FAVORI', back: 'Retour',
    ep_last: 'Dernier épisode atteint', ep_first: 'Déjà au premier épisode',
    app_language: "Langue d'affichage",
    select_language: "Sélectionnez la langue de l'interface",
    playlist_mgmt: 'GESTIONNAIRE DE PLAYLISTS',
    add_new_playlist: '➕ AJOUTER UNE NOUVELLE PLAYLIST',
    switched_pl: 'Playlist activée',
    deleted_pl: 'Playlist supprimée',
    active_badge: '● ACTIF',
    switch_btn: 'ACTIVER',
    delete_btn: 'SUPPRIMER',
    no_favs: 'Aucun favori enregistré',
    no_favs_sub: 'Appuyez sur FAVORI ou utilisez le menu sur une chaîne, un film ou une série pour l\'ajouter ici!',
    watched: 'Vu',
    next_up: 'Suivant',
    not_started: 'Non commencé',
    search: 'Rechercher',
    fullscreen: 'Plein écran',
    home: 'Accueil',
    play_or_view: 'Lire / Détails',
    remove_favorite: 'Retirer des favoris',
    seasons_episodes: 'Parcourir les épisodes',
    play_now: 'Lire le film',
    cancel: 'ANNULER',
    clear_cache: 'Effacer le cache',
    primary_engine: 'Moteur matériel ExoPlayer',
    exp_label: 'EXPIRATION :',
    days_left: 'jours restants',
    exp_unlimited: 'Illimité / Permanent',
    expired: 'Expiré',
    edit_btn: 'MODIFIER',
    edit_playlist: 'MODIFIER LA PLAYLIST',
    save_changes: 'ENREGISTRER',
    fav_add_btn: '★ AJOUTER AUX FAVORIS',
    fav_remove_btn: '★ RETIRER DES FAVORIS',
    pop_now: '🔥 POPULAIRE MAINTENANT',
    all: 'TOUS',
    channels_badge: 'CHAÎNES',
    movies_badge: 'FILMS',
    shows_badge: 'SÉRIES',
    saved_badge: 'ENREGISTRÉS',
    badge_preferences: 'PRÉFÉRENCES',
    hint_enter: 'Entrer',
    hint_navigate: 'Naviguer',
    hint_exit: 'Quitter',
    hint_channels: 'Chaînes',
    hint_cats_prev: 'Catégories & Aperçu',
    play_movie: '▶ LIRE LE FILM',
    resume_movie: '▶ REPRENDRE ({m} min)',
    seasons: 'Saison',
    episodes_label: 'ÉPISODES',
    close_btn: 'FERMER',
    select_channel: 'Sélectionnez une chaîne',
    live_broadcast: 'Flux en direct',
    no_playlist_name: 'Aucune playlist',
    nav_back: 'Retour',
    hero_kicker: 'ÉDITION SMART TV ULTRA-LÉGÈRE',
    movie_genres: 'GENRES FILMS',
    series_genres: 'GENRES SÉRIES',
    search_placeholder: 'Rechercher chaînes, films, séries...',
    categories: 'CATÉGORIES',
    add_favorites: 'FAVORI',
    mobile_remote: 'TÉLÉCOMMANDE MOBILE',
    remote_desc: 'Scannez ce code QR avec votre téléphone pour contrôler la TV ou ajouter des playlists.',
    playlist_title_label: 'NOM DE LA PLAYLIST',
    username_label: "NOM D'UTILISATEUR *",
    server_url_label: 'URL DU SERVEUR *',
    password_label: 'MOT DE PASSE *',
    save_sync: 'CONNECTER & CHARGER ▶'
  },
  ar: {
    nav_live: 'البث المباشر',
    nav_series: 'المسلسلات',
    nav_movies: 'الأفلام',
    nav_favorites: 'المفضلة',
    nav_settings: 'الإعدادات',
    syncing: '↻ جاري مزامنة القائمة…',
    ready: '✓ جاهز للمشاهدة',
    ready_c: '✓ {c} قناة • {m} فيلم • {s} مسلسل',
    no_pl: '⚡ أضف قائمة تشغيل للبدء',
    sync: '↻ مزامنة', status: 'الحالة:', pl_label: 'القائمة:',
    all_ch: 'جميع القنوات', all_mv: 'جميع الأفلام', all_sr: 'جميع المسلسلات',
    favorites: 'المفضلة', all_favs: 'جميع المفضلة',
    fav_live: 'قنوات البث', fav_movies: 'الأفلام', fav_series: 'المسلسلات',
    cats: 'الفئات', mv_genres: 'تصنيفات الأفلام', sr_genres: 'تصنيفات المسلسلات',
    live_prev: 'معاينة البث', now_pl: 'يعرض الآن',
    expand: 'اضغط OK للشاشة الكاملة',
    fav_add: '★ تمت الإضافة إلى المفضلة', fav_rem: 'تمت الإزالة من المفضلة',
    sync_done: 'اكتملت المزامنة', cache_ok: 'تم مسح الذاكرة المؤقتة',
    no_stream: 'لا يوجد رابط بث',
    prev_ep: 'الحلقة السابقة', next_ep: 'الحلقة التالية', pause: 'إيقاف', play: 'تشغيل',
    fav: 'المفضلة', back: 'رجوع',
    ep_last: 'وصلت لآخر حلقة', ep_first: 'أنت في الحلقة الأولى',
    app_language: 'لغة العرض',
    select_language: 'اختر لغة الواجهة',
    playlist_mgmt: 'إدارة قوائم التشغيل',
    add_new_playlist: '➕ إضافة قائمة جديدة',
    switched_pl: 'تم التبديل إلى القائمة',
    deleted_pl: 'تم حذف القائمة',
    active_badge: '● مفعّلة',
    switch_btn: 'تبديل',
    delete_btn: 'حذف',
    no_favs: 'لا توجد عناصر في المفضلة',
    no_favs_sub: 'اضغط على زر المفضلة أثناء تصفح القنوات أو الأفلام أو المسلسلات لإضافتها هنا!',
    watched: 'تمت مشاهدة',
    next_up: 'الحلقة',
    not_started: 'لم تبدأ بعد',
    search: 'بحث',
    fullscreen: 'شاشة كاملة',
    home: 'الرئيسية',
    play_or_view: 'تشغيل / تفاصيل',
    remove_favorite: 'إزالة من المفضلة',
    seasons_episodes: 'تصفح الحلقات',
    play_now: 'تشغيل الفيلم',
    cancel: 'إلغاء',
    clear_cache: 'مسح الذاكرة المؤقتة',
    primary_engine: 'مشغل ExoPlayer المسرع',
    exp_label: 'تاريخ الانتهاء:',
    days_left: 'يوم متبقي',
    exp_unlimited: 'غير محدود / دائم',
    expired: 'منتهي الصلاحية',
    edit_btn: 'تعديل',
    edit_playlist: 'تعديل قائمة التشغيل',
    save_changes: 'حفظ التعديلات',
    fav_add_btn: '★ إضافة إلى المفضلة',
    fav_remove_btn: '★ إزالة من المفضلة',
    pop_now: '🔥 الأكثر مشاهدة الآن',
    all: 'الكل',
    channels_badge: 'قناة',
    movies_badge: 'فيلم',
    shows_badge: 'مسلسل',
    saved_badge: 'محفوظ',
    badge_preferences: 'التفضيلات',
    hint_enter: 'دخول القسم',
    hint_navigate: 'تنقل',
    hint_exit: 'خروج',
    hint_channels: 'القنوات',
    hint_cats_prev: 'الفئات والمعاينة',
    play_movie: '▶ تشغيل الفيلم',
    resume_movie: '▶ استئناف ({m} دقيقة)',
    seasons: 'الموسم',
    episodes_label: 'الحلقات',
    close_btn: 'إغلاق',
    select_channel: 'اختر قناة للبدء',
    live_broadcast: 'بث مباشر',
    no_playlist_name: 'لا توجد قائمة',
    nav_back: 'رجوع',
    hero_kicker: 'نسخة التلفزيون الذكي فائقة السرعة والخفة',
    movie_genres: 'تصنيفات الأفلام',
    series_genres: 'تصنيفات المسلسلات',
    search_placeholder: 'ابحث عن القنوات أو الأفلام أو المسلسلات...',
    categories: 'الفئات',
    add_favorites: 'المفضلة',
    mobile_remote: 'ريموت الهاتف الذكي',
    remote_desc: 'امسح رمز الاستجابة السريعة بكاميرا هاتفك للتحكم في التلفزيون أو إضافة قوائم التشغيل.',
    playlist_title_label: 'اسم قائمة التشغيل',
    username_label: 'اسم المستخدم *',
    server_url_label: 'رابط السيرفر *',
    password_label: 'كلمة المرور *',
    save_sync: 'اتصال وتحميل ▶'
  },
  es: {
    nav_live: 'TV en Vivo',
    nav_series: 'Series',
    nav_movies: 'Películas',
    nav_favorites: 'Favoritos',
    nav_settings: 'Ajustes',
    syncing: '↻ Sincronizando lista…',
    ready: '✓ Listo para ver',
    ready_c: '✓ {c} Canales • {m} Películas • {s} Series',
    no_pl: '⚡ Agrega una lista para empezar',
    sync: '↻ SINC', status: 'ESTADO:', pl_label: 'LISTA:',
    all_ch: 'TODOS LOS CANALES', all_mv: 'TODAS LAS PELÍCULAS', all_sr: 'TODAS LAS SERIES',
    favorites: 'FAVORITOS', all_favs: 'TODOS LOS FAVORITOS',
    fav_live: 'CANALES EN VIVO', fav_movies: 'PELÍCULAS', fav_series: 'SERIES',
    cats: 'CATEGORÍAS', mv_genres: 'GÉNEROS PELÍCULAS', sr_genres: 'GÉNEROS SERIES',
    live_prev: 'VISTA PREVIA', now_pl: 'REPRODUCIENDO',
    expand: 'PRESIONA OK PARA PANTALLA COMPLETA',
    fav_add: '★ Añadido a favoritos', fav_rem: 'Eliminado de favoritos',
    sync_done: 'Sincronización completa', cache_ok: 'Caché borrada',
    no_stream: 'No hay URL de transmisión',
    prev_ep: 'EP ANTERIOR', next_ep: 'EP SIGUIENTE', pause: 'PAUSA', play: 'REPRODUCIR',
    fav: 'FAVORITO', back: 'Volver',
    ep_last: 'Último episodio alcanzado', ep_first: 'Ya estás en el primer episodio',
    app_language: 'Idioma de la interfaz',
    select_language: 'Selecciona el idioma',
    playlist_mgmt: 'ADMINISTRADOR DE LISTAS',
    add_new_playlist: '➕ AÑADIR NUEVA LISTA XTREAM',
    switched_pl: 'Cambiado a lista',
    deleted_pl: 'Lista eliminada',
    active_badge: '● ACTIVO',
    switch_btn: 'CAMBIAR',
    delete_btn: 'ELIMINAR',
    no_favs: 'No hay favoritos guardados',
    no_favs_sub: '¡Presiona FAVORITO en tu control remoto sobre cualquier canal, película o serie!',
    watched: 'Visto',
    next_up: 'Siguiente',
    not_started: 'No iniciado',
    search: 'Buscar',
    fullscreen: 'Pantalla completa',
    home: 'Inicio',
    play_or_view: 'Reproducir / Detalles',
    remove_favorite: 'Quitar de favoritos',
    seasons_episodes: 'Ver episodios',
    play_now: 'Ver película',
    cancel: 'CANCELAR',
    clear_cache: 'Borrar caché',
    primary_engine: 'Motor hardware ExoPlayer',
    exp_label: 'EXPIRATION:',
    days_left: 'días restantes',
    exp_unlimited: 'Ilimitado / Permanente',
    expired: 'Expirado',
    edit_btn: 'EDITAR',
    edit_playlist: 'EDITAR LISTA',
    save_changes: 'GUARDAR CAMBIOS',
    fav_add_btn: '★ AÑADIR A FAVORITOS',
    fav_remove_btn: '★ QUITAR DE FAVORITOS',
    pop_now: '🔥 POPULAR AHORA',
    all: 'TODOS',
    channels_badge: 'CANALES',
    movies_badge: 'PELÍCULAS',
    shows_badge: 'SERIES',
    saved_badge: 'GUARDADOS',
    badge_preferences: 'PREFERENCIAS',
    hint_enter: 'Entrar',
    hint_navigate: 'Navegar',
    hint_exit: 'Salir',
    hint_channels: 'Canales',
    hint_cats_prev: 'Categorías y Vista previa',
    play_movie: '▶ VER PELÍCULA',
    resume_movie: '▶ REANUDAR ({m} min)',
    seasons: 'Temporada',
    episodes_label: 'EPISODIOS',
    close_btn: 'CERRAR',
    select_channel: 'Selecciona un canal',
    live_broadcast: 'Transmisión en directo',
    no_playlist_name: 'Sin lista',
    nav_back: 'Volver',
    hero_kicker: 'EDICIÓN SMART TV ULTRA LIGERA',
    movie_genres: 'GÉNEROS PELÍCULAS',
    series_genres: 'GÉNEROS SERIES',
    search_placeholder: 'Buscar canales, películas, series...',
    categories: 'CATEGORÍAS',
    add_favorites: 'FAVORITO',
    mobile_remote: 'CONTROL REMOTO MÓVIL',
    remote_desc: 'Escanea este código QR con tu móvil para controlar la TV o añadir listas.',
    playlist_title_label: 'NOMBRE DE LA LISTA',
    username_label: 'USUARIO *',
    server_url_label: 'URL DEL SERVIDOR *',
    password_label: 'CONTRASEÑA *',
    save_sync: 'CONECTAR Y CARGAR ▶'
  },
  de: {
    nav_live: 'Live-TV',
    nav_series: 'Serien',
    nav_movies: 'Filme',
    nav_favorites: 'Favoriten',
    nav_settings: 'Einstellungen',
    syncing: '↻ Wiedergabeliste wird synchronisiert…',
    ready: '✓ Bereit zum Ansehen',
    ready_c: '✓ {c} Kanäle • {m} Filme • {s} Serien',
    no_pl: '⚡ Fügen Sie eine Wiedergabeliste hinzu',
    sync: '↻ SYNC', status: 'STATUS:', pl_label: 'LISTE:',
    all_ch: 'ALLE KANÄLE', all_mv: 'ALLE FILME', all_sr: 'ALLE SERIEN',
    favorites: 'FAVORITEN', all_favs: 'ALLE FAVORITEN',
    fav_live: 'LIVE-KANÄLE', fav_movies: 'FILME', fav_series: 'SERIEN',
    cats: 'KATEGORIEN', mv_genres: 'FILM-GENRES', sr_genres: 'SERIEN-GENRES',
    live_prev: 'LIVE-VORSCHAU', now_pl: 'JETZT LÄUFT',
    expand: 'OK DRÜCKEN FÜR VOLLBILD',
    fav_add: '★ Zu Favoriten hinzugefügt', fav_rem: 'Aus Favoriten entfernt',
    sync_done: 'Synchronisierung abgeschlossen', cache_ok: 'Cache gelöscht',
    no_stream: 'Keine Stream-URL verfügbar',
    prev_ep: 'VORHERIGE EP', next_ep: 'NÄCHSTE EP', pause: 'PAUSE', play: 'ABSPIELEN',
    fav: 'FAVORIT', back: 'Zurück',
    ep_last: 'Letzte Folge erreicht', ep_first: 'Bereits erste Folge',
    app_language: 'Anzeigesprache',
    select_language: 'Wählen Sie die Sprache',
    playlist_mgmt: 'PLAYLIST-VERWALTUNG',
    add_new_playlist: '➕ NEUE PLAYLIST HINZUFÜGEN',
    switched_pl: 'Gewechselt zu Playlist',
    deleted_pl: 'Playlist gelöscht',
    active_badge: '● AKTIV',
    switch_btn: 'WÄHLEN',
    delete_btn: 'LÖSCHEN',
    no_favs: 'Keine Favoriten gespeichert',
    no_favs_sub: 'Drücken Sie FAVORIT auf der Fernbedienung, um Sender, Filme oder Serien hinzuzufügen!',
    watched: 'Gesehen',
    next_up: 'Als Nächstes',
    not_started: 'Nicht begonnen',
    search: 'Suchen',
    fullscreen: 'Vollbild',
    home: 'Startseite',
    play_or_view: 'Abspielen / Details',
    remove_favorite: 'Aus Favoriten entfernen',
    seasons_episodes: 'Folgen ansehen',
    play_now: 'Film ansehen',
    cancel: 'ABBRECHEN',
    clear_cache: 'Cache leeren',
    primary_engine: 'ExoPlayer Hardware-Engine',
    exp_label: 'ABLAUFDATUM:',
    days_left: 'Tage übrig',
    exp_unlimited: 'Unbegrenzt / Dauerhaft',
    expired: 'Abgelaufen',
    edit_btn: 'BEARBEITEN',
    edit_playlist: 'PLAYLIST BEARBEITEN',
    save_changes: 'SPEICHERN',
    fav_add_btn: '★ ZU FAVORITEN HINZUFÜGEN',
    fav_remove_btn: '★ AUS FAVORITEN ENTFERNEN',
    pop_now: '🔥 JETZT BELIEBT',
    all: 'ALLE',
    channels_badge: 'KANÄLE',
    movies_badge: 'FILME',
    shows_badge: 'SERIEN',
    saved_badge: 'GESPEICHERT',
    badge_preferences: 'EINSTELLUNGEN',
    hint_enter: 'Öffnen',
    hint_navigate: 'Navigieren',
    hint_exit: 'Beenden',
    hint_channels: 'Sender',
    hint_cats_prev: 'Kategorien & Vorschau',
    play_movie: '▶ FILM ABSPIELEN',
    resume_movie: '▶ FORTSETZEN ({m} Min)',
    seasons: 'Staffel',
    episodes_label: 'FOLGEN',
    close_btn: 'SCHLIESSEN',
    select_channel: 'Kanal auswählen',
    live_broadcast: 'Live-Übertragung',
    no_playlist_name: 'Keine Playlist',
    nav_back: 'Zurück',
    hero_kicker: 'ULTRA-LEICHTE SMART TV EDITION',
    movie_genres: 'FILM-GENRES',
    series_genres: 'SERIEN-GENRES',
    search_placeholder: 'Sender, Filme, Serien suchen...',
    categories: 'KATEGORIEN',
    add_favorites: 'FAVORIT',
    mobile_remote: 'MOBILE FERNBEDIENUNG',
    remote_desc: 'Scannen Sie diesen QR-Code mit Ihrem Smartphone, um den TV zu steuern oder Playlists hinzuzufügen.',
    playlist_title_label: 'PLAYLIST-NAME',
    username_label: 'BENUTZERNAME *',
    server_url_label: 'SERVER-URL *',
    password_label: 'PASSWORT *',
    save_sync: 'VERBINDEN & LADEN ▶'
  }
};

function t(k, vars) {
  var d = TR[S.lang] || TR.en;
  var s = d[k] || (TR.en && TR.en[k]) || k;
  if (vars) Object.keys(vars).forEach(function(v){ s = s.replace('{'+v+'}', vars[v]); });
  return s;
}

function applyLang(lang) {
  S.lang = lang || 'en';
  try { localStorage.setItem('np_lang', S.lang); } catch(e) {}
  if (window.AndroidBridge && window.AndroidBridge.saveLanguage) {
    try { window.AndroidBridge.saveLanguage(S.lang); } catch(e) {}
  }
  document.documentElement.dir = 'ltr';
  document.documentElement.classList.toggle('lang-ar', S.lang === 'ar');

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (key && (TR[S.lang][key] || TR.en[key])) {
      el.textContent = t(key);
    }
  });

  var sInput = document.getElementById('searchInput');
  if (sInput) sInput.placeholder = t('search_placeholder');

  document.querySelectorAll('#langPillsRow .lang-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.lang === S.lang);
  });

  _updateStatus();
  _updateCounts();

  if (S.view === 'movies') {
    _renderMovies();
  } else if (S.view === 'series') {
    _renderSeries();
  } else if (S.view === 'live') {
    _renderLive();
  } else if (S.view === 'favorites') {
    _renderFavorites();
  } else if (S.view === 'settings') {
    _renderSettings();
  }
  if (D.topPageTitle && S.view) {
    D.topPageTitle.textContent = (t('nav_' + S.view) || S.view).toUpperCase();
  }
}

// ── STORAGE ────────────────────────────────────────────────────────────────
function load() {
  try {
    var p = localStorage.getItem('np_pl'); if (p) S.playlists = JSON.parse(p);
    var id= localStorage.getItem('np_apid');
    S.activePl = S.playlists.find(function(x){ return x.id===id; }) || S.playlists[0] || null;
    var f = localStorage.getItem('np_fav'); if (f) S.favs = JSON.parse(f);
    var fl = localStorage.getItem('np_fav_live'); if (fl) S.favsLive = JSON.parse(fl);
    var h = localStorage.getItem('np_hist');if (h) S.history = JSON.parse(h);
    var savedLang = localStorage.getItem('np_lang');
    if (!savedLang && window.AndroidBridge && window.AndroidBridge.getLanguage) {
      savedLang = window.AndroidBridge.getLanguage();
    }
    S.lang = savedLang || 'en';
  } catch(e){}
  if (!S.favs || typeof S.favs !== 'object') S.favs = {};
  if (!S.favsLive || typeof S.favsLive !== 'object') S.favsLive = {};
}
function savePl()   { try{ localStorage.setItem('np_pl', JSON.stringify(S.playlists)); localStorage.setItem('np_apid', S.activePl?S.activePl.id:''); }catch(e){} }
function saveFav()  {
  try {
    localStorage.setItem('np_fav', JSON.stringify(S.favs));
    localStorage.setItem('np_fav_live', JSON.stringify(S.favsLive));
  } catch(e){}
}
function saveHist() { try{ localStorage.setItem('np_hist',JSON.stringify(S.history)); }catch(e){} }

// ── AVPLAY ENGINE ──────────────────────────────────────────────────────────
var AV = {
  _state: 'NONE',
  _url: '',
  supported: function(){ return !!(window.webapis && window.webapis.avplay); },

  play: function(url, rect, isLive) {
    var self = this;
    if (!url) { toast(t('no_stream')); logTV('AV.play skipped: no URL'); return; }

    url = url.trim().replace(/^[A-Za-z]+:\/\//, function(m){ return m.toLowerCase(); });
    var hlsUrl = url.replace(/\.ts$/i, '.m3u8');

    logTV('AV.play request', { url: url, hlsUrl: hlsUrl, isLive: isLive, isFs: rect === FS_RECT, hasAVPlay: self.supported(), hasAndroid: !!window.AndroidBridge });

    self._teardown();

    // 1. Android Native Hardware ExoPlayer Bridge
    if (window.AndroidBridge && window.AndroidBridge.playNativePreview) {
      logTV('Using Android native ExoPlayer hardware acceleration');
      self._url = url;
      self._state = 'PLAYING';
      if (rect === FS_RECT) {
        window.AndroidBridge.playNativePreview(url, 0, 0, 1920, 1080, 1920, 1080);
        window.AndroidBridge.expandNativePreviewToFullscreen();
      } else {
        window.AndroidBridge.playNativePreview(url, rect.x, rect.y, rect.w, rect.h, 1920, 1080);
      }
      return;
    }

    // 2. Samsung Smart TV Tizen AVPlay
    if (self.supported()) {
      try {
        var obj = document.getElementById('avplayObject');
        if (obj) {
          obj.style.display = 'block';
          obj.style.left = rect.x + 'px';
          obj.style.top = rect.y + 'px';
          obj.style.width = rect.w + 'px';
          obj.style.height = rect.h + 'px';
          obj.style.zIndex = (rect === FS_RECT) ? '5001' : '9999';
        }

        webapis.avplay.open(url);
        self._url = url;
        self._state = 'OPEN';
        webapis.avplay.setDisplayRect(rect.x, rect.y, rect.w, rect.h);
        webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
        try {
          webapis.avplay.setStreamingProperty('ADAPTIVE_INFO', 'FIXED_MAX_RESOLUTION=1920x1080');
        } catch(e){}

        webapis.avplay.setListener({
          onbufferingstart: function(){ _spin(true); logTV('AVPlay buffering start'); },
          onbufferingcomplete: function(){ _spin(false); logTV('AVPlay buffering complete'); },
          oncurrentplaytime: function(ms){
            if (!isLive && D.osdFill) {
              try {
                var dur = webapis.avplay.getDuration();
                if (dur > 0) _scrub(ms/1000, dur/1000);
              } catch(e){}
            }
          },
          onstreamcompleted: function(){
            logTV('AVPlay stream completed');
            self._state = 'ENDED';
            _spin(false);
            if (S.activeItem && S.activeItem._type === 'series') _nextEp();
          },
          onerror: function(e){
            logTV('AVPlay listener onerror', e);
            _spin(false);
            self._teardown();
            _html5Play(isLive ? hlsUrl : url, isLive, rect === FS_RECT);
          }
        });

        webapis.avplay.prepareAsync(
          function(){
            logTV('AVPlay prepareAsync SUCCESS, setting display rect', rect);
            try {
              webapis.avplay.setDisplayRect(rect.x, rect.y, rect.w, rect.h);
              webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
              webapis.avplay.play();
              self._state = 'PLAYING';
              _spin(false);
              logTV('AVPlay state is now PLAYING with rect', rect);
            } catch(er){
              logTV('AVPlay play() call failed', er ? er.message : er);
              _html5Play(isLive ? hlsUrl : url, isLive, rect === FS_RECT);
            }
          },
          function(e){
            logTV('AVPlay prepareAsync FAILED, trying HLS fallback', e);
            self._teardown();
            _html5Play(isLive ? hlsUrl : url, isLive, rect === FS_RECT);
          }
        );
      } catch(e) {
        logTV('AVPlay open() exception, falling back to HTML5', e ? e.message : e);
        _html5Play(isLive ? hlsUrl : url, isLive, rect === FS_RECT);
      }
      return;
    }

    // 3. Fallback: HTML5 Video
    logTV('AVPlay/AndroidBridge not available, using HTML5 video');
    _html5Play(isLive ? hlsUrl : url, isLive, rect === FS_RECT);
  },

  seekRel: function(delta) {
    if (window.AndroidBridge && window.AndroidBridge.seekNativePreviewRelative) {
      window.AndroidBridge.seekNativePreviewRelative(delta * 1000);
      toast((delta > 0 ? '▶▶ +' : '◀◀ ') + Math.abs(delta) + 's');
      return;
    }
    if (!this.supported() || this._state !== 'PLAYING') return;
    try {
      var pos = webapis.avplay.getCurrentTime();
      var dur = webapis.avplay.getDuration();
      var t2  = Math.max(0, Math.min(dur - 1000, pos + delta * 1000));
      webapis.avplay.seekTo(t2);
      _scrub(t2/1000, dur/1000);
      toast((delta > 0 ? '▶▶ +' : '◀◀ ') + Math.abs(delta) + 's');
    } catch(e){}
  },

  pause: function() {
    if (window.AndroidBridge && window.AndroidBridge.toggleNativePreviewPlayPause) {
      window.AndroidBridge.toggleNativePreviewPlayPause();
      this._state = 'PAUSED';
      return;
    }
    if (!this.supported()) return;
    try { webapis.avplay.pause(); this._state = 'PAUSED'; logTV('AVPlay paused'); } catch(e){}
  },

  resume: function() {
    if (window.AndroidBridge && window.AndroidBridge.toggleNativePreviewPlayPause) {
      window.AndroidBridge.toggleNativePreviewPlayPause();
      this._state = 'PLAYING';
      return;
    }
    if (!this.supported()) return;
    try { webapis.avplay.play(); this._state = 'PLAYING'; logTV('AVPlay resumed'); } catch(e){}
  },

  _teardown: function() {
    if (window.AndroidBridge && window.AndroidBridge.stopNativePreview) {
      try { window.AndroidBridge.stopNativePreview(); } catch(e){}
    }
    _hlsDestroy();
    if (!this.supported()) {
      this._state = 'NONE';
      this._url   = '';
      return;
    }
    try {
      var st = webapis.avplay.getState();
      if (st === 'PLAYING' || st === 'PAUSED' || st === 'READY') webapis.avplay.stop();
      if (st !== 'NONE') webapis.avplay.close();
    } catch(e){}
    this._state = 'NONE';
    this._url   = '';
    try {
      var obj = document.getElementById('avplayObject');
      if (obj) obj.style.display = 'none';
    } catch(e){}
  }
};

var _hls = null;
function _html5Play(url, isLive, isFs) {
  var vid = isFs ? D.fsVid : D.prevVid;
  if (!vid) { logTV('HTML5 video element not available'); return; }
  logTV('HTML5 starting playback', { url: url, isFs: isFs });
  _hlsDestroy();
  vid.style.display = 'block';

  if (url.indexOf('.m3u8') >= 0 && window.Hls && Hls.isSupported()) {
    _hls = new Hls({ enableWorker: false, lowLatencyMode: true });
    _hls.loadSource(url);
    _hls.attachMedia(vid);
    _hls.on(Hls.Events.MANIFEST_PARSED, function(){
      vid.play().catch(function(err){ logTV('HLS play error', err.message); });
    });
    _hls.on(Hls.Events.ERROR, function(e, d){
      if (d.fatal){
        _hlsDestroy();
        vid.src = url;
        vid.play().catch(function(){});
      }
    });
  } else {
    vid.src = url;
    vid.play().catch(function(err){ logTV('HTML5 direct play error', err.message); });
  }

  vid.ontimeupdate = function(){
    if (!isLive && vid.duration) _scrub(vid.currentTime, vid.duration);
  };
  vid.onended = function(){
    if (S.activeItem && S.activeItem._type === 'series') _nextEp();
  };
}
function _hlsDestroy() { if (_hls){ try{ _hls.destroy(); }catch(e){} _hls = null; } }

function stopAll() {
  if (window.AndroidBridge && window.AndroidBridge.stopNativePreview) {
    try { window.AndroidBridge.stopNativePreview(); } catch(e){}
  }
  AV._teardown();
  _hlsDestroy();
  if (D.prevVid) { D.prevVid.pause(); D.prevVid.src=''; D.prevVid.removeAttribute('src'); D.prevVid.style.display='none'; }
  if (D.fsVid)  { D.fsVid.pause();  D.fsVid.src='';  D.fsVid.removeAttribute('src');  D.fsVid.style.display='none'; }
  _spin(false);
}

function _spin(on) { if (D.spinner) D.spinner.style.display = on ? 'flex' : 'none'; }

function _scrub(cur, dur) {
  if (!dur) return;
  if (D.osdCur)  D.osdCur.textContent  = _fmt(cur);
  if (D.osdDur)  D.osdDur.textContent  = _fmt(dur);
  if (D.osdFill) D.osdFill.style.width = Math.min(100, cur/dur*100) + '%';
  if (S.activeItem) {
    S.history[S.activeItem._id] = {
      t: cur,
      d: dur,
      ts: Date.now(),
      id: S.activeItem._id,
      name: S.activeItem.name || S.activeItem.title || 'In Progress',
      poster: S.activeItem.stream_icon || S.activeItem.cover || S.activeItem.poster || '',
      url: S.activeItem.url || '',
      type: S.activeItem.type || (S.activeItem.series_id ? 'series' : 'movie'),
      item: S.activeItem
    };
    saveHist();
  }
}
function _fmt(s) { s=Math.floor(s); return (s<3600 ? '' : Math.floor(s/3600)+':')+(Math.floor((s%3600)/60)<10?'0':'')+Math.floor((s%3600)/60)+':'+(s%60<10?'0':'')+(s%60); }

// ── TMDB POSTER RESOLVER & CACHE ───────────────────────────────────────────
var _tmdbCache = {};
function _cleanTitle(t) {
  if (!t) return '';
  return String(t)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/-[A-Za-z0-9]+$/g, '')
    .replace(/\b(19\d\d|20\d\d)\b/g, '')
    .replace(/\b(1080p|720p|480p|4k|uhd|fhd|hd|hevc|x265|x264|h264|h265|bluray|web-?dl|webrip|dvdrip|remux|multi|vostfr|vf|en|ar|fr|es|de|ita|ac3|dts|aac|atmos)\b/gi, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _resolveTmdbPoster(item, imgEl) {
  if (!item || !imgEl) return;
  var q = _cleanTitle(item.name);
  if (!q) { imgEl.src = 'icon.png'; return; }
  if (_tmdbCache[q]) {
    imgEl.src = _tmdbCache[q];
    item.logo = _tmdbCache[q];
    return;
  }
  var apiKey = (window.localStorage && localStorage.getItem('nidalplayer_tmdb_api_key')) || '';
  if (!apiKey) { imgEl.src = item.logo || 'icon.png'; return; }
  var isTv = item._type === 'series';
  var endpoint = isTv ? 'https://api.themoviedb.org/3/search/tv' : 'https://api.themoviedb.org/3/search/movie';
  var url = endpoint + '?api_key=' + encodeURIComponent(apiKey) + '&query=' + encodeURIComponent(q) + '&include_adult=false';
  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d && d.results && d.results[0] && d.results[0].poster_path) {
        var poster = 'https://image.tmdb.org/t/p/w500' + d.results[0].poster_path;
        _tmdbCache[q] = poster;
        imgEl.src = poster;
        item.logo = poster;
      } else {
        imgEl.src = 'icon.png';
      }
    }).catch(function(){ imgEl.src = 'icon.png'; });
}

window._onPosterError = function(imgEl, id) {
  var item = S.movies.find(function(x){ return x._id === id; }) ||
             S.series.find(function(x){ return x._id === id; });
  if (item) {
    _resolveTmdbPoster(item, imgEl);
  } else {
    imgEl.src = 'icon.png';
  }
};

// ── XTREAM DATA LOADER ─────────────────────────────────────────────────────
function _json(url, ms) {
  return new Promise(function(res, rej) {
    var t = setTimeout(function(){ rej(new Error('timeout')); }, ms||15000);
    fetch(url)
      .then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(res)
      .catch(function(e){ clearTimeout(t); rej(e); });
  });
}

function syncPlaylist(pl, cb) {
  if (!pl) return;
  S.isSyncing = true;
  _updateStatus();
  toast(t('syncing'));
  logTV('syncPlaylist started for ' + pl.name);

  if (D.topSync) D.topSync.innerHTML = '<span style="animation: spin 1s linear infinite; display:inline-block;">↻</span> SYNCING...';

  var b = pl.server.replace(/\/+$/,'').replace(/^[A-Za-z]+:\/\//, function(m){ return m.toLowerCase(); });
  var u = encodeURIComponent(pl.user);
  var p = encodeURIComponent(pl.pass);
  var api = b+'/player_api.php?username='+u+'&password='+p;

  function mapCats(arr, map) {
    (arr||[]).forEach(function(c){
      var id = String(c.category_id||c.id||'');
      map[id] = c.category_name||c.name||id;
    });
    return map;
  }

  var lm={}, mm={}, sm={};

  // 1. Fetch user_info for expiration date and categories concurrently
  Promise.all([
    _json(api, 15000).then(function(data){
      if (data && data.user_info) {
        var exp = data.user_info.exp_date;
        if (exp && exp !== 'null' && exp !== '0') {
          var expTs = parseInt(exp, 10);
          var expDate = (!isNaN(expTs) && expTs > 0) ? new Date(expTs * 1000) : new Date(exp);
          if (!isNaN(expDate.getTime())) {
            var daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            pl.expDate = expDate.toLocaleDateString();
            pl.expDays = daysLeft;
            pl.expTs = expDate.getTime();
          }
        } else {
          pl.expDate = 'Unlimited';
          pl.expDays = 9999;
        }
        savePl();
      }
    }).catch(function(e){ logTV('user_info fetch error', e ? e.message : e); }),
    _json(api+'&action=get_live_categories',15000).then(function(d){ mapCats(d,lm); }).catch(function(){}),
    _json(api+'&action=get_vod_categories',15000).then(function(d){  mapCats(d,mm); }).catch(function(){}),
    _json(api+'&action=get_series_categories',15000).then(function(d){ mapCats(d,sm); }).catch(function(){})
  ]).then(function() {
    return Promise.all([
      _json(api+'&action=get_live_streams',60000).then(function(d){
        S.liveCats=['ALL','FAVORITES'];
        var seen={};
        S.live=(d||[]).map(function(x,i){
          var cid=String(x.category_id||'');
          var grp=lm[cid]||x.category_name||'General';
          if(!seen[grp]){seen[grp]=1;S.liveCats.push(grp);}
          var sid=x.stream_id||x.id;
          return { _id:String(sid), _type:'live', num:i+1,
            name:x.name||'Channel', logo:x.stream_icon||'', grp:grp,
            url:b+'/live/'+u+'/'+p+'/'+sid+'.ts',
            hls:b+'/live/'+u+'/'+p+'/'+sid+'.m3u8' };
        });
      }).catch(function(e){ logTV('get_live_streams error', e ? e.message : e); }),

      _json(api+'&action=get_vod_streams',60000).then(function(d){
        S.movieCats=['🔥 POPULAR','ALL','FAVORITES'];
        var seen={};
        S.movies=(d||[]).map(function(x){
          var cid=String(x.category_id||'');
          var grp=mm[cid]||x.category_name||'Movie';
          if(!seen[grp]){seen[grp]=1;S.movieCats.push(grp);}
          var sid=x.stream_id||x.id;
          var ext=x.container_extension||'mp4';
          var logoUrl = x.stream_icon || x.cover || x.cover_big || x.movie_image || x.poster || x.poster_path || '';
          return { _id:String(sid), _type:'movie',
            name:x.name||x.title||'Movie', logo:logoUrl,
            grp:grp, rating:x.rating||'7', year:x.year||'',
            url:b+'/movie/'+u+'/'+p+'/'+sid+'.'+ext };
        });
      }).catch(function(e){ logTV('get_vod_streams error', e ? e.message : e); }),

      _json(api+'&action=get_series',60000).then(function(d){
        S.seriesCats=['🔥 POPULAR','ALL','FAVORITES'];
        var seen={};
        S.series=(d||[]).map(function(x){
          var cid=String(x.category_id||'');
          var grp=sm[cid]||x.category_name||'Series';
          if(!seen[grp]){seen[grp]=1;S.seriesCats.push(grp);}
          var logoUrl = x.cover || x.cover_big || x.stream_icon || x.poster || '';
          return { _id:String(x.series_id||x.id), _type:'series',
            name:x.name||x.title||'Series', logo:logoUrl,
            grp:grp, rating:x.rating||'8' };
        });
      }).catch(function(e){ logTV('get_series error', e ? e.message : e); })
    ]);
  }).then(function(){
    S.isSyncing = false;
    if (D.topSync) D.topSync.innerHTML = '<svg viewBox="0 0 24 24" class="svg-icon"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/></svg><span>SYNC</span>';
    _updateStatus();
    _updateCounts();
    logTV('Sync complete', { channels: S.live.length, movies: S.movies.length, series: S.series.length });
    toast('✓ ' + t('sync_done') + ' • ' + S.live.length + ' Channels, ' + S.movies.length + ' Movies, ' + S.series.length + ' Series');
    if (S.view==='live')   _renderLive();
    if (S.view==='movies') _renderMovies();
    if (S.view==='series') _renderSeries();
    if (cb) cb();
    _pushRemote();
  }).catch(function(err){
    S.isSyncing = false;
    if (D.topSync) D.topSync.innerHTML = '<svg viewBox="0 0 24 24" class="svg-icon"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/></svg><span>SYNC</span>';
    _updateStatus();
    logTV('syncPlaylist overall error', err ? err.message : err);
    toast('Sync error: ' + (err ? err.message : 'Timeout'));
  });
}

// ── VIEW SWITCHING ─────────────────────────────────────────────────────────
function showView(name) {
  S.view = name;
  window.scrollTo(0,0);
  ['viewHome','viewLive','viewMovies','viewSeries','viewFavorites','viewSettings'].forEach(function(id){
    var el=document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  if (D.topBar) D.topBar.classList[name==='home'?'add':'remove']('hidden');

  logTV('showView: ' + name);

  if (name==='home') {
    stopAll();
    document.getElementById('viewHome').classList.remove('hidden');
    _updateStatus(); _updateCounts();
    setTimeout(function(){ focus(document.getElementById('cardLive')); }, 40);
  } else if (name==='live') {
    document.getElementById('viewLive').classList.remove('hidden');
    _renderLive();
    setTimeout(function(){
      var first = document.querySelector('#liveCatsList .focusable') || document.querySelector('#liveChannelsList .focusable');
      if (first) focus(first);
    }, 40);
  } else if (name==='movies') {
    document.getElementById('viewMovies').classList.remove('hidden');
    _renderMovies();
    setTimeout(function(){
      var first = document.querySelector('#moviesCatsList .focusable') || document.querySelector('#moviesGridList .focusable');
      if (first) focus(first);
    }, 40);
  } else if (name==='series') {
    document.getElementById('viewSeries').classList.remove('hidden');
    _renderSeries();
    setTimeout(function(){
      var first = document.querySelector('#seriesCatsList .focusable') || document.querySelector('#seriesGridList .focusable');
      if (first) focus(first);
    }, 40);
  } else if (name==='favorites') {
    document.getElementById('viewFavorites').classList.remove('hidden');
    _renderFavorites();
    setTimeout(function(){
      var first = document.querySelector('#favsGridList .focusable') || document.querySelector('#favsTabsList .focusable');
      if (first) focus(first);
    }, 40);
  } else if (name==='settings') {
    document.getElementById('viewSettings').classList.remove('hidden');
    _renderSettings();
    setTimeout(function(){
      var btn = document.getElementById('btnOpenAddPlaylist');
      if (btn) focus(btn);
    }, 40);
  }
  if (D.topPageTitle) D.topPageTitle.textContent = (t('nav_' + name) || name).toUpperCase();
}

// ── STATUS / COUNTS ────────────────────────────────────────────────────────
function _updateStatus() {
  var pl = S.activePl;
  var text, cls;
  if (S.isSyncing) {
    text = t('syncing'); cls = 'syncing';
  } else if (pl && (S.live.length || S.movies.length || S.series.length)) {
    text = t('ready') + (pl.name ? ' (' + pl.name + ')' : '');
    cls = 'ready';
  } else if (pl) {
    text = t('ready'); cls = 'ready';
  } else {
    text = t('no_pl'); cls = '';
  }
  if (D.statusText)  D.statusText.textContent  = text;
  if (D.statusDot)   D.statusDot.className     = 'pill-dot ' + cls;

  // Expiration Pill
  var expPill = document.getElementById('homeExpPill');
  var expText = document.getElementById('homeExpText');
  if (expPill && expText) {
    if (pl && (pl.expDays !== undefined || pl.expDate)) {
      expPill.style.display = 'inline-flex';
      if (pl.expDays === 9999 || pl.expDate === 'Unlimited') {
        expText.textContent = t('exp_unlimited');
      } else if (typeof pl.expDays === 'number') {
        expText.textContent = (pl.expDays > 0 ? pl.expDays + ' ' + t('days_left') : t('expired')) + (pl.expDate ? ' (' + pl.expDate + ')' : '');
      } else if (pl.expDate) {
        expText.textContent = pl.expDate;
      }
    } else {
      expPill.style.display = 'none';
    }
  }

  var mediaCards = [document.getElementById('cardLive'), document.getElementById('cardSeries'), document.getElementById('cardMovies')];
  mediaCards.forEach(function(c){
    if (c) {
      if (S.isSyncing && !S.live.length && !S.movies.length && !S.series.length) {
        c.style.opacity = '0.4';
        c.style.filter = 'grayscale(0.8)';
      } else {
        c.style.opacity = '1';
        c.style.filter = 'none';
      }
    }
  });
}
function _updateCounts() {
  var pl = S.activePl;
  if (D.plName)    D.plName.textContent    = pl ? pl.name : (t('no_playlist_name') || 'No Playlist');
  if (D.badgeLive) D.badgeLive.textContent = S.live.length + ' ' + (t('channels_badge') || 'CHANNELS');
  if (D.badgeMov)  D.badgeMov.textContent  = S.movies.length + ' ' + (t('movies_badge') || 'MOVIES');
  if (D.badgeSer)  D.badgeSer.textContent  = S.series.length + ' ' + (t('shows_badge') || 'SHOWS');
  if (D.badgeFav)  D.badgeFav.textContent  = Object.keys(S.favs).length + ' ' + (t('saved_badge') || 'SAVED');
}

// ── LIVE TV ────────────────────────────────────────────────────────────────
function _renderLive() {
  if (!D.liveCats || !D.liveChs) return;
  D.liveCats.innerHTML = '';
  var frag = document.createDocumentFragment();
  S.liveCats.forEach(function(cat) {
    var btn = _catBtn(cat, S.selCat.live===cat, function(){
      S.selCat.live = cat;
      _renderLiveChs();
      D.liveCats.querySelectorAll('.tv-cat-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
    frag.appendChild(btn);
  });
  D.liveCats.appendChild(frag);
  _renderLiveChs();
  setTimeout(function(){
    var a = D.liveCats.querySelector('.tv-cat-btn.active') || D.liveCats.firstElementChild;
    if (a) focus(a);
  }, 40);
}

function _renderLiveChs() {
  if (!D.liveChs) return;
  D.liveChs.innerHTML = '';
  var cat = S.selCat.live;
  if (D.liveCatTitle) D.liveCatTitle.textContent = cat==='ALL' ? t('all_ch') : cat==='FAVORITES' ? ('★ ' + t('favorites')) : cat;

  var items = _filter(S.live, cat);
  var frag  = document.createDocumentFragment();
  items.slice(0, 60).forEach(function(ch) {
    var row = document.createElement('div');
    row.className = 'tv-channel-row focusable' + (S.activeCh && S.activeCh._id===ch._id ? ' active' : '');
    row.tabIndex = 0;
    row.dataset.id = ch._id;
    var init = (ch.name||'?').slice(0,2).toUpperCase();
    row.innerHTML =
      '<div class="ch-num">'+ch.num+'</div>'+
      '<div class="ch-logo-wrap">'+
        (ch.logo
          ? '<img class="ch-logo" src="'+_esc(ch.logo)+'" onerror="this.outerHTML=\'<div class=\\\'ch-badge-fallback\\\'>'+_esc(init)+'</div>\'" alt="">'
          : '<div class="ch-badge-fallback">'+_esc(init)+'</div>')+
      '</div>'+
      '<div class="ch-details"><div class="ch-name">'+_esc(ch.name)+'</div><div class="ch-epg">Live &bull; '+_esc(ch.grp)+'</div></div>'+
      (S.favs[ch._id] ? '<span class="ch-fav-icon">★</span>' : '');
    row.onclick = function(){
      if (S.activeCh && S.activeCh._id===ch._id) { _openFs(ch, 0); }
      else { _previewCh(ch); }
    };
    frag.appendChild(row);
  });
  D.liveChs.appendChild(frag);

  if (items.length && !S.activeCh) _previewCh(items[0]);
}

function getPreviewRect() {
  var box = document.getElementById('tvLivePreviewBox');
  if (box) {
    var r = box.getBoundingClientRect();
    var scaleX = 1920 / (window.innerWidth || 1920);
    var scaleY = 1080 / (window.innerHeight || 1080);
    var x = Math.round(r.left * scaleX);
    var y = Math.round(r.top * scaleY);
    var w = Math.round(r.width * scaleX);
    var h = Math.round(r.height * scaleY);
    if (w > 100 && h > 100) {
      return { x: x, y: y, w: w, h: h };
    }
  }
  return { x: 1128, y: 100, w: 764, h: 440 };
}

var _previewTimer = null;
function _previewCh(ch) {
  if (!ch) return;
  S.activeCh  = ch;
  S.activeItem= ch;
  if (D.liveChs) D.liveChs.querySelectorAll('.tv-channel-row').forEach(function(r){
    r.classList.toggle('active', r.dataset.id===ch._id);
  });
  if (D.prevTitle) D.prevTitle.textContent = ch.name;
  if (D.prevGrp)   D.prevGrp.textContent   = ch.grp;
  if (D.prevLogo)  { D.prevLogo.src = ch.logo||'icon.png'; D.prevLogo.onerror=function(){ this.src='icon.png'; }; }

  if (_previewTimer) clearTimeout(_previewTimer);
  _previewTimer = setTimeout(function() {
    var rect = getPreviewRect();
    var url = ch.url || ch.hls || '';
    logTV('_previewCh starting for ' + ch.name, { url: url, rect: rect });
    AV.play(url, rect, true);
  }, 220);
}

function _switchCh(delta) {
  var list = _filter(S.live, S.selCat.live);
  if (!list.length) return;
  var idx = list.findIndex(function(x){ return x._id===(S.activeCh ? S.activeCh._id : ''); });
  if (idx<0) idx=0;
  var next = list[(idx+delta+list.length)%list.length];
  _openFs(next, 0);
}

// ── MOVIES ─────────────────────────────────────────────────────────────────
function _renderMovies() {
  if (!D.movieCats) return;
  D.movieCats.innerHTML = '';
  var frag = document.createDocumentFragment();
  S.movieCats.forEach(function(cat){
    var btn = _catBtn(cat, S.selCat.movies===cat, function(){
      S.selCat.movies=cat;
      _renderMovieGrid();
      D.movieCats.querySelectorAll('.tv-cat-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
    frag.appendChild(btn);
  });
  D.movieCats.appendChild(frag);
  _renderMovieGrid();
}
function _openMovieDetail(m) {
  if (!m) return;
  S.activeItem = m;

  var modalEl = document.querySelector('.tv-detail-card');
  if (modalEl) modalEl.classList.add('movie-mode');

  // Completely clear and hide series seasons and episodes
  if (D.detailSeasons) D.detailSeasons.innerHTML = '';
  if (D.detailEps)     D.detailEps.innerHTML = '';
  var serContainer = document.getElementById('detailSeriesContainer');
  if (serContainer) {
    serContainer.classList.add('hidden');
    serContainer.style.setProperty('display', 'none', 'important');
  }

  // Show movie horizontal actions row
  var actionsRow = document.getElementById('movieActionsRow');
  if (actionsRow) {
    actionsRow.classList.remove('hidden');
    actionsRow.style.setProperty('display', 'flex', 'important');
  }

  if (D.detailPoster) {
    D.detailPoster.src = m.logo || 'icon.png';
    D.detailPoster.onerror = function() { window._onPosterError(this, m._id); };
  }
  if (D.detailTitle)  D.detailTitle.textContent = m.name;
  if (D.detailGenre)  D.detailGenre.textContent = m.grp || 'Movie';
  if (D.detailRating) D.detailRating.textContent = '★ ' + (m.rating || '7.5');

  var epCountEl = document.getElementById('detailEpCount');
  if (epCountEl) {
    epCountEl.textContent = m.year ? ('' + m.year) : 'Movie';
    epCountEl.style.display = 'inline-block';
  }

  // Setup Movie Play button
  var playBtn = document.getElementById('btnMoviePlay');
  var playText = document.getElementById('moviePlayText');
  if (playBtn) {
    var hist = S.history[m._id];
    var resumeSec = (hist && hist.t > 10) ? hist.t : 0;
    if (playText) {
      playText.textContent = resumeSec > 0 ? t('resume_movie', { m: Math.round(resumeSec / 60) }) : t('play_movie');
    }
    playBtn.onclick = function() {
      _closeModal();
      _openFs(m, resumeSec);
    };
  }

  // Setup Movie Fav button
  var favBtn = document.getElementById('btnMovieFav');
  var favIcon = document.getElementById('movieFavIcon');
  var favText = document.getElementById('movieFavText');
  function _updateMovieFavState() {
    var isFav = !!S.favs[m._id];
    if (favIcon) favIcon.textContent = isFav ? '★' : '☆';
    if (favText) favText.textContent = isFav ? t('fav_remove_btn') : t('fav_add_btn');
    if (favBtn) favBtn.classList.toggle('active', isFav);
  }
  if (favBtn) {
    _updateMovieFavState();
    favBtn.onclick = function() {
      _toggleFav(m);
      _updateMovieFavState();
      if (S.view === 'favorites') _renderFavorites();
    };
  }

  var closeBtn = document.getElementById('btnMovieClose');
  if (closeBtn) {
    closeBtn.onclick = function() { _closeModal(); };
  }

  if (D.detailPlot) {
    D.detailPlot.textContent = m.plot || (m.grp ? ('Category: ' + m.grp) : 'Watch ' + m.name + ' in high definition.');
    var pl = S.activePl;
    if (pl && pl.server && m._id && !String(m._id).startsWith('custom_')) {
      var b = pl.server.replace(/\/+$/, '');
      var u = encodeURIComponent(pl.user), p = encodeURIComponent(pl.pass);
      _json(b + '/player_api.php?username=' + u + '&password=' + p + '&action=get_vod_info&vod_id=' + m._id, 6000)
      .then(function(res) {
        if (res && res.info) {
          if (res.info.plot && D.detailPlot) D.detailPlot.textContent = res.info.plot;
          if (res.info.rating && D.detailRating) D.detailRating.textContent = '★ ' + res.info.rating;
        }
      }).catch(function() {});
    }
  }

  _openModal('tvDetailModal');
  setTimeout(function() {
    if (playBtn) focus(playBtn);
  }, 50);
}

function _renderMovieGrid() {
  if (!D.movieGrid) return;
  D.movieGrid.innerHTML='';
  var cat = S.selCat.movies || '🔥 POPULAR';
  if (D.movieCatTitle) {
    var isPop = (cat === '🔥 POPULAR' || cat === 'POPULAR');
    D.movieCatTitle.textContent = isPop ? t('pop_now') : (cat === 'ALL' ? (t('all_mv') || 'ALL MOVIES') : (cat === 'FAVORITES' ? ('★ ' + t('favorites')) : cat));
  }
  var items = _filter(S.movies, cat);
  var frag = document.createDocumentFragment();
  items.slice(0,48).forEach(function(m){
    var c = _posterCard(m, function(){
      _openMovieDetail(m);
    });
    frag.appendChild(c);
  });
  D.movieGrid.appendChild(frag);
}

// ── SERIES ─────────────────────────────────────────────────────────────────
function _renderSeries() {
  if (!D.serCats) return;
  D.serCats.innerHTML='';
  var frag=document.createDocumentFragment();
  S.seriesCats.forEach(function(cat){
    var btn=_catBtn(cat,S.selCat.series===cat,function(){
      S.selCat.series=cat;
      _renderSeriesGrid();
      D.serCats.querySelectorAll('.tv-cat-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
    frag.appendChild(btn);
  });
  D.serCats.appendChild(frag);
  _renderSeriesGrid();
}
function _renderSeriesGrid() {
  if (!D.serGrid) return;
  D.serGrid.innerHTML='';
  var cat = S.selCat.series || '🔥 POPULAR';
  if (D.serCatTitle) {
    var isPop = (cat === '🔥 POPULAR' || cat === 'POPULAR');
    D.serCatTitle.textContent = isPop ? t('pop_now') : (cat === 'ALL' ? (t('all_sr') || 'ALL TV SHOWS') : (cat === 'FAVORITES' ? ('★ ' + t('favorites')) : cat));
  }
  var items=_filter(S.series,cat);
  var frag=document.createDocumentFragment();
  items.slice(0,48).forEach(function(s){
    var c=_posterCard(s,function(){ _openSeriesDetail(s); });
    frag.appendChild(c);
  });
  D.serGrid.appendChild(frag);
}

function _updateDetailFavBtn(item) {
  var btn = document.getElementById('btnDetailFav');
  var txt = document.getElementById('detailFavText');
  var ico = document.getElementById('detailFavIcon');
  if (!btn || !item) return;
  var isFav = !!S.favs[item._id];
  if (txt) txt.textContent = isFav ? t('fav_remove_btn') : t('fav_add_btn');
  if (ico) ico.textContent = isFav ? '★' : '☆';
  btn.classList.toggle('active', isFav);
}

function _openSeriesDetail(s) {
  S.activeItem = s;
  var pl = S.activePl; if (!pl) return;
  var srvBase = pl.server.replace(/\/+$/, '');
  var u = encodeURIComponent(pl.user), p = encodeURIComponent(pl.pass);

  var modalEl = document.querySelector('.tv-detail-card');
  if (modalEl) modalEl.classList.remove('movie-mode');
  var actionsRow = document.getElementById('movieActionsRow');
  if (actionsRow) { actionsRow.classList.add('hidden'); actionsRow.style.setProperty('display', 'none', 'important'); }
  var serContainer = document.getElementById('detailSeriesContainer');
  if (serContainer) {
    serContainer.classList.remove('hidden');
    serContainer.style.setProperty('display', 'flex', 'important');
  }

  if (D.detailPoster) {
    D.detailPoster.src = s.logo || 'icon.png';
    D.detailPoster.onerror = function() { window._onPosterError(this, s._id); };
  }
  if (D.detailTitle)  D.detailTitle.textContent = s.name;
  if (D.detailGenre)  D.detailGenre.textContent = s.grp;
  if (D.detailRating) D.detailRating.textContent = '★ ' + (s.rating || '8.5');

  var favBtn = document.getElementById('btnDetailFav');
  if (favBtn) {
    _updateDetailFavBtn(s);
    favBtn.onclick = function() {
      _toggleFav(s);
      _updateDetailFavBtn(s);
    };
  }
  var closeBtn = document.getElementById('btnDetailClose');
  if (closeBtn) {
    closeBtn.onclick = function() { _closeModal(); };
  }

  _json(srvBase + '/player_api.php?username=' + u + '&password=' + p + '&action=get_series_info&series_id=' + s._id, 10000)
  .then(function(info) {
    var root = (info && info.data && typeof info.data === 'object' && (info.data.episodes || info.data.seasons || info.data.info)) ? info.data : info;
    if (D.detailPlot) D.detailPlot.textContent = (root && root.info && root.info.plot) || (root && root.info && root.info.description) || 'Browse available episodes below.';

    var rawEps = (root && root.episodes) || {};
    var seasonsMap = {}; // seasonNum -> array of episodes

    if (Array.isArray(rawEps)) {
      // Flat array of episodes: group by ep.season or ep.season_number
      rawEps.forEach(function(ep) {
        if (!ep || typeof ep !== 'object') return;
        var sn = Number(ep.season || ep.season_number || ep.season_num || (ep.info && (ep.info.season || ep.info.season_number)) || 1);
        if (!Number.isFinite(sn) || sn < 0) sn = 1;
        if (!seasonsMap[sn]) seasonsMap[sn] = [];
        seasonsMap[sn].push(ep);
      });
    } else if (rawEps && typeof rawEps === 'object') {
      // Object keyed by season numbers: {"1": [...], "2": [...]}
      Object.keys(rawEps).forEach(function(key) {
        var group = rawEps[key];
        var epList = Array.isArray(group) ? group : (group && typeof group === 'object' ? Object.values(group) : []);
        epList.forEach(function(ep) {
          if (!ep || typeof ep !== 'object') return;
          var sn = Number(ep.season || ep.season_number || ep.season_num || (ep.info && (ep.info.season || ep.info.season_number)) || key || 1);
          if (!Number.isFinite(sn) || sn < 0) sn = Number(key) || 1;
          if (!seasonsMap[sn]) seasonsMap[sn] = [];
          seasonsMap[sn].push(ep);
        });
      });
    }

    // Also inspect declared seasons from root.seasons
    var declaredSeasons = Array.isArray(root && root.seasons) ? root.seasons : (root && root.seasons && typeof root.seasons === 'object' ? Object.values(root.seasons) : []);
    declaredSeasons.forEach(function(ds) {
      var sn = Number(ds.season_number !== undefined ? ds.season_number : (ds.season || ds.num || ds.id));
      if (Number.isFinite(sn) && sn >= 0 && !seasonsMap[sn]) {
        // Check if rawEps has it under string key
        if (rawEps && rawEps[String(sn)]) {
          var g = rawEps[String(sn)];
          seasonsMap[sn] = Array.isArray(g) ? g : Object.values(g || {});
        } else if (ds.id && rawEps && rawEps[String(ds.id)]) {
          var g2 = rawEps[String(ds.id)];
          seasonsMap[sn] = Array.isArray(g2) ? g2 : Object.values(g2 || {});
        }
      }
    });

    // Check for sibling seasons in S.series if single season found (e.g. "Show S01", "Show S02" in playlist)
    var seasonNums = Object.keys(seasonsMap).map(Number).filter(Number.isFinite);
    var siblingSeries = [];
    if (seasonNums.length <= 1 && S.series && S.series.length) {
      var cleanTitle = (s.name || '').replace(/\s*[-_:]?\s*(s(aison|eason)?\s*\d+|s\d+|part\s*\d+|\d+\s*(ere|eme|st|nd|rd|th)?\s*saison)/i, '').trim().toLowerCase();
      if (cleanTitle.length > 2) {
        siblingSeries = S.series.filter(function(other) {
          var otherClean = (other.name || '').replace(/\s*[-_:]?\s*(s(aison|eason)?\s*\d+|s\d+|part\s*\d+|\d+\s*(ere|eme|st|nd|rd|th)?\s*saison)/i, '').trim().toLowerCase();
          return otherClean === cleanTitle;
        });
      }
    }

    if (D.detailSeasons) D.detailSeasons.innerHTML = '';
    if (D.detailEps)     D.detailEps.innerHTML = '';

    if (siblingSeries.length > 1) {
      // Multi-season show split across multiple playlist entries
      siblingSeries.sort(function(a, b) {
        var ma = (a.name || '').match(/s(?:aison|eason)?\s*(\d+)/i) || (a.name || '').match(/s(\d+)/i);
        var mb = (b.name || '').match(/s(?:aison|eason)?\s*(\d+)/i) || (b.name || '').match(/s(\d+)/i);
        var na = ma ? parseInt(ma[1], 10) : 1;
        var nb = mb ? parseInt(mb[1], 10) : 1;
        return na - nb;
      });

      siblingSeries.forEach(function(sib, idx) {
        var mMatch = (sib.name || '').match(/s(?:aison|eason)?\s*(\d+)/i) || (sib.name || '').match(/s(\d+)/i);
        var sNum = mMatch ? parseInt(mMatch[1], 10) : (idx + 1);
        var btn = document.createElement('button');
        btn.className = 'tv-btn-pill focusable' + (sib._id === s._id ? ' active' : '');
        btn.tabIndex = 0;
        btn.textContent = t('seasons') + ' ' + sNum;
        function _loadSiblingSeason() {
          D.detailSeasons.querySelectorAll('.tv-btn-pill').forEach(function(pill) { pill.classList.remove('active'); });
          btn.classList.add('active');
          if (sib._id === s._id && seasonNums.length) {
            _renderEps(seasonsMap[seasonNums[0]], srvBase, pl.user, pl.pass, sNum);
          } else {
            _json(srvBase + '/player_api.php?username=' + u + '&password=' + p + '&action=get_series_info&series_id=' + sib._id, 10000)
            .then(function(sibInfo) {
              var sRoot = (sibInfo && sibInfo.data) ? sibInfo.data : sibInfo;
              var sEps = (sRoot && sRoot.episodes) || {};
              var sList = Array.isArray(sEps) ? sEps : Object.values(sEps)[0] || [];
              _renderEps(sList, srvBase, pl.user, pl.pass, sNum);
            }).catch(function() {});
          }
        }
        btn.onclick = _loadSiblingSeason;
        btn.onfocus = _loadSiblingSeason;
        if (D.detailSeasons) D.detailSeasons.appendChild(btn);
      });

      // Render initial season
      if (seasonNums.length) {
        _renderEps(seasonsMap[seasonNums[0]], srvBase, pl.user, pl.pass, 1);
      }
    } else {
      // Standard multi-season show inside single series info
      seasonNums.sort(function(a, b) { return a - b; });
      if (!seasonNums.length) seasonNums = [1];

      seasonNums.forEach(function(sn, idx) {
        var rawSeasonEps = seasonsMap[sn] || [];
        var epCount = rawSeasonEps.length;
        var btn = document.createElement('button');
        btn.className = 'tv-btn-pill focusable' + (idx === 0 ? ' active' : '');
        btn.tabIndex = 0;
        btn.textContent = (sn === 0 ? 'Specials' : (t('seasons') + ' ' + sn)) + (epCount > 0 ? (' (' + epCount + ')') : '');
        function _switchSeason() {
          D.detailSeasons.querySelectorAll('.tv-btn-pill').forEach(function(pill) { pill.classList.remove('active'); });
          btn.classList.add('active');
          _renderEps(seasonsMap[sn] || [], srvBase, pl.user, pl.pass, sn);
        }
        btn.onclick = _switchSeason;
        btn.onfocus = _switchSeason;
        if (D.detailSeasons) D.detailSeasons.appendChild(btn);
      });

      if (seasonNums.length) {
        _renderEps(seasonsMap[seasonNums[0]] || [], srvBase, pl.user, pl.pass, seasonNums[0]);
      }
    }

    _openModal('tvDetailModal');
  }).catch(function() { toast('Could not load series info'); });
}

function _renderEps(list, base, user, pass, seasonNum) {
  if (!D.detailEps) return;
  D.detailEps.innerHTML = '';

  var rawList = Array.isArray(list) ? list : (list && typeof list === 'object' ? Object.values(list) : []);

  var epCountEl = document.getElementById('detailEpCount');
  if (epCountEl) epCountEl.textContent = rawList.length + ' Episodes';

  S.seriesEps = rawList.map(function(ep, idx) {
    var ext = ep.container_extension || 'mp4';
    var epNum = ep.episode_num !== undefined ? ep.episode_num : (idx + 1);
    var rawTitle = ep.title || '';
    var epTitle = rawTitle.trim() || ('Episode ' + epNum);

    // Parse duration: can be info.duration_secs (integer) or info.duration (string e.g. "00:58:48")
    var durText = '';
    if (ep.info) {
      if (ep.info.duration_secs && parseInt(ep.info.duration_secs, 10) > 0) {
        durText = Math.round(parseInt(ep.info.duration_secs, 10) / 60) + ' min';
      } else if (typeof ep.info.duration === 'string' && ep.info.duration.length) {
        var parts = ep.info.duration.split(':');
        if (parts.length >= 2) {
          var h = parseInt(parts[0], 10) || 0;
          var m = parseInt(parts[1], 10) || 0;
          durText = (h > 0 ? (h * 60 + m) : m) + ' min';
        }
      }
    }

    return {
      _id: String(ep.id),
      _type: 'series',
      seriesId: S.activeItem ? S.activeItem._id : '',
      season: seasonNum || '',
      ep_num: epNum,
      ep_title: epTitle,
      durationText: durText,
      name: (S.activeItem ? S.activeItem.name + ' – ' : '') + 'S' + (seasonNum || '1') + 'E' + epNum + ': ' + epTitle,
      logo: S.activeItem ? S.activeItem.logo : '',
      url: base + '/series/' + encodeURIComponent(user) + '/' + encodeURIComponent(pass) + '/' + ep.id + '.' + ext
    };
  });

  var frag = document.createDocumentFragment();
  S.seriesEps.forEach(function(ep, idx) {
    var row = document.createElement('div');
    row.className = 'detail-ep-row focusable';
    row.tabIndex = 0;

    var hist = S.history[ep._id];
    var isWatched = hist && hist.d > 0 && (hist.t / hist.d > 0.9);
    var progPct = hist && hist.d > 0 ? Math.min(100, Math.round((hist.t / hist.d) * 100)) : 0;

    var badgeHtml = isWatched ? '<span class="ep-tag watched">✓ WATCHED</span>' : (progPct > 5 ? '<span class="ep-tag in-prog">' + progPct + '%</span>' : '');
    var durHtml = ep.durationText ? '<span class="ep-tag duration">⏱ ' + _esc(ep.durationText) + '</span>' : '';
    var progBarHtml = (progPct > 0 && !isWatched) ? '<div class="ep-prog-track"><div class="ep-prog-fill" style="width:' + progPct + '%;"></div></div>' : '';

    row.innerHTML =
      '<div class="ep-row-left">' +
        '<div class="ep-num-pill">EP ' + (ep.ep_num || (idx + 1)) + '</div>' +
        '<div class="ep-meta">' +
          '<div class="ep-title">' + _esc(ep.ep_title) + '</div>' +
          '<div class="ep-badges">' + durHtml + badgeHtml + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ep-play-btn">▶ PLAY</div>' +
      progBarHtml;

    row.onclick = function() {
      _closeModal();
      S.epIdx = idx;
      _openFs(ep, (hist && !isWatched) ? hist.t : 0);
    };
    frag.appendChild(row);
  });
  D.detailEps.appendChild(frag);
}

function _nextEp() {
  if (!S.seriesEps.length) return;
  if (S.epIdx < S.seriesEps.length-1) { S.epIdx++; toast('▶ '+S.seriesEps[S.epIdx].name); _openFs(S.seriesEps[S.epIdx],0); }
  else toast(t('ep_last'));
}
function _prevEp() {
  if (!S.seriesEps.length) return;
  if (S.epIdx > 0) { S.epIdx--; toast('◀ '+S.seriesEps[S.epIdx].name); _openFs(S.seriesEps[S.epIdx],0); }
  else toast(t('ep_first'));
}

// ── FULLSCREEN ─────────────────────────────────────────────────────────────
function _openFs(item, startSec) {
  if (!item) return;
  S.activeItem=item;
  S.isFs=true;

  logTV('_openFs fullscreen open', { name: item.name, type: item._type, url: item.url });

  var streamUrl = (item.url || item.hls || '').trim().replace(/^[A-Za-z]+:\/\//, function(m){ return m.toLowerCase(); });

  // 1. Android Native Hardware ExoPlayer: Seamless Fullscreen for Live TV
  if (window.AndroidBridge) {
    if (item._type === 'live' && window.AndroidBridge.expandNativePreviewToFullscreen) {
      logTV('_openFs: expanding Live TV preview to fullscreen seamlessly');
      if (AV._url !== streamUrl && window.AndroidBridge.playNativePreview) {
        var rect = getPreviewRect();
        AV._url = streamUrl;
        AV._state = 'PLAYING';
        window.AndroidBridge.playNativePreview(streamUrl, rect.x, rect.y, rect.w, rect.h, 1920, 1080);
      }
      if (window.AndroidBridge.setPreviewInfo) {
        window.AndroidBridge.setPreviewInfo(item.name || 'Live Channel', item.grp || 'Live TV');
      }
      window.AndroidBridge.expandNativePreviewToFullscreen(item.name || 'Live Channel', item.grp || 'Live TV');
      return;
    }
    if (window.AndroidBridge.playNativeMedia) {
      var sId = item.seriesId || (item._type === 'series' ? item._id : '');
      var sn = item.season || '';
      var ep = item.ep_num || item.episodeNumber || '';
      window.AndroidBridge.playNativeMedia(streamUrl, item.name, item._id, item._type, sId, sn, ep, startSec || 0);
      return;
    }
  }

  // Hide all screens so hardware video layer is completely visible
  ['viewHome','viewLive','viewMovies','viewSeries','viewSettings'].forEach(function(id){
    var el=document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  if (D.topBar) D.topBar.classList.add('hidden');

  if (D.fsPlayer) D.fsPlayer.classList.remove('hidden');
  if (D.osdTitle)    D.osdTitle.textContent    = item.name;
  if (D.osdSubtitle) D.osdSubtitle.textContent = item._type==='live'?'LIVE • HD':(item._type==='series'?'SERIES • HD':'MOVIE • HD');
  if (D.osdLogo)     { D.osdLogo.src=item.logo||'icon.png'; D.osdLogo.onerror=function(){ this.src='icon.png'; }; }
  if (D.osdProgWrap) D.osdProgWrap.style.display = item._type==='live'?'none':'flex';
  if (D.osdPrev) D.osdPrev.style.display = item._type==='series'?'flex':'none';
  if (D.osdNext) D.osdNext.style.display = item._type==='series'?'flex':'none';

  if (D.prevVid) D.prevVid.style.display='none';

  // If already playing via AVPlay (e.g. from preview), smoothly expand rectangle without reloading stream!
  if (AV.supported() && AV._state === 'PLAYING' && AV._url === streamUrl) {
    logTV('_openFs: expanding existing preview stream to fullscreen without reload');
    try {
      var obj = document.getElementById('avplayObject');
      if (obj) {
        obj.style.left = '0px';
        obj.style.top = '0px';
        obj.style.width = '1920px';
        obj.style.height = '1080px';
        obj.style.zIndex = '5001';
      }
      webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
      webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
    } catch(e) {
      AV.play(streamUrl, FS_RECT, item._type==='live');
    }
  } else {
    AV.play(streamUrl, FS_RECT, item._type==='live');
  }

  _osdShow();
}

function _closeFs() {
  if (!S.isFs) return;
  S.isFs=false;
  logTV('_closeFs called, restoring view: ' + S.view);

  if (D.fsPlayer) D.fsPlayer.classList.add('hidden');
  _spin(false);

  // If using AndroidBridge native ExoPlayer
  if (window.AndroidBridge && window.AndroidBridge.shrinkNativePreview) {
    if (S.view === 'live') {
      logTV('_closeFs: shrinking native ExoPlayer back to preview dock');
      showView('live');
      window.AndroidBridge.shrinkNativePreview();
      var rect = getPreviewRect();
      window.AndroidBridge.updatePreviewBounds(rect.x, rect.y, rect.w, rect.h, 1920, 1080);
    } else {
      window.AndroidBridge.stopNativePreview();
      showView(S.view);
    }
    return;
  }

  // If returning to Live TV and AVPlay is currently playing, shrink rectangle back to preview box without reloading!
  if (S.view === 'live' && AV.supported() && AV._state === 'PLAYING') {
    logTV('_closeFs: shrinking fullscreen stream to preview without reload');
    showView('live');
    var rect = getPreviewRect();
    try {
      var obj = document.getElementById('avplayObject');
      if (obj) {
        obj.style.left = rect.x + 'px';
        obj.style.top = rect.y + 'px';
        obj.style.width = rect.w + 'px';
        obj.style.height = rect.h + 'px';
        obj.style.zIndex = '9999';
      }
      webapis.avplay.setDisplayRect(rect.x, rect.y, rect.w, rect.h);
      webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
    } catch(e){}
  } else {
    AV._teardown();
    _hlsDestroy();
    if (D.fsVid)  { D.fsVid.pause(); D.fsVid.src=''; D.fsVid.style.display='none'; }
    showView(S.view);
  }
}

function _osdShow() {
  if (!D.fsOsd) return;
  D.fsOsd.classList.remove('hidden');
  clearTimeout(S.osdTimer);
  S.osdTimer = setTimeout(function(){ if (D.fsOsd) D.fsOsd.classList.add('hidden'); }, 5000);
}

// ── MODALS ─────────────────────────────────────────────────────────────────
function _openModal(id) {
  S.modal=id;
  var el=document.getElementById(id); if (!el) return;
  el.classList.remove('hidden');
  if (id==='modalQrRemote') { _qr('homeModalQrCode',200); if (D.btnCloseQr) focus(D.btnCloseQr); }
  else if (id==='modalAddPlaylist') {
    if (window.AndroidBridge && window.AndroidBridge.hideTextInput) {
      window.AndroidBridge.hideTextInput();
    }
    var p=document.getElementById('cfgPlName')||D.cfgServer; if(p) focus(p);
  }
  else if (id==='tvDetailModal')   { setTimeout(function(){ var a=document.querySelector('#detailSeasonsList .tv-btn-pill'); if(a) focus(a); },60); }
}
function _closeModal() {
  if (window.AndroidBridge && window.AndroidBridge.hideTextInput) {
    window.AndroidBridge.hideTextInput();
  }
  if (!S.modal) return;
  var prevModal = S.modal;
  var el=document.getElementById(S.modal); if (el) el.classList.add('hidden');
  S.modal=null;

  if (prevModal === 'tvDetailModal') {
    var modalEl = document.querySelector('.tv-detail-card');
    if (modalEl) modalEl.classList.remove('movie-mode');
    var actionsRow = document.getElementById('movieActionsRow');
    if (actionsRow) {
      actionsRow.classList.add('hidden');
      actionsRow.style.setProperty('display', 'none', 'important');
    }
    var serContainer = document.getElementById('detailSeriesContainer');
    if (serContainer) {
      serContainer.classList.add('hidden');
      serContainer.style.setProperty('display', 'none', 'important');
    }
    if (D.detailSeasons) D.detailSeasons.innerHTML = '';
    if (D.detailEps) D.detailEps.innerHTML = '';
  }

  if (prevModal === 'modalAddPlaylist') {
    var btn = document.getElementById('btnOpenAddPlaylist');
    if (btn && btn.offsetParent !== null) focus(btn);
    else {
      var card = document.getElementById('cardLive');
      if (card) focus(card);
    }
  }
}

function _qr(containerId, size) {
  var el=document.getElementById(containerId); if (!el||!window.QRCode) return;
  el.innerHTML='';
  new QRCode(el,{ text:COMPANION+'/tv', width:size, height:size,
    colorDark:'#000', colorLight:'#fff', correctLevel:QRCode.CorrectLevel.M });
}

// ── SETTINGS ───────────────────────────────────────────────────────────────
function _openEditPlaylist(p) {
  S.editingPlId = p ? p.id : null;
  var titleEl = document.getElementById('modalAddPlTitle');
  var btnText = document.getElementById('btnSavePlText');
  var nameInp = document.getElementById('cfgPlName');
  var userInp = document.getElementById('cfgUser');
  var servInp = document.getElementById('cfgServer');
  var passInp = document.getElementById('cfgPass');

  if (titleEl) titleEl.textContent = p ? t('edit_playlist') : t('add_new_playlist');
  if (btnText) btnText.textContent = p ? t('save_changes') : t('save_sync');

  if (nameInp) nameInp.value = p ? p.name : '';
  if (userInp) userInp.value = p ? p.user : '';
  if (servInp) servInp.value = p ? p.server : '';
  if (passInp) passInp.value = p ? p.pass : '';

  _openModal('modalAddPlaylist');
}

function _renderSettings() {
  _qr('settingsQrCode', 150);
  var list = document.getElementById('savedPlaylistsList');
  if (list) {
    list.innerHTML = '';
    if (!S.playlists || !S.playlists.length) {
      list.innerHTML = '<div style="color:var(--text-dim);padding:16px;">No saved playlists. Click above to add one.</div>';
    } else {
      S.playlists.forEach(function(p) {
        var isActive = S.activePl && S.activePl.id === p.id;
        var row = document.createElement('div');
        row.className = 'saved-pl-item' + (isActive ? ' active' : '');
        var expStr = p.expDays ? (p.expDays === 9999 ? t('exp_unlimited') : (p.expDays > 0 ? p.expDays + ' ' + t('days_left') : t('expired'))) : '';
        row.innerHTML =
          '<div>' +
            '<strong style="font-size:17px; color:#fff;">' + _esc(p.name) + '</strong>' +
            (expStr ? ' <span style="color:var(--accent-green);font-size:12px;font-weight:bold;">[' + _esc(expStr) + ']</span>' : '') +
            '<br><small style="color:var(--text-dim); font-size:13px;">' + _esc(p.server) + ' (' + _esc(p.user) + ')</small>' +
          '</div>' +
          '<div class="pl-actions">' +
            (isActive
              ? '<span class="pl-badge-active">' + t('active_badge') + '</span>'
              : '<button class="pl-btn-switch focusable" tabindex="0" data-action="switch">' + t('switch_btn') + '</button>') +
            '<button class="pl-btn-edit focusable" tabindex="0" data-action="edit">' + t('edit_btn') + '</button>' +
            '<button class="pl-btn-delete focusable" tabindex="0" data-action="delete">' + t('delete_btn') + '</button>' +
          '</div>';

        var editBtn = row.querySelector('.pl-btn-edit');
        if (editBtn) {
          editBtn.onclick = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            _openEditPlaylist(p);
          };
        }

        var delBtn = row.querySelector('.pl-btn-delete');
        if (delBtn) {
          delBtn.onclick = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (confirm('Delete playlist "' + p.name + '"?')) {
              S.playlists = S.playlists.filter(function(x) { return x.id !== p.id; });
              if (S.activePl && S.activePl.id === p.id) {
                S.activePl = S.playlists[0] || null;
              }
              savePl();
              toast(t('deleted_pl'));
              _renderSettings();
              _updateCounts();
              _updateStatus();
              _pushRemote();
              if (S.activePl) syncPlaylist(S.activePl);
            }
          };
        }

        var switchBtn = row.querySelector('.pl-btn-switch');
        if (switchBtn) {
          switchBtn.onclick = function(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (!isActive) {
              S.activePl = p;
              savePl();
              _renderSettings();
              _updateCounts();
              _updateStatus();
              _pushRemote();
              toast(t('switched_pl') + ': ' + p.name);
              syncPlaylist(p, function() { showView('live'); });
            }
          };
        }

        list.appendChild(row);
      });
    }
  }

  // Language buttons
  document.querySelectorAll('#langPillsRow .lang-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.lang === S.lang);
    b.onclick = function() {
      applyLang(b.dataset.lang || 'en');
      toast('Language: ' + (b.textContent || b.dataset.lang));
    };
  });
}

// ── FAVORITES HUB (Organized with Live TV, Movies, Series & Progress) ──────────
function _renderFavorites() {
  var tabsContainer = document.getElementById('favsTabsList');
  var gridContainer = document.getElementById('favsGridList');
  var titleEl = document.getElementById('favsCategoryTitle');
  if (!tabsContainer || !gridContainer) return;

  var favLive = S.live.filter(function(x) { return !!S.favsLive[x._id]; });
  var favMovies = S.movies.filter(function(x) { return !!S.favs[x._id]; });
  var favSeries = S.series.filter(function(x) { return !!S.favs[x._id]; });
  var totalFavs = favLive.length + favMovies.length + favSeries.length;

  var tabs = [
    { id: 'ALL', label: t('all_favs') || 'ALL FAVORITES', count: totalFavs },
    { id: 'LIVE', label: t('fav_live') || 'LIVE CHANNELS', count: favLive.length },
    { id: 'MOVIES', label: t('fav_movies') || 'MOVIES', count: favMovies.length },
    { id: 'SERIES', label: t('fav_series') || 'SERIES', count: favSeries.length }
  ];

  tabsContainer.innerHTML = '';
  var tabFrag = document.createDocumentFragment();
  tabs.forEach(function(tab) {
    var btn = document.createElement('button');
    btn.className = 'tv-cat-btn focusable' + ((S.selCat.favs || 'ALL') === tab.id ? ' active' : '');
    btn.tabIndex = 0;
    btn.innerHTML = '<span>' + _esc(tab.label) + '</span><span class="cat-count-pill">' + tab.count + '</span>';
    btn.onclick = function() {
      S.selCat.favs = tab.id;
      tabsContainer.querySelectorAll('.tv-cat-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _renderFavItems();
    };
    tabFrag.appendChild(btn);
  });
  tabsContainer.appendChild(tabFrag);

  function _renderFavItems() {
    gridContainer.innerHTML = '';
    var activeTab = S.selCat.favs || 'ALL';
    if (titleEl) {
      var foundTab = tabs.find(function(x) { return x.id === activeTab; });
      titleEl.textContent = foundTab ? foundTab.label : (t('all_favs') || 'ALL FAVORITES');
    }

    var itemsToShow = [];
    if (activeTab === 'ALL') {
      itemsToShow = [].concat(favLive, favMovies, favSeries);
    } else if (activeTab === 'LIVE') {
      itemsToShow = favLive;
    } else if (activeTab === 'MOVIES') {
      itemsToShow = favMovies;
    } else if (activeTab === 'SERIES') {
      itemsToShow = favSeries;
    }

    if (!itemsToShow.length) {
      gridContainer.innerHTML =
        '<div class="fav-empty-box" style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; min-height:420px; text-align:center; padding:40px;">' +
          '<div class="fav-empty-icon" style="font-size:70px; color:var(--accent-orange); margin-bottom:18px; text-shadow:0 0 35px rgba(255,69,26,0.6);">★</div>' +
          '<div class="fav-empty-title" style="font-size:26px; font-weight:900; color:#fff; margin-bottom:12px;">' + _esc(t('no_favs') || 'NO FAVORITES ADDED') + '</div>' +
          '<div class="fav-empty-desc" style="font-size:16px; color:var(--text-muted); max-width:560px; line-height:1.6;">' +
            _esc(t('no_favs_sub') || 'Click on any movie to add it to your favorites, or press Yellow button on your remote.') +
          '</div>' +
        '</div>';
      return;
    }

    var itemFrag = document.createDocumentFragment();
    itemsToShow.forEach(function(item) {
      var card = _posterCard(item, function() {
        S.activeItem = item;
        if (item._type === 'series') {
          _openSeriesDetail(item);
        } else if (item._type === 'movie' || item._type === 'vod') {
          _openMovieDetail(item);
        } else {
          _openFs(item, 0);
        }
      });
      itemFrag.appendChild(card);
    });
    gridContainer.appendChild(itemFrag);
  }

  _renderFavItems();
}

// ── KEYBOARD / D-PAD & NUMERIC REMOTE ENGINE ──────────────────────────────
function _registerKeys() {
  if (window.tizen && window.tizen.tvinputdevice) {
    [
      '0','1','2','3','4','5','6','7','8','9',
      'ColorF0Red','ColorF1Green','ColorF2Yellow','ColorF3Blue',
      'MediaPlay','MediaPause','MediaPlayPause','MediaStop',
      'MediaTrackNext','MediaTrackPrevious','MediaRewind','MediaFastForward',
      'ChannelUp','ChannelDown'
    ].forEach(function(k){ try{ tizen.tvinputdevice.registerKey(k); }catch(e){} });
  }
}

document.addEventListener('keydown', function(e) {
  var c=e.keyCode, k=e.key||e.keyName||'';
  var isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

  if (isInput) {
    var inp = document.activeElement;

    if (c === 27 || c === 10009 || k === 'XF86Back') {
      e.preventDefault();
      inp.blur();
      if (window.AndroidBridge && window.AndroidBridge.hideTextInput) {
        window.AndroidBridge.hideTextInput();
      }
      var saveBtn = document.getElementById('btnSavePlaylist');
      if (saveBtn && S.modal === 'modalAddPlaylist') focus(saveBtn);
      return;
    }

    if (c === 13 || c === 29443) {
      if (inp.enterKeyHint === 'next' || inp.getAttribute('enterkeyhint') === 'next') {
        e.preventDefault();
        _handleInputEnter(inp);
        return;
      }
    }

    // Allow standard input, typing, backspace, DPAD navigation within virtual keyboard
    return;
  }

  if (k==='ColorF0Red'||c===403)   { e.preventDefault(); if (S.activePl) syncPlaylist(S.activePl); return; }
  if (k==='ColorF1Green'||c===404) { e.preventDefault(); if (S.view==='home') _openModal('modalQrRemote'); else _openSearchModal(); return; }
  if (k==='ColorF2Yellow'||c===405){ e.preventDefault(); _toggleFav(); return; }
  if (k==='ColorF3Blue'||c===406)  { e.preventDefault(); if (S.activePl) syncPlaylist(S.activePl); return; }

  if (S.isFs) {
    _osdShow();
    if (c===27||c===8||c===4||c===10009||k==='XF86Back') { e.preventDefault(); _closeFs(); return; }
    if (c===415||c===19||c===10252||c===32||k==='MediaPlayPause') {
      e.preventDefault();
      if (AV._state==='PLAYING') AV.pause(); else AV.resume();
      return;
    }
    if (c===37||c===412||k==='MediaRewind')       { e.preventDefault(); AV.seekRel(-10); return; }
    if (c===39||c===417||k==='MediaFastForward')  { e.preventDefault(); AV.seekRel(10);  return; }
    if (c===38||c===427||k==='ChannelUp')   {
      e.preventDefault();
      if (S.activeItem&&S.activeItem._type==='live')   _switchCh(-1);
      else if (S.activeItem&&S.activeItem._type==='series') _prevEp();
      return;
    }
    if (c===40||c===428||k==='ChannelDown') {
      e.preventDefault();
      if (S.activeItem&&S.activeItem._type==='live')   _switchCh(1);
      else if (S.activeItem&&S.activeItem._type==='series') _nextEp();
      return;
    }
    if (k==='MediaTrackNext')     { e.preventDefault(); _nextEp(); return; }
    if (k==='MediaTrackPrevious') { e.preventDefault(); _prevEp(); return; }
    return;
  }

  if (c===38) { e.preventDefault(); _nav('UP');    return; }
  if (c===40) { e.preventDefault(); _nav('DOWN');  return; }
  if (c===37) { e.preventDefault(); _nav('LEFT');  return; }
  if (c===39) { e.preventDefault(); _nav('RIGHT'); return; }
  if (c===13||c===29443) { e.preventDefault(); var ae=document.activeElement; if(ae&&ae.click) ae.click(); return; }

  if (c===27 || (c===8 && !isInput) || c===4 || c===10009 || k==='XF86Back') {
    e.preventDefault();
    if (S.modal) _closeModal();
    else if (S.view!=='home') showView('home');
    return;
  }
});

document.addEventListener('focusin', function(e) {
  var isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (isInput && window.AndroidBridge && window.AndroidBridge.setInputActive) {
    window.AndroidBridge.setInputActive(true);
  }
});

document.addEventListener('focusout', function(e) {
  setTimeout(function() {
    var cur = document.activeElement;
    var isInput = cur && (cur.tagName === 'INPUT' || cur.tagName === 'TEXTAREA');
    if (!isInput && window.AndroidBridge && window.AndroidBridge.setInputActive) {
      window.AndroidBridge.setInputActive(false);
    }
  }, 60);
});

function _handleInputEnter(inp) {
  if (!inp) return;
  if (inp.id === 'cfgPlName') {
    var next = document.getElementById('cfgUser');
    if (next) focus(next);
  } else if (inp.id === 'cfgUser') {
    var next = document.getElementById('cfgServer');
    if (next) focus(next);
  } else if (inp.id === 'cfgServer') {
    var next = document.getElementById('cfgPass');
    if (next) focus(next);
  } else if (inp.id === 'cfgPass') {
    inp.blur();
    if (window.AndroidBridge && window.AndroidBridge.hideTextInput) {
      window.AndroidBridge.hideTextInput();
    }
    var btn = document.getElementById('btnSavePlaylist');
    if (btn) focus(btn);
  } else if (inp.id === 'searchInput') {
    inp.blur();
    if (window.AndroidBridge && window.AndroidBridge.hideTextInput) {
      window.AndroidBridge.hideTextInput();
    }
    var firstRes = document.querySelector('#searchResultsGrid .focusable');
    if (firstRes) focus(firstRes);
  } else {
    _nav('DOWN');
  }
}

function _navFormInput(inp, dir) {
  if (!inp) return;
  if (inp.id === 'cfgPlName') {
    if (dir === 'RIGHT') { var n = document.getElementById('cfgUser'); if (n) { focus(n); return; } }
    if (dir === 'DOWN')  { var n = document.getElementById('cfgServer'); if (n) { focus(n); return; } }
    if (dir === 'UP' || dir === 'LEFT') return;
  } else if (inp.id === 'cfgUser') {
    if (dir === 'LEFT')  { var n = document.getElementById('cfgPlName'); if (n) { focus(n); return; } }
    if (dir === 'DOWN')  { var n = document.getElementById('cfgPass'); if (n) { focus(n); return; } }
    if (dir === 'UP' || dir === 'RIGHT') return;
  } else if (inp.id === 'cfgServer') {
    if (dir === 'UP')    { var n = document.getElementById('cfgPlName'); if (n) { focus(n); return; } }
    if (dir === 'RIGHT') { var n = document.getElementById('cfgPass'); if (n) { focus(n); return; } }
    if (dir === 'DOWN')  { var n = document.getElementById('btnSavePlaylist'); if (n) { focus(n); return; } }
    if (dir === 'LEFT')  return;
  } else if (inp.id === 'cfgPass') {
    if (dir === 'UP')    { var n = document.getElementById('cfgUser'); if (n) { focus(n); return; } }
    if (dir === 'LEFT')  { var n = document.getElementById('cfgServer'); if (n) { focus(n); return; } }
    if (dir === 'DOWN')  { var n = document.getElementById('btnCloseAddPlaylist') || document.getElementById('btnSavePlaylist'); if (n) { focus(n); return; } }
    if (dir === 'RIGHT') return;
  }
  _nav(dir);
}

// Android TV Remote Control Key Bridge
window.dispatchTvKey = function(key) {
  var ae = document.activeElement;
  var isInput = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');

  if (window.AndroidBridge && window.AndroidBridge.logJs) {
    window.AndroidBridge.logJs('dispatchTvKey: ' + key + ' view=' + S.view + ' modal=' + S.modal + ' isInput=' + isInput + ' ae=' + (ae ? (ae.id || ae.tagName) : 'null'));
  }

  if (key === 'KEYBOARD_BACK') {
    if (ae && ae.blur) ae.blur();
    if (window.AndroidBridge && window.AndroidBridge.hideTextInput) {
      window.AndroidBridge.hideTextInput();
    }
    if (S.modal === 'modalAddPlaylist') {
      var saveBtn = document.getElementById('btnSavePlaylist');
      if (saveBtn) focus(saveBtn);
    } else if (S.modal === 'tvSearchModal') {
      var closeBtn = document.getElementById('btnCloseSearch');
      if (closeBtn) focus(closeBtn);
    }
    return;
  }

  if (key === 'BACK') {
    if (isInput) {
      if (ae && ae.blur) ae.blur();
      if (window.AndroidBridge && window.AndroidBridge.hideTextInput) {
        window.AndroidBridge.hideTextInput();
      }
      var saveBtn = document.getElementById('btnSavePlaylist');
      if (saveBtn && S.modal === 'modalAddPlaylist') {
        focus(saveBtn);
        return;
      }
    }
    if (S.isFs) {
      _closeFs();
      return;
    }
    if (S.modal) {
      _closeModal();
      return;
    }
    if (S.view !== 'home') {
      showView('home');
      return;
    }
    if (window.AndroidBridge && window.AndroidBridge.exitApp) {
      window.AndroidBridge.exitApp();
    }
    return;
  }

  if (isInput) {
    if (key === 'UP' || key === 'DOWN' || key === 'LEFT' || key === 'RIGHT') {
      _navFormInput(ae, key);
      return;
    }
    if (key === 'ENTER') {
      if (window.AndroidBridge && window.AndroidBridge.requestTextInput) {
        window.AndroidBridge.requestTextInput();
      }
      return;
    }
  }

  if (key === 'UP') _nav('UP');
  else if (key === 'DOWN') _nav('DOWN');
  else if (key === 'LEFT') _nav('LEFT');
  else if (key === 'RIGHT') _nav('RIGHT');
  else if (key === 'ENTER') {
    var target = (ae && ae !== document.body) ? ae : document.querySelector('.focusable.focused');
    if (!target) {
      var all = Array.from(document.querySelectorAll('.focusable')).filter(function(el){
        if (S.modal) { var m=document.getElementById(S.modal); return m&&m.contains(el)&&el.offsetParent!==null&&!el.disabled; }
        return el.offsetParent!==null&&!el.disabled&&!el.closest('.hidden');
      });
      target = all[0];
    }
    if (target) {
      focus(target);
      var viewAttr = target.getAttribute ? target.getAttribute('data-view') : null;
      if (viewAttr) {
        if (viewAttr !== 'settings' && S.isSyncing && !S.live.length && !S.movies.length && !S.series.length) {
          toast(t('syncing'));
          return;
        }
        showView(viewAttr);
        return;
      }
      var evt = {
        stopPropagation: function(){},
        preventDefault: function(){},
        target: target,
        currentTarget: target
      };
      if (typeof target.onclick === 'function') {
        try { target.onclick.call(target, evt); } catch(e){ console.error(e); }
      } else if (target.click) {
        try { target.click(); } catch(e){ console.error(e); }
      }
    }
  } else if (key === 'PLAY_PAUSE') {
    if (AV._state === 'PLAYING') AV.pause(); else AV.resume();
  } else if (key === 'DELETE') {
    if (isInput) {
      var start = ae.selectionStart || ae.value.length;
      if (start > 0) {
        ae.value = ae.value.slice(0, start - 1) + ae.value.slice(start);
        ae.setSelectionRange(start - 1, start - 1);
        ae.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
};

window.onNativePreviewFullscreenClosed = function() {
  _closeFs();
};

window.onNativePlayerProgress = function(data) {
  if (!data) return;
  var id = data.itemId || data.seriesId;
  if (id) {
    S.history[id] = {
      t: data.position || 0,
      d: data.duration || 0,
      season: data.season || '',
      episode: data.episodeNumber || '',
      episodeTitle: data.episodeTitle || '',
      seriesId: data.seriesId || '',
      ts: Date.now()
    };
    saveHist();
    if (S.view === 'favorites') {
      _renderFavorites();
    }
  }
  S.playbackPosition = data.position || 0;
  S.playbackDuration = data.duration || 0;
  S.playbackPaused = !!data.paused;
  if (data.title) S.playbackTitle = data.title;
  if (data.type) S.playbackType = data.type;
  broadcastRemoteState();
};

function _navGrid(cards, cur, dir, onLeftEdge, onTopEdge) {
  var idx = cards.indexOf(cur);
  if (idx < 0) return;

  if (dir === 'LEFT') {
    var isLeftmost = true;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c !== cur && Math.abs(c.offsetTop - cur.offsetTop) < 20 && c.offsetLeft < cur.offsetLeft) {
        isLeftmost = false;
        break;
      }
    }
    if (isLeftmost && onLeftEdge) { onLeftEdge(); return; }
    if (idx > 0) { focus(cards[idx - 1]); return; }
    return;
  }

  if (dir === 'RIGHT') {
    if (idx + 1 < cards.length) {
      focus(cards[idx + 1]);
      return;
    }
    return;
  }

  if (dir === 'DOWN') {
    var minNextTop = Infinity;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.offsetTop > cur.offsetTop + 20) {
        if (c.offsetTop < minNextTop) {
          minNextTop = c.offsetTop;
        }
      }
    }
    if (minNextTop !== Infinity) {
      var bestCard = null, minDx = Infinity;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (Math.abs(c.offsetTop - minNextTop) < 20) {
          var dx = Math.abs(c.offsetLeft - cur.offsetLeft);
          if (dx < minDx) { minDx = dx; bestCard = c; }
        }
      }
      if (bestCard) { focus(bestCard); return; }
    }
    // Already on the bottom row: stay on current card! Do not jump back to categories!
    return;
  }

  if (dir === 'UP') {
    var maxPrevTop = -Infinity;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.offsetTop < cur.offsetTop - 20) {
        if (c.offsetTop > maxPrevTop) {
          maxPrevTop = c.offsetTop;
        }
      }
    }
    if (maxPrevTop !== -Infinity) {
      var bestCard = null, minDx = Infinity;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (Math.abs(c.offsetTop - maxPrevTop) < 20) {
          var dx = Math.abs(c.offsetLeft - cur.offsetLeft);
          if (dx < minDx) { minDx = dx; bestCard = c; }
        }
      }
      if (bestCard) { focus(bestCard); return; }
    }
    if (onTopEdge) { onTopEdge(); return; }
    return;
  }
}

function _nav(dir) {
  var cur = (document.activeElement && document.activeElement !== document.body) 
    ? document.activeElement 
    : document.querySelector('.focusable.focused');
  if (!cur) {
    if (S.view === 'home') {
      var firstCard = document.getElementById('cardLive');
      if (firstCard) focus(firstCard);
      return;
    }
    _focusActiveViewFirst();
    return;
  }
  if (cur) {
    // 1. Home Dock Navigation (Live -> Series -> Movies -> Favorites -> Settings)
    if (cur.parentElement && cur.parentElement.id === 'homeDock') {
      var cards = Array.from(cur.parentElement.querySelectorAll('.tv-dock-card'));
      var idx = cards.indexOf(cur);
      if (dir === 'RIGHT' && idx >= 0 && idx < cards.length - 1) { focus(cards[idx + 1]); return; }
      if (dir === 'LEFT' && idx > 0) { focus(cards[idx - 1]); return; }
      if (dir === 'UP') {
        var sync = document.getElementById('homeSyncBtn');
        if (sync) { focus(sync); return; }
      }
    } else if (cur.id === 'homeSyncBtn') {
      if (dir === 'DOWN') {
        var firstCard = document.getElementById('cardLive');
        if (firstCard) { focus(firstCard); return; }
      }
    }

    // 2. Top Bar Navigation
    else if (cur.id === 'topBackBtn') {
      if (dir === 'RIGHT') { var s = document.getElementById('topSyncBtn'); if (s) { focus(s); return; } }
      if (dir === 'DOWN') { _focusActiveViewFirst(); return; }
    } else if (cur.id === 'topSyncBtn') {
      if (dir === 'LEFT') { var b = document.getElementById('topBackBtn'); if (b) { focus(b); return; } }
      if (dir === 'DOWN') { _focusActiveViewFirst(); return; }
    }

    // 3. Live TV Navigation (Categories Col 1 -> Channels Col 2 -> Preview Col 3)
    else if (cur.closest && cur.closest('#liveCatsList')) {
      if (dir === 'DOWN') { if (cur.nextElementSibling) focus(cur.nextElementSibling); return; }
      if (dir === 'UP' && cur.previousElementSibling) { focus(cur.previousElementSibling); return; }
      if (dir === 'UP' && !cur.previousElementSibling) { var b = document.getElementById('topBackBtn'); if (b) { focus(b); return; } }
      if (dir === 'RIGHT') {
        var ch = document.querySelector('#liveChannelsList .tv-channel-row.active') || document.querySelector('#liveChannelsList .focusable');
        if (ch) { focus(ch); return; }
      }
      return;
    } else if (cur.closest && cur.closest('#liveChannelsList')) {
      if (dir === 'DOWN') { if (cur.nextElementSibling) focus(cur.nextElementSibling); return; }
      if (dir === 'UP' && cur.previousElementSibling) { focus(cur.previousElementSibling); return; }
      if (dir === 'UP' && !cur.previousElementSibling) { var b = document.getElementById('topBackBtn'); if (b) { focus(b); return; } }
      if (dir === 'LEFT') {
        var cat = document.querySelector('#liveCatsList .tv-cat-btn.active') || document.querySelector('#liveCatsList .focusable');
        if (cat) { focus(cat); return; }
      }
      if (dir === 'RIGHT') {
        var prevBtn = document.getElementById('previewOverlayBtn');
        if (prevBtn) { focus(prevBtn); return; }
      }
      return;
    } else if (cur.id === 'previewOverlayBtn') {
      if (dir === 'LEFT') {
        var ch = document.querySelector('#liveChannelsList .tv-channel-row.active') || document.querySelector('#liveChannelsList .focusable');
        if (ch) { focus(ch); return; }
      }
      if (dir === 'UP') { var s = document.getElementById('topSyncBtn'); if (s) { focus(s); return; } }
      return;
    }

    // 4. Movies View (Categories Col 1 -> Dynamic Poster Grid Col 2)
    else if (cur.closest && cur.closest('#moviesCatsList')) {
      if (dir === 'DOWN') { if (cur.nextElementSibling) focus(cur.nextElementSibling); return; }
      if (dir === 'UP' && cur.previousElementSibling) { focus(cur.previousElementSibling); return; }
      if (dir === 'UP' && !cur.previousElementSibling) { var b = document.getElementById('topBackBtn'); if (b) { focus(b); return; } }
      if (dir === 'RIGHT') {
        var firstM = document.querySelector('#moviesGridList .focusable');
        if (firstM) { focus(firstM); return; }
      }
      return;
    } else if (cur.closest && cur.closest('#moviesGridList')) {
      var mCards = Array.from(document.querySelectorAll('#moviesGridList .focusable'));
      _navGrid(mCards, cur, dir, function() {
        var cat = document.querySelector('#moviesCatsList .tv-cat-btn.active') || document.querySelector('#moviesCatsList .focusable');
        if (cat) focus(cat);
      }, function() {
        var b = document.getElementById('topBackBtn');
        if (b) focus(b);
      });
      return;
    }

    // 5. Series View (Categories Col 1 -> Dynamic Poster Grid Col 2)
    else if (cur.closest && cur.closest('#seriesCatsList')) {
      if (dir === 'DOWN') { if (cur.nextElementSibling) focus(cur.nextElementSibling); return; }
      if (dir === 'UP' && cur.previousElementSibling) { focus(cur.previousElementSibling); return; }
      if (dir === 'UP' && !cur.previousElementSibling) { var b = document.getElementById('topBackBtn'); if (b) { focus(b); return; } }
      if (dir === 'RIGHT') {
        var firstS = document.querySelector('#seriesGridList .focusable');
        if (firstS) { focus(firstS); return; }
      }
      return;
    } else if (cur.closest && cur.closest('#seriesGridList')) {
      var sCards = Array.from(document.querySelectorAll('#seriesGridList .focusable'));
      _navGrid(sCards, cur, dir, function() {
        var cat = document.querySelector('#seriesCatsList .tv-cat-btn.active') || document.querySelector('#seriesCatsList .focusable');
        if (cat) focus(cat);
      }, function() {
        var b = document.getElementById('topBackBtn');
        if (b) focus(b);
      });
      return;
    }

    // 6. Favorites View
    else if (cur.closest && cur.closest('#favsTabsList')) {
      if (dir === 'DOWN') { if (cur.nextElementSibling) focus(cur.nextElementSibling); return; }
      if (dir === 'UP' && cur.previousElementSibling) { focus(cur.previousElementSibling); return; }
      if (dir === 'UP' && !cur.previousElementSibling) { var b = document.getElementById('topBackBtn'); if (b) { focus(b); return; } }
      if (dir === 'RIGHT') {
        var firstFav = document.querySelector('#favsGridList .focusable');
        if (firstFav) { focus(firstFav); return; }
      }
      return;
    } else if (cur.closest && cur.closest('#favsGridList')) {
      var fCards = Array.from(document.querySelectorAll('#favsGridList .focusable'));
      _navGrid(fCards, cur, dir, function() {
        var tab = document.querySelector('#favsTabsList .tv-cat-btn.active') || document.querySelector('#favsTabsList .focusable');
        if (tab) focus(tab);
      }, function() {
        var b = document.getElementById('topBackBtn');
        if (b) focus(b);
      });
      return;
    }

    // 7. Settings View Navigation
    else if (cur.id === 'btnOpenAddPlaylist') {
      if (dir === 'DOWN') {
        var firstPl = document.querySelector('#savedPlaylistsList .focusable');
        if (firstPl) { focus(firstPl); return; }
      }
      if (dir === 'RIGHT') {
        var firstLang = document.querySelector('#langPillsRow .lang-btn');
        if (firstLang) { focus(firstLang); return; }
      }
    } else if (cur.closest && cur.closest('#savedPlaylistsList')) {
      var allPlBtns = Array.from(document.querySelectorAll('#savedPlaylistsList .focusable'));
      var pIdx = allPlBtns.indexOf(cur);
      if (dir === 'RIGHT' && pIdx >= 0 && pIdx < allPlBtns.length - 1) { focus(allPlBtns[pIdx + 1]); return; }
      if (dir === 'LEFT' && pIdx > 0) { focus(allPlBtns[pIdx - 1]); return; }
      if (dir === 'UP') {
        var b = document.getElementById('btnOpenAddPlaylist');
        if (b) { focus(b); return; }
      }
      if (dir === 'RIGHT' && (pIdx === allPlBtns.length - 1 || cur.classList.contains('pl-btn-delete'))) {
        var firstLang = document.querySelector('#langPillsRow .lang-btn');
        if (firstLang) { focus(firstLang); return; }
      }
    } else if (cur.closest && cur.closest('#langPillsRow')) {
      var langBtns = Array.from(document.querySelectorAll('#langPillsRow .lang-btn'));
      var lIdx = langBtns.indexOf(cur);
      if (dir === 'RIGHT' && lIdx >= 0 && lIdx < langBtns.length - 1) { focus(langBtns[lIdx + 1]); return; }
      if (dir === 'LEFT' && lIdx > 0) { focus(langBtns[lIdx - 1]); return; }
      if (dir === 'LEFT' && lIdx === 0) { var addBtn = document.getElementById('btnOpenAddPlaylist'); if (addBtn) { focus(addBtn); return; } }
      if (dir === 'DOWN') { var hw = document.getElementById('hwDecToggle'); if (hw) { focus(hw); return; } }
    } else if (cur.id === 'hwDecToggle') {
      if (dir === 'UP') { var firstLang = document.querySelector('#langPillsRow .lang-btn'); if (firstLang) { focus(firstLang); return; } }
      if (dir === 'DOWN') { var clr = document.getElementById('btnClearCache'); if (clr) { focus(clr); return; } }
      if (dir === 'LEFT') { var addBtn = document.getElementById('btnOpenAddPlaylist'); if (addBtn) { focus(addBtn); return; } }
    } else if (cur.id === 'btnClearCache') {
      if (dir === 'UP') { var hw = document.getElementById('hwDecToggle'); if (hw) { focus(hw); return; } }
      if (dir === 'LEFT') { var addBtn = document.getElementById('btnOpenAddPlaylist'); if (addBtn) { focus(addBtn); return; } }
    }

    // Modal navigation
    else if (cur.id === 'btnSavePlaylist') {
      if (dir === 'RIGHT') { var c = document.getElementById('btnCloseAddPlaylist'); if (c) { focus(c); return; } }
      if (dir === 'UP') { var p = document.getElementById('cfgPass'); if (p) { focus(p); return; } }
    } else if (cur.id === 'btnCloseAddPlaylist') {
      if (dir === 'LEFT') { var s = document.getElementById('btnSavePlaylist'); if (s) { focus(s); return; } }
      if (dir === 'UP') { var p = document.getElementById('cfgPass'); if (p) { focus(p); return; } }
    } else if (cur.closest && cur.closest('#detailSeasonsList')) {
      var sBtns = Array.from(document.querySelectorAll('#detailSeasonsList .tv-btn-pill'));
      var sIdx = sBtns.indexOf(cur);
      if (dir === 'RIGHT' && sIdx >= 0 && sIdx < sBtns.length - 1) { focus(sBtns[sIdx + 1]); return; }
      if (dir === 'LEFT') {
        if (sIdx > 0) { focus(sBtns[sIdx - 1]); return; }
        else { var favBtn = document.getElementById('btnDetailFav'); if (favBtn) { focus(favBtn); return; } }
      }
      if (dir === 'DOWN') {
        var firstEp = document.querySelector('#detailEpisodesList .detail-ep-row');
        if (firstEp) { focus(firstEp); return; }
      }
    } else if (cur.closest && cur.closest('#detailEpisodesList')) {
      var eps = Array.from(document.querySelectorAll('#detailEpisodesList .detail-ep-row'));
      var eIdx = eps.indexOf(cur);
      if (eIdx >= 0) {
        if (dir === 'DOWN') {
          if (eIdx + 2 < eps.length) { focus(eps[eIdx + 2]); return; }
          else if (eIdx + 1 < eps.length) { focus(eps[eIdx + 1]); return; }
        }
        if (dir === 'UP') {
          if (eIdx >= 2) { focus(eps[eIdx - 2]); return; }
          else {
            var activeSeason = document.querySelector('#detailSeasonsList .tv-btn-pill.active') || document.querySelector('#detailSeasonsList .tv-btn-pill');
            if (activeSeason) { focus(activeSeason); return; }
          }
        }
        if (dir === 'RIGHT' && eIdx % 2 === 0 && eIdx + 1 < eps.length) {
          focus(eps[eIdx + 1]); return;
        }
        if (dir === 'LEFT') {
          if (eIdx % 2 === 1) { focus(eps[eIdx - 1]); return; }
          else {
            var favBtn = document.getElementById('btnDetailFav');
            if (favBtn) { focus(favBtn); return; }
          }
        }
      }
    } else if (cur.id === 'btnMoviePlay') {
      if (dir === 'RIGHT') { var f = document.getElementById('btnMovieFav'); if (f) { focus(f); return; } }
    } else if (cur.id === 'btnMovieFav') {
      if (dir === 'LEFT') { var p = document.getElementById('btnMoviePlay'); if (p) { focus(p); return; } }
      if (dir === 'RIGHT') { var c = document.getElementById('btnMovieClose'); if (c) { focus(c); return; } }
    } else if (cur.id === 'btnMovieClose') {
      if (dir === 'LEFT') { var f = document.getElementById('btnMovieFav'); if (f) { focus(f); return; } }
    } else if (cur.id === 'btnDetailFav') {
      if (dir === 'DOWN') { var c = document.getElementById('btnDetailClose'); if (c) { focus(c); return; } }
      if (dir === 'RIGHT') {
        var activeSeason = document.querySelector('#detailSeasonsList .tv-btn-pill.active') || document.querySelector('#detailSeasonsList .tv-btn-pill') || document.querySelector('#detailEpisodesList .detail-ep-row');
        if (activeSeason) { focus(activeSeason); return; }
      }
    } else if (cur.id === 'btnDetailClose') {
      if (dir === 'UP') { var f = document.getElementById('btnDetailFav'); if (f) { focus(f); return; } }
      if (dir === 'RIGHT') {
        var firstEp = document.querySelector('#detailEpisodesList .detail-ep-row');
        if (firstEp) { focus(firstEp); return; }
      }
    }
  }

  // Fallback geometric search for other elements
  var all = Array.from(document.querySelectorAll('.focusable')).filter(function(el){
    if (S.modal) { var m=document.getElementById(S.modal); return m&&m.contains(el)&&el.offsetParent!==null&&!el.disabled; }
    return el.offsetParent!==null&&!el.disabled&&!el.closest('.hidden');
  });
  if (!cur || all.indexOf(cur) < 0) { if (all[0]) focus(all[0]); return; }
  var cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  var best = null, best_d = Infinity;
  all.forEach(function(c2){
    if (c2 === cur) return;
    var r = c2.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    var dx = tx - cx, dy = ty - cy, valid = false;
    if (dir === 'UP' && dy < -5) valid = true;
    if (dir === 'DOWN' && dy > 5) valid = true;
    if (dir === 'LEFT' && dx < -5) valid = true;
    if (dir === 'RIGHT' && dx > 5) valid = true;
    if (!valid) return;
    var d = Math.sqrt(dx * dx + dy * dy) + (dir === 'UP' || dir === 'DOWN' ? Math.abs(dx) * 2 : Math.abs(dy) * 2);
    if (d < best_d) { best_d = d; best = c2; }
  });
  if (best) focus(best);
}

function _focusActiveViewFirst() {
  if (S.view === 'live') {
    var c = document.querySelector('#liveCatsList .tv-cat-btn.active') || document.querySelector('#liveCatsList .focusable');
    if (c) { focus(c); return; }
  } else if (S.view === 'movies') {
    var c = document.querySelector('#moviesCatsList .tv-cat-btn.active') || document.querySelector('#moviesCatsList .focusable');
    if (c) { focus(c); return; }
  } else if (S.view === 'series') {
    var c = document.querySelector('#seriesCatsList .tv-cat-btn.active') || document.querySelector('#seriesCatsList .focusable');
    if (c) { focus(c); return; }
  } else if (S.view === 'favorites') {
    var c = document.querySelector('#favsTabsList .tv-cat-btn.active') || document.querySelector('#favsTabsList .focusable');
    if (c) { focus(c); return; }
  } else if (S.view === 'settings') {
    var b = document.getElementById('btnOpenAddPlaylist');
    if (b) { focus(b); return; }
  }
}

function focus(el) {
  if (!el) return;
  document.querySelectorAll('.focusable.focused').forEach(function(f){ f.classList.remove('focused'); });
  el.classList.add('focused');
  el.focus();
  var isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  if (window.AndroidBridge && window.AndroidBridge.setInputActive) {
    window.AndroidBridge.setInputActive(isInput);
  }
  window.scrollTo(0,0);
  var sp=el.closest('.tv-cats-scroll,.tv-items-scroll,.tv-grid-scroll,.detail-episodes-list,.search-results-grid');
  if (sp) {
    var pr=sp.getBoundingClientRect(), er=el.getBoundingClientRect();
    if (er.top < pr.top+10)      sp.scrollTop -= pr.top+10-er.top;
    else if (er.bottom > pr.bottom-10) sp.scrollTop += er.bottom-(pr.bottom-10);
  }
}

// ── SEARCH ─────────────────────────────────────────────────────────────────
function _openSearchModal() {
  _openModal('tvSearchModal');
  var inp=document.getElementById('searchInput');
  var grid=document.getElementById('searchResultsGrid');
  if (!inp||!grid) return;
  inp.value=''; inp.focus();
  inp.oninput=function(){
    var q=inp.value.toLowerCase().trim();
    grid.innerHTML='';
    if (!q) return;
    var all=[].concat(
      S.live.filter(function(i){ return i.name.toLowerCase().indexOf(q)>=0; }).slice(0,8),
      S.movies.filter(function(i){ return i.name.toLowerCase().indexOf(q)>=0; }).slice(0,8),
      S.series.filter(function(i){ return i.name.toLowerCase().indexOf(q)>=0; }).slice(0,8)
    );
    var frag=document.createDocumentFragment();
    all.forEach(function(item){
      var row=document.createElement('div');
      row.className='tv-channel-row focusable'; row.tabIndex=0;
      row.innerHTML='<div class="ch-details"><div class="ch-name">'+_esc(item.name)+'</div>'
        +'<div class="ch-epg">'+item._type+' &bull; '+_esc(item.grp||'')+'</div></div>';
      row.onclick=function(){
        _closeModal();
        if (item._type==='live') { showView('live'); setTimeout(function(){ _previewCh(item); },100); }
        else if (item._type==='series') _openSeriesDetail(item);
        else _openFs(item,0);
      };
      frag.appendChild(row);
    });
    grid.appendChild(frag);
  };
  var btnClose=document.getElementById('btnCloseSearch');
  if (btnClose) btnClose.onclick=function(){ _closeModal(); };
}

// ── COMPANION REMOTE ───────────────────────────────────────────────────────
function _pushRemote() {
  var pl = S.activePl;
  var payload = {
    target: 'android-tv',
    device: 'android-tv',
    view: S.view,
    syncing: S.isSyncing,
    provider: pl ? { server: pl.server, user: pl.user, pass: pl.pass } : null,
    activePlaylistId: pl ? pl.id : '',
    activePlaylistName: pl ? pl.name : '',
    playlists: S.playlists.map(function(p) {
      return { id: p.id, name: p.name, server: p.server, user: p.user, pass: p.pass, itemCount: S.live.length };
    }),
    categories: {
      live: S.liveCats || ['ALL', 'FAVORITES'],
      movies: S.movieCats || ['ALL', 'FAVORITES'],
      series: S.seriesCats || ['ALL', 'FAVORITES']
    },
    channels: S.live.slice(0, 300).map(function(x) {
      return { id: x._id, name: x.name, group: x.grp, logo: x.logo, num: x.num, type: 'live', isFav: !!S.favsLive[x._id] };
    }),
    movies: S.movies.slice(0, 150).map(function(x) {
      return { id: x._id, name: x.name, group: x.grp, logo: x.logo, type: 'movie', isFav: !!S.favs[x._id] };
    }),
    series: S.series.slice(0, 150).map(function(x) {
      return { id: x._id, name: x.name, group: x.grp, logo: x.logo, type: 'series', isFav: !!S.favs[x._id] };
    }),
    totalCounts: {
      channels: S.live.length,
      movies: S.movies.length,
      series: S.series.length,
      favorites: Object.keys(S.favs).length
    },
    playback: {
      status: (S.playbackDuration > 0 || S.isFs) ? (S.playbackPaused ? 'paused' : 'playing') : 'ready',
      title: S.playbackTitle || (S.activeItem ? S.activeItem.name : ''),
      group: S.activeItem ? S.activeItem.grp : '',
      type: S.playbackType || (S.activeItem ? S.activeItem._type : 'live'),
      isFs: S.isFs || S.playbackDuration > 0,
      currentTime: S.playbackPosition || 0,
      duration: S.playbackDuration || 0,
      paused: !!S.playbackPaused
    }
  };

  if (window.AndroidBridge && window.AndroidBridge.updateRemoteState) {
    try { window.AndroidBridge.updateRemoteState(JSON.stringify(payload)); } catch(e){}
  }

  fetch(COMPANION + '/api/tv-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(function() {});
}

function _pollRemote() {
  fetch(COMPANION+'/api/tv-actions').then(function(r){ return r.json(); }).then(function(d){
    if (d&&Array.isArray(d.actions)) d.actions.forEach(_handleRemote);
  }).catch(function(){});

  fetch(COMPANION+'/api/tv-playlists').then(function(r){ return r.json(); }).then(function(d){
    if (d&&Array.isArray(d.playlists)) {
      d.playlists.forEach(function(p){
        importPlaylistFromPhone(p);
      });
    }
  }).catch(function(){});
}

function importPlaylistFromPhone(data) {
  if (!data) return;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch(e) { logTV('importPlaylist parse error', e); return; }
  }
  var srv = (data.server || data.url || data.serverUrl || '').trim();
  var usr = (data.user || data.username || '').trim();
  var pass = (data.pass || data.password || '').trim();
  var name = (data.name || data.title || ('Phone Playlist ' + (S.playlists.length + 1))).trim();

  if (!srv || !usr || !pass) {
    toast('Invalid playlist from mobile');
    return;
  }

  var existing = S.playlists.find(function(p) {
    return p.server === srv && p.user === usr;
  });

  if (existing) {
    existing.name = name;
    existing.pass = pass;
    S.activePl = existing;
    savePl();
    toast('✓ ' + t('switched_pl') + ': ' + existing.name);
    _renderSettings();
    syncPlaylist(existing, function() { showView('live'); });
  } else {
    var np = {
      id: 'pl' + Date.now(),
      name: name,
      server: srv,
      user: usr,
      pass: pass
    };
    S.playlists.push(np);
    S.activePl = np;
    savePl();
    toast('✓ ' + t('add_new_playlist') + ': ' + np.name);
    _renderSettings();
    syncPlaylist(np, function() { showView('live'); });
  }
  _pushRemote();
}

function _handleRemote(act) {
  if (!act) return;
  var type = act.type || act.action, id = String(act.itemId || act.id || act.streamId || '');
  logTV('_handleRemote received action: ' + type, act);

  if (type === 'push_playlist' || type === 'addPlaylist' || type === 'send_playlist' || type === 'importPlaylist') {
    importPlaylistFromPhone(act.playlist || act.data || act);
    return;
  }

  if (type === 'playEpisode' || type === 'playEp') {
    var ep = {
      _id: String(act.epId || act.id || act.streamId || ''),
      _type: 'series',
      seriesId: act.seriesId || '',
      season: act.season || '',
      ep_num: act.episodeNumber || act.ep_num || '',
      name: act.name || act.title || ('Episode ' + (act.episodeNumber || '')),
      logo: act.logo || '',
      url: act.url || act.streamUrl || ''
    };
    if (ep.url || ep._id) {
      _closeModal();
      _openFs(ep, 0);
    }
    return;
  }

  if (type === 'playItem' || type === 'selectChannel' || type === 'playChannel') {
    var found = S.live.find(function(x){ return x._id === id; }) ||
                S.movies.find(function(x){ return x._id === id; }) ||
                S.series.find(function(x){ return x._id === id; });
    if (found) {
      if (found._type === 'series') _openSeriesDetail(found);
      else _openFs(found, 0);
    }
    return;
  }
  if (type === 'togglePlay' || type === 'play' || type === 'pause' || type === 'playPause') {
    if (AV._state === 'PLAYING') AV.pause(); else AV.resume();
    return;
  }
  if (type === 'toggleFullscreen') {
    if (S.isFs) _closeFs();
    else if (S.activeCh) _openFs(S.activeCh, 0);
    return;
  }
  if (type === 'switchView' || type === 'navTab') {
    if (act.view) showView(act.view);
    return;
  }
  if (type === 'selectPlaylist' && act.playlistId) {
    var p = S.playlists.find(function(x){ return x.id === act.playlistId; });
    if (p) {
      S.activePl = p;
      savePl();
      _renderSettings();
      syncPlaylist(p);
    }
    return;
  }
  if (type === 'toggleFavorite' && id) {
    var favItem = S.live.find(function(x){ return x._id === id; }) ||
                  S.movies.find(function(x){ return x._id === id; }) ||
                  S.series.find(function(x){ return x._id === id; });
    if (favItem) _toggleFav(favItem);
    return;
  }
  if (type === 'seek') {
    if (act.relative) {
      AV.seekRel(act.relative);
    } else {
      var sec = (typeof act.time === 'number') ? act.time : (typeof act.position === 'number' ? act.position : null);
      if (sec !== null) {
        if (window.AndroidBridge && window.AndroidBridge.seekNativePreviewTo) {
          window.AndroidBridge.seekNativePreviewTo(Math.round(sec * 1000));
        } else {
          try { webapis.avplay.seekTo(Math.round(sec * 1000)); } catch(e){}
        }
      }
    }
    return;
  }
  if (type === 'setVolume' && typeof act.value === 'number') {
    if (window.AndroidBridge && window.AndroidBridge.setVolume) {
      window.AndroidBridge.setVolume(act.value);
    }
    return;
  }
  if (type === 'toggleMute') {
    if (window.AndroidBridge && window.AndroidBridge.toggleMute) {
      window.AndroidBridge.toggleMute();
    }
    return;
  }
  if (type === 'cycleAudio' || type === 'audioTrack') {
    if (window.AndroidBridge && window.AndroidBridge.cycleAudioTrackFromWeb) {
      window.AndroidBridge.cycleAudioTrackFromWeb();
    }
    return;
  }
  if (type === 'cycleSubtitle' || type === 'subtitleTrack') {
    if (window.AndroidBridge && window.AndroidBridge.cycleSubtitleTrackFromWeb) {
      window.AndroidBridge.cycleSubtitleTrackFromWeb();
    }
    return;
  }
  if (type === 'home' || type === 'goHome') {
    if (S.isFs) _closeFs();
    if (S.modal) _closeModal();
    showView('home');
    return;
  }
  if (type === 'playNextEpisode') { _nextEp(); return; }
  if (type === 'playPrevEpisode') { _prevEp(); return; }

  if (type === 'tvKey' || type === 'dpad' || type === 'key') {
    var kk = String(act.key || '').toUpperCase();
    if (kk === 'UP')    _nav('UP');
    else if (kk === 'DOWN')  _nav('DOWN');
    else if (kk === 'LEFT')  { if(S.isFs) AV.seekRel(-10); else _nav('LEFT'); }
    else if (kk === 'RIGHT') { if(S.isFs) AV.seekRel(10);  else _nav('RIGHT'); }
    else if (kk === 'OK' || kk === 'ENTER') {
      dispatchTvKey('ENTER');
    }
    else if (kk === 'BACK') { if(S.isFs) _closeFs(); else if(S.modal) _closeModal(); else if(S.view!=='home') showView('home'); }
    else if (kk === 'HOME') { if(S.isFs) _closeFs(); else if(S.modal) _closeModal(); showView('home'); }
    else if (kk === 'PLAY_PAUSE') { if(AV._state === 'PLAYING') AV.pause(); else AV.resume(); }
    else if (kk === 'NEXT') _nextEp();
    else if (kk === 'PREV') _prevEp();
  }
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function _getPopularItems(list) {
  if (!list || !list.length) return [];
  var scored = list.map(function(item) {
    var score = 0;
    var r = parseFloat(item.rating) || 0;
    if (r > 0) score += r * 10;
    var y = parseInt(item.year) || 0;
    if (y >= 2026) score += 50;
    else if (y >= 2025) score += 40;
    else if (y >= 2024) score += 30;
    else if (y >= 2023) score += 20;
    else if (y >= 2020) score += 10;
    var grp = (item.grp || '').toLowerCase();
    var name = (item.name || '').toLowerCase();
    if (/popul|top|trend|tendance|cinema|box office|netflix|prime|disney|apple|hbo/i.test(grp)) score += 35;
    if (/popul|top|trend|tendance|cinema|box office|netflix|prime|disney|apple|hbo/i.test(name)) score += 20;
    return { item: item, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.map(function(x) { return x.item; });
}

function _filter(list, cat) {
  if (cat === 'ALL') return list;
  if (cat === 'FAVORITES') {
    return list.filter(function(x){
      return (x._type === 'live') ? !!S.favsLive[x._id] : !!S.favs[x._id];
    });
  }
  if (cat === '🔥 POPULAR' || cat === 'POPULAR') {
    return _getPopularItems(list);
  }
  return list.filter(function(x){ return x.grp === cat; });
}
function _catBtn(cat, active, onclick) {
  var btn = document.createElement('button');
  var isPop = (cat === '🔥 POPULAR' || cat === 'POPULAR');
  btn.className = 'tv-cat-btn focusable' + (isPop ? ' popular-cat-btn' : '') + (active ? ' active' : '');
  btn.tabIndex = 0;
  var label = isPop ? t('pop_now') : (cat === 'ALL' ? t('all') : (cat === 'FAVORITES' ? ('★ ' + t('favorites')) : cat));
  btn.innerHTML = '<span>' + _esc(label) + '</span>';
  btn.onclick = onclick;
  return btn;
}
function _posterCard(item, onclick) {
  var c = document.createElement('div');
  c.className = 'tv-poster-card focusable';
  c.tabIndex = 0;
  c.dataset.id = item._id;
  c.dataset.type = item._type;
  var isFav = (item._type === 'live') ? !!S.favsLive[item._id] : !!S.favs[item._id];
  var favBadge = isFav ? '<span class="poster-fav-badge">★</span>' : '';
  var typeTag = item._type === 'live' ? '<span class="poster-type-badge tv-live-tag">LIVE</span>' : (item._type === 'series' ? '<span class="poster-type-badge tv-series-tag">SERIES</span>' : '<span class="poster-type-badge tv-movie-tag">MOVIE</span>');
  var ratingVal = (item.rating && item.rating !== '?' && item.rating !== '0' && item.rating !== '0.0') ? ('★ ' + _esc(item.rating)) : (item.year ? ('' + _esc(item.year)) : (item._type === 'live' ? 'HD' : 'VOD'));

  c.innerHTML =
    '<div class="poster-img-wrap">' +
      favBadge +
      typeTag +
      '<img class="poster-img" src="' + (item.logo || 'icon.png') + '" onerror="window._onPosterError(this, \'' + _esc(item._id) + '\')" alt="" loading="lazy">' +
      '<span class="poster-rating">' + ratingVal + '</span>' +
    '</div>' +
    '<div class="poster-meta">' +
      '<div class="poster-title">' + _esc(item.name) + '</div>' +
      '<div class="poster-sub">' + _esc(item.year || item.grp || '') + '</div>' +
    '</div>';
  c.onclick = onclick;

  // If logo is empty, resolve via TMDB in background
  if (!item.logo && item._type !== 'live') {
    setTimeout(function() {
      var img = c.querySelector('.poster-img');
      if (img) _resolveTmdbPoster(item, img);
    }, 10);
  }

  return c;
}

function _toggleFav(item) {
  if (!item) {
    var cur = (document.activeElement && document.activeElement !== document.body)
      ? document.activeElement
      : document.querySelector('.focusable.focused');
    if (cur && cur.dataset && cur.dataset.id) {
      var id = cur.dataset.id;
      item = S.live.find(function(x){ return x._id === id; }) ||
             S.movies.find(function(x){ return x._id === id; }) ||
             S.series.find(function(x){ return x._id === id; });
    }
  }
  if (!item && S.activeItem) item = S.activeItem;
  if (!item && S.activeCh) item = S.activeCh;
  if (!item) return;

  var isLive = (item._type === 'live');
  var favStore = isLive ? S.favsLive : S.favs;
  var isFav = !!favStore[item._id];

  if (isFav) {
    delete favStore[item._id];
    toast(t('fav_rem') + ': ' + item.name);
  } else {
    favStore[item._id] = 1;
    toast(t('fav_add') + ': ' + item.name);
  }
  saveFav();
  _updateCounts();
  _pushRemote();

  // Update card in DOM if visible
  var cards = document.querySelectorAll('.tv-poster-card[data-id="' + item._id + '"]');
  cards.forEach(function(card) {
    var badge = card.querySelector('.poster-fav-badge');
    var nowFav = isLive ? !!S.favsLive[item._id] : !!S.favs[item._id];
    if (nowFav && !badge) {
      var wrap = card.querySelector('.poster-img-wrap');
      if (wrap) {
        var b = document.createElement('span');
        b.className = 'poster-fav-badge';
        b.textContent = '★';
        wrap.appendChild(b);
      }
    } else if (!nowFav && badge) {
      badge.remove();
    }
  });

  // Update channel row star if in live view
  var chRows = document.querySelectorAll('.tv-channel-row[data-id="' + item._id + '"]');
  chRows.forEach(function(r) {
    var star = r.querySelector('.ch-fav-icon');
    var nowFav = !!S.favsLive[item._id];
    if (nowFav && !star) {
      var s = document.createElement('span');
      s.className = 'ch-fav-icon';
      s.textContent = '★';
      r.appendChild(s);
    } else if (!nowFav && star) {
      star.remove();
    }
  });

  if (S.modal === 'tvDetailModal' && S.activeItem && S.activeItem._id === item._id) {
    _updateDetailFavBtn(item);
  }

  if (S.view === 'favorites') {
    _renderFavorites();
  }
}
function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

var _toastTimer=0;
function toast(msg) {
  var el=document.getElementById('tvToast'); if (!el) return;
  el.textContent=msg; el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){ el.classList.add('hidden'); }, 3000);
}

function _clock() {
  var now=new Date(), h=now.getHours(), m=now.getMinutes();
  var ap=h>=12?'PM':'AM'; h=h%12||12;
  var ts=(h<10?'0':'')+h+':'+(m<10?'0':'')+m+' '+ap;
  var mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var ds=mo[now.getMonth()]+' '+now.getDate()+', '+now.getFullYear();
  [D.homeClock,D.topClock].forEach(function(el){ if(el) el.textContent=ts; });
  [D.homeDate,D.topDate].forEach(function(el){ if(el) el.textContent=ds; });
  if (D.osdClock) D.osdClock.textContent=ts;
}

// ── INIT ───────────────────────────────────────────────────────────────────
function init() {
  logTV('tv-app.js init starting');
  _registerKeys();
  load();

  // Cache DOM
  D.topBar      = document.getElementById('tvTopBar');
  D.topPageTitle= document.getElementById('topPageTitle');
  D.topClock    = document.getElementById('topClockTime');
  D.topDate     = document.getElementById('topClockDate');
  D.topBack     = document.getElementById('topBackBtn');
  D.topSync     = document.getElementById('topSyncBtn');

  D.bannerBadge = document.getElementById('syncBannerBadge');
  D.bannerText  = document.getElementById('syncBannerText');
  D.homeSyncBanner = document.getElementById('homeSyncBanner');
  D.statusDot   = document.getElementById('homeStatusDot');
  D.statusText  = document.getElementById('homePlStatusText');
  D.plName      = document.getElementById('homePlName');
  D.homeClock   = document.getElementById('homeClockTime');
  D.homeDate    = document.getElementById('homeClockDate');
  D.badgeLive   = document.getElementById('badgeLiveCount');
  D.badgeMov    = document.getElementById('badgeMoviesCount');
  D.badgeSer    = document.getElementById('badgeSeriesCount');
  D.badgeFav    = document.getElementById('badgeFavsCount');

  D.liveCats    = document.getElementById('liveCatsList');
  D.liveChs     = document.getElementById('liveChannelsList');
  D.liveCatTitle= document.getElementById('liveCategoryTitle');
  D.prevVid     = document.getElementById('tvHtml5PreviewVideo');
  D.prevTitle   = document.getElementById('livePreviewTitle');
  D.prevGrp     = document.getElementById('livePreviewGroup');
  D.prevLogo    = document.getElementById('livePreviewLogo');

  D.movieCats   = document.getElementById('moviesCatsList');
  D.movieGrid   = document.getElementById('moviesGridList');
  D.movieCatTitle=document.getElementById('moviesCategoryTitle');

  D.serCats     = document.getElementById('seriesCatsList');
  D.serGrid     = document.getElementById('seriesGridList');
  D.serCatTitle = document.getElementById('seriesCategoryTitle');

  D.fsPlayer    = document.getElementById('tvFsPlayer');
  D.fsVid       = document.getElementById('tvFsVideo');
  D.fsOsd       = document.getElementById('tvFsOsd');
  D.osdTitle    = document.getElementById('osdTitle');
  D.osdSubtitle = document.getElementById('osdSubtitle');
  D.osdLogo     = document.getElementById('osdLogo');
  D.osdClock    = document.getElementById('osdClock');
  D.osdProgWrap = document.getElementById('osdProgressWrap');
  D.osdCur      = document.getElementById('osdCurrentTime');
  D.osdDur      = document.getElementById('osdDuration');
  D.osdFill     = document.getElementById('osdProgressFill');
  D.osdPrev     = document.getElementById('osdBtnPrevEp');
  D.osdNext     = document.getElementById('osdBtnNextEp');
  D.osdPlayPause= document.getElementById('osdBtnPlayPause');
  D.osdFavBtn   = document.getElementById('osdBtnFav');
  D.spinner     = document.getElementById('tvBufferingSpinner');

  D.detailModal = document.getElementById('tvDetailModal');
  D.detailPoster= document.getElementById('detailPoster');
  D.detailTitle = document.getElementById('detailTitle');
  D.detailGenre = document.getElementById('detailGenre');
  D.detailRating= document.getElementById('detailRating');
  D.detailPlot  = document.getElementById('detailPlot');
  D.detailSeasons=document.getElementById('detailSeasonsList');
  D.detailEps   = document.getElementById('detailEpisodesList');

  D.cfgServer   = document.getElementById('cfgServer');
  D.btnCloseQr  = document.getElementById('btnCloseQrRemote');

  // Ensure preview and fs video are hidden
  if (D.prevVid) D.prevVid.style.display='none';
  if (D.fsVid)   D.fsVid.style.display='none';

  // OSD buttons
  if (D.osdPlayPause) D.osdPlayPause.onclick=function(){ if(AV._state==='PLAYING') AV.pause(); else AV.resume(); };
  if (D.osdPrev)      D.osdPrev.onclick=function(){ _prevEp(); };
  if (D.osdNext)      D.osdNext.onclick=function(){ _nextEp(); };
  if (D.osdFavBtn)    D.osdFavBtn.onclick=function(){ _toggleFav(); };

  // OSD clicking shows it
  if (D.fsOsd) D.fsOsd.onclick=function(){ _osdShow(); };

  // Back button
  if (D.topBack) D.topBack.onclick=function(){ showView('home'); };
  if (D.topSync) D.topSync.onclick=function(){ if(S.activePl) syncPlaylist(S.activePl); };

  // Home sync button
  var hsBtn=document.getElementById('homeSyncBtn');
  if (hsBtn) hsBtn.onclick=function(){ if(S.activePl) syncPlaylist(S.activePl); };

  // Home dock card clicks
  var cards = {
    cardLive: 'live',
    cardSeries: 'series',
    cardMovies: 'movies',
    cardFavorites: 'favorites',
    cardSettings: 'settings'
  };
  Object.keys(cards).forEach(function(id){
    var el = document.getElementById(id);
    if (el) {
      el.onclick = function(){
        if (id !== 'cardSettings' && S.isSyncing && !S.live.length && !S.movies.length && !S.series.length) {
          toast(t('syncing'));
          return;
        }
        showView(cards[id]);
      };
    }
  });

  // Add/Edit playlist form
  var btnAdd=document.getElementById('btnOpenAddPlaylist');
  if (btnAdd) btnAdd.onclick=function(){ _openEditPlaylist(null); };
  var btnClose=document.getElementById('btnCloseAddPlaylist');
  if (btnClose) btnClose.onclick=function(){ _closeModal(); };

  var btnTogglePass = document.getElementById('btnTogglePass');
  if (btnTogglePass) {
    btnTogglePass.onclick = function() {
      var passInput = document.getElementById('cfgPass');
      if (passInput) {
        if (passInput.type === 'password') {
          passInput.type = 'text';
          btnTogglePass.textContent = 'HIDE';
        } else {
          passInput.type = 'password';
          btnTogglePass.textContent = 'SHOW';
        }
      }
    };
  }

  var btnSave=document.getElementById('btnSavePlaylist');
  if (btnSave) btnSave.onclick=function(){
    var name=(document.getElementById('cfgPlName')||{}).value||'My IPTV';
    var srv =(document.getElementById('cfgServer')||{}).value||'';
    var usr =(document.getElementById('cfgUser')||{}).value||'';
    var pass=(document.getElementById('cfgPass')||{}).value||'';
    if (!srv||!usr||!pass) { toast('Enter Server, Username and Password'); return; }

    if (S.editingPlId) {
      var targetPl = S.playlists.find(function(x){ return x.id === S.editingPlId; });
      if (targetPl) {
        targetPl.name = name.trim() || 'IPTV';
        targetPl.server = srv.trim();
        targetPl.user = usr.trim();
        targetPl.pass = pass.trim();
        savePl();
        toast('✓ ' + t('edit_playlist') + ' ' + targetPl.name);
        _renderSettings();
        if (S.activePl && S.activePl.id === targetPl.id) {
          S.activePl = targetPl;
          syncPlaylist(targetPl);
        }
      }
      S.editingPlId = null;
      _closeModal();
      return;
    }

    var np={id:'pl'+Date.now(), name:name.trim()||'IPTV', server:srv.trim(), user:usr.trim(), pass:pass.trim()};
    S.playlists.push(np); S.activePl=np; savePl();
    _renderSettings();
    _closeModal();
    syncPlaylist(np, function(){ showView('live'); });
  };

  // Preview overlay → fullscreen
  var prevBtn=document.getElementById('previewOverlayBtn');
  if (prevBtn) prevBtn.onclick=function(){ if(S.activeCh) _openFs(S.activeCh,0); };

  // QR Remote close
  if (D.btnCloseQr) D.btnCloseQr.onclick=function(){ _closeModal(); };

  // Detail modal close
  var dClose=document.getElementById('btnDetailClose');
  if (dClose) dClose.onclick=function(){ _closeModal(); };

  // Clear cache
  var btnClear=document.getElementById('btnClearCache');
  if (btnClear) btnClear.onclick=function(){ S.history={}; saveHist(); toast(t('cache_ok')); };

  // Clock
  setInterval(_clock, 30000);
  _clock();

  // Lightweight companion check
  setInterval(_pollRemote, 10000);

  // Boot
  applyLang(S.lang);
  _updateCounts();
  _updateStatus();

  window.onNativePreviewFullscreenClosed = _closeFs;
  window.closeFullscreen = _closeFs;
  window.handleRemoteAction = _handleRemote;
  window.importPlaylistFromPhone = importPlaylistFromPhone;
  window._openSeriesDetail = _openSeriesDetail;
  window._openMovieDetail = _openMovieDetail;
  window.S = S;

  if (S.activePl) {
    syncPlaylist(S.activePl);
  } else {
    showView('home');
  }
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
