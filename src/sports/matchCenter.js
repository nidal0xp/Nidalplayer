/**
 * Sports Match Center for Nidalplayer Desktop (Windows / Electron)
 * Fetches Live & Upcoming fixtures for Top 5 Football Leagues:
 * - English Premier League (4328)
 * - Spanish La Liga (4335)
 * - Italian Serie A (4332)
 * - German Bundesliga (4331)
 * - French Ligue 1 (4334)
 * - UEFA Champions League (4480)
 * 
 * Matches scheduled fixtures against the user's active IPTV channels using:
 * 1. Team names & nicknames in channel title / EPG
 * 2. League primary broadcaster signatures (beIN, Sky, TNT, DAZN, Canal+, Movistar, SuperSport)
 * 3. Sports categories in active playlist
 */

export const TOP_5_LEAGUES = [
  { id: 'all', name: 'ALL TOP 5 LEAGUES', leagueId: null, icon: '⚽' },
  { id: 'epl', name: 'PREMIER LEAGUE', leagueId: '4328', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', leagueName: 'English Premier League' },
  { id: 'laliga', name: 'LA LIGA', leagueId: '4335', icon: '🇪🇸', leagueName: 'Spanish La Liga' },
  { id: 'seriea', name: 'SERIE A', leagueId: '4332', icon: '🇮🇹', leagueName: 'Italian Serie A' },
  { id: 'bundesliga', name: 'BUNDESLIGA', leagueId: '4331', icon: '🇩🇪', leagueName: 'German Bundesliga' },
  { id: 'ligue1', name: 'LIGUE 1', leagueId: '4334', icon: '🇫🇷', leagueName: 'French Ligue 1' },
  { id: 'ucl', name: 'CHAMPIONS LEAGUE', leagueId: '4480', icon: '🏆', leagueName: 'UEFA Champions League' }
];

// Broadcaster keyword mapping per league for intelligent channel discovery
const LEAGUE_BROADCASTER_MAP = {
  '4328': ['sky sports', 'tnt sports', 'bein sports', 'canal+ premier', 'optus', 'peacock', 'supersport premier', 'astro supersport', 'dazn', 'premier sports', 'nbcsn', 'usa network'],
  '4335': ['movistar laliga', 'dazn laliga', 'bein sports', 'laliga tv', 'espn+', 'supersport laliga', 'canal+ foot', 'premier sports', 'eleven sports'],
  '4332': ['sky sport calcio', 'sky sport serie a', 'dazn', 'bein sports', 'tnt sports', 'supersport football', 'paramount+', 'cbs sports golazo'],
  '4331': ['sky sport bundesliga', 'dazn', 'bein sports', 'canal+ sport', 'supersport bundesliga', 'sony sports', 'espn+'],
  '4334': ['dazn', 'bein sports', 'canal+ foot', 'canal+ sport 360', 'supersport', 'amazon prime'],
  '4480': ['tnt sports', 'canal+ foot', 'bein sports', 'movistar liga de campeones', 'dazn', 'paramount+', 'supersport champions', 'sky sport austria']
};

export class SportsMatchCenter {
  constructor() {
    this.matchesCache = [];
    this.lastFetched = 0;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  isMatchRelevant(match) {
    if (!match) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // If the match was from yesterday/earlier, drop it after 00:00 midnight
    if (match.dateStr && match.dateStr < todayStr && !match.isLive) {
      return false;
    }

    // Keep today's matches (live, upcoming, or finished earlier today)
    if (match.isLive) return true;
    if (match.dateStr === todayStr) return true;

    // Keep upcoming matches for the next 4 days
    const nowMs = Date.now();
    const matchTime = match.timestamp || 0;
    const diffHours = (matchTime - nowMs) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 96;
  }

  async fetchTopLeaguesMatches(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.matchesCache.length > 0 && (now - this.lastFetched < this.CACHE_DURATION)) {
      return this.matchesCache;
    }

    const nowDate = new Date();
    const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;

    const leagueConfigs = TOP_5_LEAGUES.filter(l => l.leagueId);
    const fetchPromises = leagueConfigs.map(async (league) => {
      try {
        const nextUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${league.leagueId}`;
        const pastUrl = `https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=${league.leagueId}`;

        const [nextRes, pastRes] = await Promise.all([
          fetch(nextUrl, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(pastUrl, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        const nextEvents = nextRes?.events || [];
        const pastEvents = pastRes?.events || [];
        const allLeagueEvents = [...nextEvents, ...pastEvents];

        return allLeagueEvents
          .map(ev => this.normalizeEvent(ev, league))
          .filter(m => this.isMatchRelevant(m));
      } catch (err) {
        console.warn(`[MatchCenter] Error fetching ${league.name}:`, err);
        return [];
      }
    });

    // Also check today's general soccer schedule
    const dayFetchPromise = (async () => {
      try {
        const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${todayStr}&s=Soccer`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        const events = data?.events || [];
        const matchedDayEvents = [];
        for (const ev of events) {
          const lConfig = leagueConfigs.find(l => 
            l.leagueId === ev.idLeague || 
            (ev.strLeague && ev.strLeague.toLowerCase().includes(l.leagueName.toLowerCase()))
          );
          if (lConfig) {
            matchedDayEvents.push(this.normalizeEvent(ev, lConfig));
          }
        }
        return matchedDayEvents;
      } catch {
        return [];
      }
    })();

    try {
      const results = await Promise.all([...fetchPromises, dayFetchPromise]);
      const allEvents = results.flat();
      
      // Deduplicate by event ID
      const seen = new Set();
      const uniqueEvents = [];
      for (const ev of allEvents) {
        if (!ev || !ev.id || seen.has(ev.id)) continue;
        seen.add(ev.id);
        uniqueEvents.push(ev);
      }

      // Sort: 1) LIVE NOW matches first, 2) today's upcoming matches, 3) future upcoming
      uniqueEvents.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });

      this.matchesCache = uniqueEvents;
      this.lastFetched = Date.now();
      return uniqueEvents;
    } catch (err) {
      console.error('[MatchCenter] Batch fetch failed:', err);
      return this.matchesCache;
    }
  }

  normalizeEvent(ev, league) {
    const rawDate = ev.dateEvent || '';
    const rawTime = ev.strTime || '19:00:00';
    let matchDate = null;
    let timestamp = 0;

    try {
      const cleanTime = rawTime.slice(0, 8);
      const isoStr = `${rawDate}T${cleanTime}Z`;
      matchDate = new Date(isoStr);
      timestamp = matchDate.getTime();
    } catch {
      timestamp = Date.now();
    }

    const homeTeam = String(ev.strHomeTeam || 'Home Team').trim();
    const awayTeam = String(ev.strAwayTeam || 'Away Team').trim();
    const now = Date.now();
    const matchTimeMs = timestamp || now;
    
    // Status check
    const rawStatus = String(ev.strStatus || '').trim();
    const isLiveStatus = ['live', '1h', '2h', 'ht', 'et', 'p', 'in progress'].includes(rawStatus.toLowerCase());
    const isLiveTime = (now >= matchTimeMs - 5 * 60 * 1000) && (now <= matchTimeMs + 125 * 60 * 1000);
    const isLive = isLiveStatus || (isLiveTime && rawStatus !== 'FT' && rawStatus !== 'AET' && rawStatus !== 'Postponed');
    const isFinished = rawStatus === 'FT' || rawStatus === 'AET' || (now > matchTimeMs + 130 * 60 * 1000 && ev.intHomeScore != null);

    const homeScore = ev.intHomeScore != null ? String(ev.intHomeScore) : null;
    const awayScore = ev.intAwayScore != null ? String(ev.intAwayScore) : null;
    const score = (homeScore !== null && awayScore !== null) ? `${homeScore} - ${awayScore}` : null;

    return {
      id: String(ev.idEvent || `${league.id}-${homeTeam}-${awayTeam}`),
      leagueKey: league.id,
      leagueName: league.leagueName || ev.strLeague || league.name,
      leagueIcon: league.icon,
      leagueId: league.leagueId,
      homeTeam,
      awayTeam,
      eventName: ev.strEvent || `${homeTeam} vs ${awayTeam}`,
      homeBadge: ev.strHomeTeamBadge || ev.strThumb || '',
      awayBadge: ev.strAwayTeamBadge || '',
      thumb: ev.strThumb || '',
      dateStr: rawDate,
      timeStr: rawTime.slice(0, 5),
      timestamp,
      isLive,
      isFinished,
      rawStatus,
      homeScore,
      awayScore,
      score,
      round: ev.intRound ? `Round ${ev.intRound}` : '',
      venue: ev.strVenue || ''
    };
  }

  formatMatchTime(match, t = (k) => k) {
    if (match.isLive) {
      return match.score ? `🔴 ${t('live_now') || 'LIVE NOW'} • ${match.score}` : `🔴 ${t('live_now') || 'LIVE NOW'}`;
    }
    if (match.isFinished && match.score) {
      return `${t('full_time') || 'FT'} • ${match.score}`;
    }
    if (match.timestamp) {
      const matchDate = new Date(match.timestamp);
      const now = new Date();
      const isToday = matchDate.getDate() === now.getDate() && matchDate.getMonth() === now.getMonth() && matchDate.getFullYear() === now.getFullYear();
      const hours = matchDate.getHours().toString().padStart(2, '0');
      const mins = matchDate.getMinutes().toString().padStart(2, '0');
      if (isToday) return `${t('today') || 'Today'} • ${hours}:${mins}`;

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = matchDate.getDate() === tomorrow.getDate() && matchDate.getMonth() === tomorrow.getMonth() && matchDate.getFullYear() === tomorrow.getFullYear();
      if (isTomorrow) return `${t('tomorrow') || 'Tomorrow'} • ${hours}:${mins}`;

      const dayKeys = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'];
      const defaultDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayIdx = matchDate.getDay();
      const dayName = t(dayKeys[dayIdx]) || defaultDays[dayIdx];
      return `${dayName} • ${hours}:${mins}`;
    }
    return `${t('today') || 'Today'} • ${match.timeStr || '19:00'}`;
  }

  /**
   * Intelligently find all streaming channels in the user's active playlist
   * that are broadcasting this specific match.
   */
  findChannelsForMatch(match, allChannels = [], epgCache = {}) {
    if (!match || !Array.isArray(allChannels) || allChannels.length === 0) {
      return [];
    }

    const homeLower = match.homeTeam.toLowerCase();
    const awayLower = match.awayTeam.toLowerCase();
    const homeTokens = homeLower.split(/\s+/).filter(t => t.length >= 3);
    const awayTokens = awayLower.split(/\s+/).filter(t => t.length >= 3);

    const leagueBroadcasters = LEAGUE_BROADCASTER_MAP[match.leagueId] || [];

    const exactMatch = [];
    const broadcasterMatch = [];
    const seenChannelIds = new Set();

    for (let i = 0; i < allChannels.length; i++) {
      const ch = allChannels[i];
      if (!ch || !ch.id) continue;
      const chId = String(ch.id);
      if (seenChannelIds.has(chId)) continue;

      const chName = String(ch.name || '').toLowerCase();
      const chGroup = String(ch.group || '').toLowerCase();
      const streamId = String(ch.metadata?.stream_id || ch.id || '').replace(/^(?:live|movie|series)-/, '');
      const epg = epgCache[streamId] || null;
      const epgText = epg ? (epg.full || epg.title || '').toLowerCase() : '';

      // 1. Direct match: Home and/or Away team in channel name or current EPG programme
      const homeInEpg = homeTokens.some(t => epgText.includes(t) || chName.includes(t));
      const awayInEpg = awayTokens.some(t => epgText.includes(t) || chName.includes(t));
      
      if (homeInEpg && awayInEpg) {
        exactMatch.push({ channel: ch, matchReason: 'Direct Match: Both Teams in EPG / Channel', priority: 1, epg });
        seenChannelIds.add(chId);
        continue;
      }
      if (homeInEpg || awayInEpg) {
        exactMatch.push({ channel: ch, matchReason: 'EPG match for ' + (homeInEpg ? match.homeTeam : match.awayTeam), priority: 2, epg });
        seenChannelIds.add(chId);
        continue;
      }

      // 2. Official League Broadcasters (e.g. beIN Sports 1, Sky Sports Premier League, TNT Sports 1)
      const isBroadcaster = leagueBroadcasters.some(b => chName.includes(b));
      if (isBroadcaster) {
        broadcasterMatch.push({ channel: ch, matchReason: 'Official ' + match.leagueName + ' Broadcaster', priority: 3, epg });
        seenChannelIds.add(chId);
      }
    }

    // Return strictly verified channels
    const combined = [...exactMatch, ...broadcasterMatch];
    return combined;
  }
}

export const matchCenter = new SportsMatchCenter();
export default matchCenter;
