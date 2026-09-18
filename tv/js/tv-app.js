/**
 * NidalPlayer v5.6.2 — Samsung Smart TV (Tizen 4+)
 * High-Performance Smart TV Media Engine
 */
(function () {
'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────────────
var COMPANION = 'http://192.168.11.126:8765';

var PREVIEW_RECT = { x: 1128, y: 100, w: 764, h: 440 };
var FS_RECT      = { x: 0,    y: 0,   w: 1920, h: 1080 };

// ── STATE ──────────────────────────────────────────────────────────────────
var S = {
  lang: 'en', view: 'home',
  playlists: [], activePl: null,
  favs: {}, history: {},
  live: [], movies: [], series: [],
  liveCats: [], movieCats: [], seriesCats: [],
  selCat: { live: 'ALL', movies: 'ALL', series: 'ALL' },
  activeCh: null, activeItem: null,
  seriesEps: [], epIdx: -1,
  isFs: false, isSyncing: false,
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

// ── i18n ───────────────────────────────────────────────────────────────────
var TR = {
  en: {
    syncing:'↻ Syncing playlist from server…',
    ready:'✓ Ready to watch',
    ready_c:'✓ {c} Channels • {m} Movies • {s} Series',
    no_pl:'⚡ Add a playlist to get started',
    sync:'↻ SYNC', status:'STATUS:', pl_label:'PLAYLIST:',
    all_ch:'ALL CHANNELS', all_mv:'ALL MOVIES', all_sr:'ALL SERIES',
    cats:'CATEGORIES', mv_genres:'MOVIE GENRES', sr_genres:'SERIES GENRES',
    live_prev:'LIVE PREVIEW', now_pl:'NOW PLAYING',
    expand:'PRESS OK FOR FULLSCREEN',
    fav_add:'★ Added to Favorites', fav_rem:'Removed from Favorites',
    sync_done:'Sync complete', cache_ok:'Cache cleared',
    no_stream:'No stream URL available',
    prev_ep:'PREV EP', next_ep:'NEXT EP', pause:'PAUSE', play:'PLAY',
    fav:'FAVORITE', back:'Back',
    ep_last:'Last episode reached', ep_first:'Already first episode'
  }
};
function t(k, vars) {
  var d = TR[S.lang] || TR.en;
  var s = d[k] || TR.en[k] || k;
  if (vars) Object.keys(vars).forEach(function(v){ s = s.replace('{'+v+'}', vars[v]); });
  return s;
}

// ── STORAGE ────────────────────────────────────────────────────────────────
function load() {
  try {
    var p = localStorage.getItem('np_pl'); if (p) S.playlists = JSON.parse(p);
    var id= localStorage.getItem('np_apid');
    S.activePl = S.playlists.find(function(x){ return x.id===id; }) || S.playlists[0] || null;
    var f = localStorage.getItem('np_fav'); if (f) S.favs = JSON.parse(f);
    var h = localStorage.getItem('np_hist');if (h) S.history = JSON.parse(h);
    S.lang = localStorage.getItem('np_lang') || 'en';
  } catch(e){}
}
function savePl()   { try{ localStorage.setItem('np_pl', JSON.stringify(S.playlists)); localStorage.setItem('np_apid', S.activePl?S.activePl.id:''); }catch(e){} }
function saveFav()  { try{ localStorage.setItem('np_fav', JSON.stringify(S.favs)); }catch(e){} }
function saveHist() { try{ localStorage.setItem('np_hist',JSON.stringify(S.history)); }catch(e){} }

// ── AVPLAY ENGINE ──────────────────────────────────────────────────────────
var AV = {
  _state: 'NONE',
  _url: '',
  supported: function(){ return !!(window.webapis && window.webapis.avplay); },

  play: function(url, rect, isLive) {
    var self = this;
    if (!url) { toast(t('no_stream')); logTV('AV.play skipped: no URL'); return; }

    // Normalize URL scheme: AVPlay strictly rejects "Http://" (uppercase H)
    url = url.trim().replace(/^[A-Za-z]+:\/\//, function(m){ return m.toLowerCase(); });
    var hlsUrl = url.replace(/\.ts$/i, '.m3u8');

    logTV('AV.play request', { url: url, hlsUrl: hlsUrl, isLive: isLive, isFs: rect === FS_RECT, hasAVPlay: self.supported() });

    self._teardown();

    if (!self.supported()) {
      logTV('AVPlay not supported in this runtime, using HTML5 video');
      _html5Play(isLive ? hlsUrl : url, isLive, rect === FS_RECT);
      return;
    }

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
  },

  seekRel: function(delta) {
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
    if (!this.supported()) return;
    try { webapis.avplay.pause(); this._state = 'PAUSED'; logTV('AVPlay paused'); } catch(e){}
  },

  resume: function() {
    if (!this.supported()) return;
    try { webapis.avplay.play(); this._state = 'PLAYING'; logTV('AVPlay resumed'); } catch(e){}
  },

  _teardown: function() {
    if (!this.supported()) return;
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
    S.history[S.activeItem._id] = { t: cur, d: dur, ts: Date.now() };
    saveHist();
  }
}
function _fmt(s) { s=Math.floor(s); return (s<3600 ? '' : Math.floor(s/3600)+':')+(Math.floor((s%3600)/60)<10?'0':'')+Math.floor((s%3600)/60)+':'+(s%60<10?'0':'')+(s%60); }

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

  Promise.all([
    _json(api+'&action=get_live_categories',8000).then(function(d){ mapCats(d,lm); }).catch(function(){}),
    _json(api+'&action=get_vod_categories',8000).then(function(d){  mapCats(d,mm); }).catch(function(){}),
    _json(api+'&action=get_series_categories',8000).then(function(d){ mapCats(d,sm); }).catch(function(){})
  ]).then(function() {
    return Promise.all([
      _json(api+'&action=get_live_streams',25000).then(function(d){
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

      _json(api+'&action=get_vod_streams',25000).then(function(d){
        S.movieCats=['ALL','FAVORITES'];
        var seen={};
        S.movies=(d||[]).map(function(x){
          var cid=String(x.category_id||'');
          var grp=mm[cid]||x.category_name||'Movie';
          if(!seen[grp]){seen[grp]=1;S.movieCats.push(grp);}
          var sid=x.stream_id||x.id;
          var ext=x.container_extension||'mp4';
          return { _id:String(sid), _type:'movie',
            name:x.name||x.title||'Movie', logo:x.stream_icon||'',
            grp:grp, rating:x.rating||'7', year:x.year||'',
            url:b+'/movie/'+u+'/'+p+'/'+sid+'.'+ext };
        });
      }).catch(function(e){ logTV('get_vod_streams error', e ? e.message : e); }),

      _json(api+'&action=get_series',25000).then(function(d){
        S.seriesCats=['ALL','FAVORITES'];
        var seen={};
        S.series=(d||[]).map(function(x){
          var cid=String(x.category_id||'');
          var grp=sm[cid]||x.category_name||'Series';
          if(!seen[grp]){seen[grp]=1;S.seriesCats.push(grp);}
          return { _id:String(x.series_id||x.id), _type:'series',
            name:x.name||x.title||'Series', logo:x.cover||x.stream_icon||'',
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
  ['viewHome','viewLive','viewMovies','viewSeries','viewSettings'].forEach(function(id){
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
  } else if (name==='movies') {
    document.getElementById('viewMovies').classList.remove('hidden');
    _renderMovies();
  } else if (name==='series') {
    document.getElementById('viewSeries').classList.remove('hidden');
    _renderSeries();
  } else if (name==='settings') {
    document.getElementById('viewSettings').classList.remove('hidden');
    _renderSettings();
  } else if (name==='favorites') {
    S.selCat.live='FAVORITES';
    S.view='live';
    document.getElementById('viewLive').classList.remove('hidden');
    _renderLive();
  }
  if (D.topPageTitle) D.topPageTitle.textContent = name.toUpperCase();
}

// ── STATUS / COUNTS ────────────────────────────────────────────────────────
function _updateStatus() {
  var pl = S.activePl;
  var text, cls;
  if (S.isSyncing) {
    text = t('syncing'); cls = 'syncing';
  } else if (pl && S.live.length) {
    text = t('ready_c',{c:S.live.length,m:S.movies.length,s:S.series.length}); cls = 'ready';
  } else if (pl) {
    text = t('ready'); cls = 'ready';
  } else {
    text = t('no_pl'); cls = '';
  }
  if (D.bannerText)  D.bannerText.textContent = text;
  if (D.bannerBadge) D.bannerBadge.className  = 'sync-banner-badge ' + cls;
  if (D.statusText)  D.statusText.textContent  = text;
  if (D.statusDot)   D.statusDot.className     = 'pill-dot ' + cls;
  var dock = document.getElementById('homeDock');
  if (dock) {
    dock.style.opacity = S.isSyncing ? '0.35' : '1';
    dock.style.pointerEvents = S.isSyncing ? 'none' : '';
  }
}
function _updateCounts() {
  var pl = S.activePl;
  if (D.plName)    D.plName.textContent    = pl ? pl.name : 'No Playlist';
  if (D.badgeLive) D.badgeLive.textContent = S.live.length+' CHANNELS';
  if (D.badgeMov)  D.badgeMov.textContent  = S.movies.length+' MOVIES';
  if (D.badgeSer)  D.badgeSer.textContent  = S.series.length+' SHOWS';
  if (D.badgeFav)  D.badgeFav.textContent  = Object.keys(S.favs).length+' SAVED';
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
  if (D.liveCatTitle) D.liveCatTitle.textContent = cat==='ALL' ? t('all_ch') : cat==='FAVORITES' ? '★ Favorites' : cat;

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

  var rect = getPreviewRect();
  var url = ch.url || ch.hls || '';
  logTV('_previewCh starting for ' + ch.name, { url: url, rect: rect });
  AV.play(url, rect, true);
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
function _renderMovieGrid() {
  if (!D.movieGrid) return;
  D.movieGrid.innerHTML='';
  var cat=S.selCat.movies;
  if (D.movieCatTitle) D.movieCatTitle.textContent = cat==='ALL'?t('all_mv'):cat==='FAVORITES'?'★ Favorites':cat;
  var items = _filter(S.movies, cat);
  var frag = document.createDocumentFragment();
  items.slice(0,48).forEach(function(m){
    var c = _posterCard(m, function(){
      S.activeItem=m;
      var hist = S.history[m._id];
      _openFs(m, hist?hist.t:0);
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
  var cat=S.selCat.series;
  if (D.serCatTitle) D.serCatTitle.textContent = cat==='ALL'?t('all_sr'):cat==='FAVORITES'?'★ Favorites':cat;
  var items=_filter(S.series,cat);
  var frag=document.createDocumentFragment();
  items.slice(0,48).forEach(function(s){
    var c=_posterCard(s,function(){ _openSeriesDetail(s); });
    frag.appendChild(c);
  });
  D.serGrid.appendChild(frag);
}

function _openSeriesDetail(s) {
  S.activeItem=s;
  var pl=S.activePl; if (!pl) return;
  var b=pl.server.replace(/\/+$/,'');
  var u=encodeURIComponent(pl.user), p=encodeURIComponent(pl.pass);
  _json(b+'/player_api.php?username='+u+'&password='+p+'&action=get_series_info&series_id='+s._id, 10000)
  .then(function(info){
    if (D.detailPoster)  { D.detailPoster.src=s.logo||'icon.png'; D.detailPoster.onerror=function(){ this.src='icon.png'; }; }
    if (D.detailTitle)   D.detailTitle.textContent  = s.name;
    if (D.detailGenre)   D.detailGenre.textContent  = s.grp;
    if (D.detailRating)  D.detailRating.textContent = '★ '+s.rating;
    if (D.detailPlot)    D.detailPlot.textContent   = (info&&info.info&&info.info.plot)||'Browse seasons below.';

    var eps=(info&&info.episodes)||{};
    var seasons=Object.keys(eps);
    if (D.detailSeasons) D.detailSeasons.innerHTML='';
    if (D.detailEps)     D.detailEps.innerHTML='';

    seasons.forEach(function(sn, idx){
      var btn=document.createElement('button');
      btn.className='tv-btn-pill focusable'+(idx===0?' active':'');
      btn.tabIndex=0;
      btn.textContent='S'+sn;
      btn.onclick=function(){
        D.detailSeasons.querySelectorAll('.tv-btn-pill').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        _renderEps(eps[sn], b, pl.user, pl.pass);
      };
      if (D.detailSeasons) D.detailSeasons.appendChild(btn);
    });
    if (seasons.length) _renderEps(eps[seasons[0]], b, pl.user, pl.pass);
    _openModal('tvDetailModal');
  }).catch(function(){ toast('Could not load series info'); });
}

function _renderEps(list, base, user, pass) {
  if (!D.detailEps||!Array.isArray(list)) return;
  D.detailEps.innerHTML='';
  S.seriesEps=list.map(function(ep){
    var ext=ep.container_extension||'mp4';
    return { _id:String(ep.id), _type:'series',
      name:(S.activeItem?S.activeItem.name+' – ':'')+('E'+(ep.episode_num||ep.id)),
      logo:S.activeItem?S.activeItem.logo:'',
      url:base+'/series/'+encodeURIComponent(user)+'/'+encodeURIComponent(pass)+'/'+ep.id+'.'+ext,
      ep_num:ep.episode_num };
  });
  var frag=document.createDocumentFragment();
  S.seriesEps.forEach(function(ep, idx){
    var row=document.createElement('div');
    row.className='detail-ep-row focusable';
    row.tabIndex=0;
    row.innerHTML='<div class="ep-info"><b>EP '+(ep.ep_num||idx+1)+'</b> '+_esc(ep.name)+'</div><div class="ep-play">▶ Play</div>';
    row.onclick=function(){ _closeModal(); S.epIdx=idx; _openFs(ep,0); };
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

  var streamUrl = (item.url || item.hls || '').trim().replace(/^[A-Za-z]+:\/\//, function(m){ return m.toLowerCase(); });

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
  else if (id==='modalAddPlaylist') { if (D.cfgServer) focus(D.cfgServer); }
  else if (id==='tvDetailModal')   { setTimeout(function(){ var a=document.querySelector('#detailSeasonsList .tv-btn-pill'); if(a) focus(a); },60); }
}
function _closeModal() {
  if (!S.modal) return;
  var el=document.getElementById(S.modal); if (el) el.classList.add('hidden');
  S.modal=null;
}

function _qr(containerId, size) {
  var el=document.getElementById(containerId); if (!el||!window.QRCode) return;
  el.innerHTML='';
  new QRCode(el,{ text:COMPANION+'/tv', width:size, height:size,
    colorDark:'#000', colorLight:'#fff', correctLevel:QRCode.CorrectLevel.M });
}

// ── SETTINGS ───────────────────────────────────────────────────────────────
function _renderSettings() {
  _qr('settingsQrCode', 150);
  var list=document.getElementById('savedPlaylistsList');
  if (list) {
    list.innerHTML='';
    if (!S.playlists.length) { list.innerHTML='<div style="color:var(--text-dim);padding:16px;">No playlists. Add one below.</div>'; }
    S.playlists.forEach(function(p){
      var row=document.createElement('div');
      row.className='saved-pl-item focusable'+(S.activePl&&S.activePl.id===p.id?' active':'');
      row.tabIndex=0;
      row.innerHTML='<div><strong>'+_esc(p.name)+'</strong><br><small style="color:var(--text-dim)">'+_esc(p.server)+'</small></div>'
        +'<button class="tv-btn-pill'+(S.activePl&&S.activePl.id===p.id?' active':'')+'">'+
        (S.activePl&&S.activePl.id===p.id?'ACTIVE':'USE')+'</button>';
      row.onclick=function(){
        S.activePl=p; savePl();
        _renderSettings();
        syncPlaylist(p, function(){ showView('live'); });
      };
      list.appendChild(row);
    });
  }
  document.querySelectorAll('#langPillsRow .tv-btn-pill').forEach(function(b){
    b.onclick=function(){
      S.lang=b.dataset.lang||'en';
      try{ localStorage.setItem('np_lang',S.lang); }catch(e){}
    };
  });
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

    if (c === 8 || k === 'Backspace' || k === 'Delete' || c === 46) {
      return;
    }

    var digit = null;
    if (c >= 48 && c <= 57) digit = String(c - 48);
    else if (c >= 96 && c <= 105) digit = String(c - 96);
    else if (k.length === 1 && !isNaN(k) && k >= '0' && k <= '9') digit = k;

    if (digit !== null) {
      setTimeout(function() {
        if (!inp.value.endsWith(digit)) {
          var start = inp.selectionStart || inp.value.length;
          var end = inp.selectionEnd || inp.value.length;
          inp.value = inp.value.slice(0, start) + digit + inp.value.slice(end);
          inp.setSelectionRange(start + 1, start + 1);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 10);
      return;
    }

    if (c === 38) { e.preventDefault(); _nav('UP'); return; }
    if (c === 40) { e.preventDefault(); _nav('DOWN'); return; }
    if (c === 37 || c === 39) { return; }
    if (c === 13 || c === 29443) { e.preventDefault(); _nav('DOWN'); return; }

    if (c === 27 || c === 10009 || k === 'XF86Back') {
      e.preventDefault();
      _closeModal();
      return;
    }
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

function _nav(dir) {
  var all=Array.from(document.querySelectorAll('.focusable')).filter(function(el){
    if (S.modal) { var m=document.getElementById(S.modal); return m&&m.contains(el)&&el.offsetParent!==null&&!el.disabled; }
    return el.offsetParent!==null&&!el.disabled&&!el.closest('.hidden');
  });
  var cur=document.activeElement;
  if (!cur||all.indexOf(cur)<0) { if(all[0]) focus(all[0]); return; }
  var cr=cur.getBoundingClientRect(), cx=cr.left+cr.width/2, cy=cr.top+cr.height/2;
  var best=null, best_d=Infinity;
  all.forEach(function(c2){
    if (c2===cur) return;
    var r=c2.getBoundingClientRect(), tx=r.left+r.width/2, ty=r.top+r.height/2;
    var dx=tx-cx, dy=ty-cy, valid=false;
    if (dir==='UP'&&dy<-5) valid=true;
    if (dir==='DOWN'&&dy>5) valid=true;
    if (dir==='LEFT'&&dx<-5) valid=true;
    if (dir==='RIGHT'&&dx>5) valid=true;
    if (!valid) return;
    var d=Math.sqrt(dx*dx+dy*dy)+(dir==='UP'||dir==='DOWN'?Math.abs(dx)*2:Math.abs(dy)*2);
    if (d<best_d) { best_d=d; best=c2; }
  });
  if (best) focus(best);
}

function focus(el) {
  if (!el) return;
  document.querySelectorAll('.focusable.focused').forEach(function(f){ f.classList.remove('focused'); });
  el.classList.add('focused');
  el.focus();
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

// ── FAVORITES ──────────────────────────────────────────────────────────────
function _toggleFav() {
  var item=S.activeItem; if (!item) return;
  if (S.favs[item._id]) delete S.favs[item._id]; else S.favs[item._id]=1;
  saveFav(); _updateCounts();
  toast(S.favs[item._id] ? t('fav_add') : t('fav_rem'));
}

// ── COMPANION REMOTE ───────────────────────────────────────────────────────
function _pushRemote() {
  var pl = S.activePl;
  var payload = {
    target: 'tizen',
    device: 'tizen',
    view: S.view,
    syncing: S.isSyncing,
    activePlaylistId: pl ? pl.id : '',
    activePlaylistName: pl ? pl.name : '',
    playlists: S.playlists.map(function(p) {
      return { id: p.id, name: p.name, server: p.server, itemCount: S.live.length };
    }),
    categories: {
      live: S.liveCats || ['ALL', 'FAVORITES'],
      movies: S.movieCats || ['ALL', 'FAVORITES'],
      series: S.seriesCats || ['ALL', 'FAVORITES']
    },
    channels: S.live.slice(0, 300).map(function(x) {
      return { id: x._id, name: x.name, group: x.grp, logo: x.logo, num: x.num, type: 'live' };
    }),
    movies: S.movies.slice(0, 150).map(function(x) {
      return { id: x._id, name: x.name, group: x.grp, logo: x.logo, type: 'movie' };
    }),
    series: S.series.slice(0, 150).map(function(x) {
      return { id: x._id, name: x.name, group: x.grp, logo: x.logo, type: 'series' };
    }),
    totalCounts: {
      channels: S.live.length,
      movies: S.movies.length,
      series: S.series.length
    },
    playback: {
      status: S.isFs ? (AV._state === 'PAUSED' ? 'paused' : 'playing') : 'ready',
      title: S.activeItem ? S.activeItem.name : '',
      group: S.activeItem ? S.activeItem.grp : '',
      type: S.activeItem ? S.activeItem._type : 'live',
      isFs: S.isFs
    }
  };

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
        if (p.server&&p.user&&p.pass&&!S.playlists.find(function(x){ return x.server===p.server&&x.user===p.user; })){
          var np={id:'pl'+Date.now(),name:p.title||p.name||'Phone Playlist',server:p.server,user:p.user,pass:p.pass};
          S.playlists.push(np); S.activePl=np; savePl();
          syncPlaylist(np);
        }
      });
    }
  }).catch(function(){});
}

function _handleRemote(act) {
  if (!act) return;
  var type=act.type||act.action, id=String(act.itemId||act.id||act.streamId||'');
  logTV('_handleRemote received action: ' + type, act);

  if (type==='playItem'||type==='selectChannel'||type==='playChannel') {
    var found=S.live.find(function(x){ return x._id===id; })||
              S.movies.find(function(x){ return x._id===id; })||
              S.series.find(function(x){ return x._id===id; });
    if (found) {
      if(found._type==='series') _openSeriesDetail(found);
      else _openFs(found,0);
    }
    return;
  }
  if (type==='togglePlay'||type==='play'||type==='pause') {
    if (AV._state==='PLAYING') AV.pause(); else AV.resume();
    return;
  }
  if (type==='toggleFullscreen') {
    if (S.isFs) _closeFs();
    else if (S.activeCh) _openFs(S.activeCh, 0);
    return;
  }
  if (type==='switchView'||type==='navTab') {
    if (act.view) showView(act.view);
    return;
  }
  if (type==='selectPlaylist' && act.playlistId) {
    var p = S.playlists.find(function(x){ return x.id === act.playlistId; });
    if (p) {
      S.activePl = p;
      savePl();
      syncPlaylist(p);
    }
    return;
  }
  if (type==='toggleFavorite' && id) {
    if (S.favs[id]) delete S.favs[id]; else S.favs[id]=1;
    saveFav(); _updateCounts();
    return;
  }
  if (type==='seek') {
    if (act.relative) AV.seekRel(act.relative);
    else if (typeof act.time === 'number') {
      try { webapis.avplay.seekTo(Math.round(act.time * 1000)); } catch(e){}
    }
    return;
  }
  if (type==='playNextEpisode') { _nextEp(); return; }
  if (type==='playPrevEpisode') { _prevEp(); return; }

  if (type==='tvKey'||type==='dpad'||type==='key') {
    var kk=String(act.key||'').toUpperCase();
    if (kk==='UP')    _nav('UP');
    else if (kk==='DOWN')  _nav('DOWN');
    else if (kk==='LEFT')  { if(S.isFs) AV.seekRel(-10); else _nav('LEFT'); }
    else if (kk==='RIGHT') { if(S.isFs) AV.seekRel(10);  else _nav('RIGHT'); }
    else if (kk==='OK'||kk==='ENTER') { var ae=document.activeElement; if(ae&&ae.click) ae.click(); }
    else if (kk==='BACK') { if(S.isFs) _closeFs(); else if(S.modal) _closeModal(); else if(S.view!=='home') showView('home'); }
    else if (kk==='PLAY_PAUSE') { if(AV._state==='PLAYING') AV.pause(); else AV.resume(); }
    else if (kk==='NEXT') _nextEp();
    else if (kk==='PREV') _prevEp();
  }
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function _filter(list, cat) {
  if (cat==='ALL') return list;
  if (cat==='FAVORITES') return list.filter(function(x){ return !!S.favs[x._id]; });
  return list.filter(function(x){ return x.grp===cat; });
}
function _catBtn(cat, active, onclick) {
  var btn=document.createElement('button');
  btn.className='tv-cat-btn focusable'+(active?' active':'');
  btn.tabIndex=0;
  btn.innerHTML='<span>'+_esc(cat==='ALL'?'ALL':cat==='FAVORITES'?'★ Favorites':cat)+'</span>';
  btn.onclick=onclick;
  return btn;
}
function _posterCard(item, onclick) {
  var c=document.createElement('div');
  c.className='tv-poster-card focusable'; c.tabIndex=0;
  c.innerHTML=
    '<div class="poster-img-wrap">'+
      '<img class="poster-img" src="'+(item.logo||'icon.png')+'" onerror="this.src=\'icon.png\'" alt="" loading="lazy">'+
      '<span class="poster-rating">★ '+_esc(item.rating||'?')+'</span>'+
    '</div>'+
    '<div class="poster-meta">'+
      '<div class="poster-title">'+_esc(item.name)+'</div>'+
      '<div class="poster-sub">'+_esc(item.year||item.grp||'')+'</div>'+
    '</div>';
  c.onclick=onclick;
  return c;
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
  var cards={cardLive:'live',cardSeries:'series',cardMovies:'movies',cardSettings:'settings',cardFavorites:'favorites'};
  Object.keys(cards).forEach(function(id){
    var el=document.getElementById(id);
    if (el) el.onclick=function(){ if(!S.isSyncing) showView(cards[id]); };
  });
  var cardPl=document.getElementById('cardPlaylist');
  if (cardPl) cardPl.onclick=function(){ showView('settings'); setTimeout(function(){ _openModal('modalAddPlaylist'); },100); };

  // Add playlist form
  var btnAdd=document.getElementById('btnOpenAddPlaylist');
  if (btnAdd) btnAdd.onclick=function(){ _openModal('modalAddPlaylist'); };
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
    var np={id:'pl'+Date.now(), name:name.trim()||'IPTV', server:srv.trim(), user:usr.trim(), pass:pass.trim()};
    S.playlists.push(np); S.activePl=np; savePl();
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

  // Companion remote polling
  setInterval(_pollRemote, 600);
  setInterval(_pushRemote, 2500);

  // Boot
  _updateCounts();
  _updateStatus();

  logTV('tv-app.js initialized successfully', { hasPlaylist: Boolean(S.activePl) });

  if (S.activePl) {
    syncPlaylist(S.activePl, function(){ showView('home'); });
  } else {
    showView('home');
  }
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
