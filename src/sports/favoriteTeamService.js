/**
 * Favorite Team Radar Service for Nidalplayer
 * Tracks user's favorite football club, next fixture, kickoff countdown, and recent form
 */

class FavoriteTeamService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 15 * 60 * 1000; // 15 mins
  }

  getFavoriteTeam() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('nidalplayer-fav-team') || '';
    }
    return '';
  }

  setFavoriteTeam(teamName) {
    if (typeof localStorage !== 'undefined') {
      if (teamName) {
        localStorage.setItem('nidalplayer-fav-team', teamName);
      } else {
        localStorage.removeItem('nidalplayer-fav-team');
      }
    }
  }

  async fetchTeamOverview(teamName) {
    const name = String(teamName || '').trim();
    if (!name) return null;

    const cached = this.cache.get(name.toLowerCase());
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      return cached.data;
    }

    try {
      // 1. Search team info & crest
      const sUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(name)}`;
      const sRes = await fetch(sUrl, { cache: 'no-store' });
      let team = null;
      if (sRes.ok) {
        try {
          const sData = await sRes.json();
          team = (sData && sData.teams) ? sData.teams[0] : null;
        } catch(e){}
      }
      if (!team) {
        const fb = _getFallbackTeam(name);
        if (fb) {
          this.cache.set(name.toLowerCase(), { data: fb, timestamp: Date.now() });
          return fb;
        }
        return null;
      }

      let nextMatch = null;
      let recentMatches = [];

      // 2. Query next fixture
      try {
        const nUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${team.idTeam}`;
        const nRes = await fetch(nUrl, { cache: 'no-store' });
        if (nRes.ok) {
          const nData = await nRes.json();
          if (nData.events && nData.events.length > 0) {
            nextMatch = nData.events[0];
          }
        }
      } catch (err) {
        console.warn('[FavoriteTeamService] Next match fetch error:', err);
      }

      // 3. Query recent past results (form)
      try {
        const pUrl = `https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${team.idTeam}`;
        const pRes = await fetch(pUrl, { cache: 'no-store' });
        if (pRes.ok) {
          const pData = await pRes.json();
          recentMatches = (pData.results || []).slice(0, 5);
        }
      } catch (err) {
        console.warn('[FavoriteTeamService] Past matches fetch error:', err);
      }

      // Calculate form
      const form = recentMatches.map(m => {
        const isHome = (m.strHomeTeam || '').toLowerCase().includes(team.strTeam.toLowerCase());
        const myScore = parseInt(isHome ? m.intHomeScore : m.intAwayScore, 10);
        const oppScore = parseInt(isHome ? m.intAwayScore : m.intHomeScore, 10);
        let res = 'D';
        if (!isNaN(myScore) && !isNaN(oppScore)) {
          if (myScore > oppScore) res = 'W';
          else if (myScore < oppScore) res = 'L';
        }
        return {
          result: res,
          score: `${m.intHomeScore || '0'} - ${m.intAwayScore || '0'}`,
          opponent: isHome ? m.strAwayTeam : m.strHomeTeam,
          date: m.dateEvent
        };
      });

      const overview = {
        id: team.idTeam,
        name: team.strTeam,
        badge: team.strBadge || team.strLogo || '',
        stadium: team.strStadium || '',
        league: team.strLeague || '',
        country: team.strCountry || '',
        nextMatch: nextMatch ? {
          id: nextMatch.idEvent,
          eventName: nextMatch.strEvent || `${nextMatch.strHomeTeam} vs ${nextMatch.strAwayTeam}`,
          homeTeam: nextMatch.strHomeTeam,
          awayTeam: nextMatch.strAwayTeam,
          homeBadge: nextMatch.strHomeTeamBadge || '',
          awayBadge: nextMatch.strAwayTeamBadge || '',
          dateStr: nextMatch.dateEvent,
          timeStr: (nextMatch.strTime || '19:00').slice(0, 5),
          round: nextMatch.intRound ? `Round ${nextMatch.intRound}` : '',
          league: nextMatch.strLeague || team.strLeague || 'League'
        } : null,
        form
      };

      this.cache.set(name.toLowerCase(), { data: overview, timestamp: Date.now() });
      return overview;
    } catch (err) {
      console.warn('[FavoriteTeamService] Failed to load team overview:', err);
      const fb = _getFallbackTeam(name);
      if (fb) return fb;
      return null;
    }
  }

  async fetchLeagueStats(teamName) {
    const rawTeam = String(teamName || '').trim();
    const teamKey = rawTeam.toLowerCase();
    const leagueCode = _resolveLeagueCode(teamKey);
    const leagueName = _resolveLeagueName(leagueCode);

    const cacheKey = `stats_${leagueCode}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      return this._decorateWithFavTeam(cached.data, rawTeam);
    }

    try {
      const [stdRes, statsRes] = await Promise.all([
        fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${leagueCode}/standings`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/statistics`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      const entries = stdRes?.children?.[0]?.standings?.entries || [];
      const standings = entries.map(e => {
        const getStat = (n) => e.stats?.find(s => s.name === n)?.value;
        return {
          rank: Number(getStat('rank') || 0),
          team: e.team?.displayName || '',
          short: e.team?.shortDisplayName || e.team?.abbreviation || e.team?.displayName || '',
          logo: e.team?.logos?.[0]?.href || '',
          played: Number(getStat('gamesPlayed') || 0),
          gd: Number(getStat('pointDifferential') || 0),
          pts: Number(getStat('points') || 0)
        };
      });

      const getLeaders = (catIndex) => {
        const cat = statsRes?.stats?.[catIndex];
        return (cat?.leaders || []).slice(0, 10).map((l, i) => ({
          rank: i + 1,
          name: l.athlete?.shortName || l.athlete?.displayName || '',
          team: l.athlete?.team?.shortDisplayName || l.athlete?.team?.abbreviation || '',
          logo: l.athlete?.team?.logos?.[0]?.href || '',
          value: Number(l.value || 0)
        }));
      };

      const scorers = getLeaders(0);
      const assists = getLeaders(1);

      const result = {
        leagueName,
        leagueCode,
        standings: standings.length > 0 ? standings : _getFallbackStandings(leagueCode),
        scorers: scorers.length > 0 ? scorers : _getFallbackScorers(leagueCode),
        assists: assists.length > 0 ? assists : _getFallbackAssists(leagueCode)
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return this._decorateWithFavTeam(result, rawTeam);
    } catch (err) {
      console.warn('[FavoriteTeamService] Error fetching league stats:', err);
      const fallback = {
        leagueName,
        leagueCode,
        standings: _getFallbackStandings(leagueCode),
        scorers: _getFallbackScorers(leagueCode),
        assists: _getFallbackAssists(leagueCode)
      };
      return this._decorateWithFavTeam(fallback, rawTeam);
    }
  }

  _decorateWithFavTeam(data, rawTeam) {
    if (!data) return data;
    const teamNorm = String(rawTeam || '').toLowerCase().trim();
    return {
      ...data,
      favTeamName: rawTeam,
      standings: (data.standings || []).map(s => ({
        ...s,
        isFavTeam: teamNorm ? (s.team.toLowerCase().includes(teamNorm) || teamNorm.includes(s.short.toLowerCase())) : false
      }))
    };
  }
}

function _resolveLeagueCode(rawTeam) {
  const t = String(rawTeam || '').toLowerCase().trim();
  if (t.includes('madrid') || t.includes('barca') || t.includes('barcelona') || t.includes('atletico') || t.includes('sevilla') || t.includes('betis')) {
    return 'esp.1';
  }
  if (t.includes('inter') || t.includes('milan') || t.includes('juve') || t.includes('juventus') || t.includes('napoli') || t.includes('roma') || t.includes('lazio')) {
    return 'ita.1';
  }
  if (t.includes('bayern') || t.includes('dortmund') || t.includes('bvb') || t.includes('leverkusen') || t.includes('leipzig') || t.includes('stuttgart')) {
    return 'ger.1';
  }
  if (t.includes('psg') || t.includes('paris') || t.includes('marseille') || t.includes('monaco') || t.includes('lyon') || t.includes('lille')) {
    return 'fra.1';
  }
  return 'eng.1';
}

function _resolveLeagueName(code) {
  switch (code) {
    case 'esp.1': return 'La Liga';
    case 'ita.1': return 'Serie A';
    case 'ger.1': return 'Bundesliga';
    case 'fra.1': return 'Ligue 1';
    case 'eng.1':
    default:
      return 'Premier League';
  }
}

function _getFallbackStandings(leagueCode) {
  if (leagueCode === 'esp.1') {
    return [
      { rank: 1, team: 'Barcelona', short: 'Barca', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', played: 5, gd: 13, pts: 15 },
      { rank: 2, team: 'Real Madrid', short: 'Real Madrid', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png', played: 5, gd: 7, pts: 11 },
      { rank: 3, team: 'Atlético Madrid', short: 'Atlético', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png', played: 5, gd: 7, pts: 11 },
      { rank: 4, team: 'Villarreal', short: 'Villarreal', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/102.png', played: 5, gd: 3, pts: 11 },
      { rank: 5, team: 'Athletic Club', short: 'Athletic', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/93.png', played: 5, gd: 2, pts: 10 }
    ];
  }
  return [
    { rank: 1, team: 'Manchester City', short: 'Man City', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png', played: 5, gd: 8, pts: 15 },
    { rank: 2, team: 'Arsenal', short: 'Arsenal', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', played: 5, gd: 4, pts: 12 },
    { rank: 3, team: 'Brighton', short: 'Brighton', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/331.png', played: 5, gd: 11, pts: 10 },
    { rank: 4, team: 'Chelsea', short: 'Chelsea', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png', played: 5, gd: 6, pts: 10 },
    { rank: 5, team: 'Liverpool', short: 'Liverpool', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png', played: 5, gd: 5, pts: 10 }
  ];
}

function _getFallbackScorers(leagueCode) {
  if (leagueCode === 'esp.1') {
    return [
      { rank: 1, name: 'Raphinha', team: 'BAR', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', value: 12 },
      { rank: 2, name: 'R. Lewandowski', team: 'BAR', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', value: 10 },
      { rank: 3, name: 'K. Mbappé', team: 'RMA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png', value: 8 },
      { rank: 4, name: 'Vinícius Jr.', team: 'RMA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png', value: 7 },
      { rank: 5, name: 'A. Griezmann', team: 'ATM', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png', value: 6 }
    ];
  }
  return [
    { rank: 1, name: 'E. Haaland', team: 'MNC', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png', value: 9 },
    { rank: 2, name: 'B. Mbeumo', team: 'BRE', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/337.png', value: 5 },
    { rank: 3, name: 'L. Díaz', team: 'LIV', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png', value: 5 },
    { rank: 4, name: 'N. Jackson', team: 'CHE', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png', value: 4 },
    { rank: 5, name: 'B. Saka', team: 'ARS', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', value: 4 }
  ];
}

function _getFallbackAssists(leagueCode) {
  if (leagueCode === 'esp.1') {
    return [
      { rank: 1, name: 'L. Yamal', team: 'BAR', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', value: 5 },
      { rank: 2, name: 'Raphinha', team: 'BAR', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', value: 4 },
      { rank: 3, name: 'Vinícius Jr.', team: 'RMA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png', value: 4 },
      { rank: 4, name: 'I. Williams', team: 'ATH', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/93.png', value: 4 },
      { rank: 5, name: 'O. Sancet', team: 'ATH', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/93.png', value: 3 }
    ];
  }
  return [
    { rank: 1, name: 'B. Saka', team: 'ARS', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', value: 5 },
    { rank: 2, name: 'C. Palmer', team: 'CHE', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png', value: 4 },
    { rank: 3, name: 'M. Salah', team: 'LIV', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png', value: 4 },
    { rank: 4, name: 'W. Ndidi', team: 'LEI', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/375.png', value: 3 },
    { rank: 5, name: 'K. De Bruyne', team: 'MNC', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png', value: 3 }
  ];
}

function _getFallbackTeam(rawName) {
  const n = String(rawName || '').toLowerCase().trim();
  const clubs = {
    arsenal: {
      id: '133604',
      name: 'Arsenal',
      badge: 'https://www.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png',
      stadium: 'Emirates Stadium',
      league: 'English Premier League',
      country: 'England',
      nextMatch: {
        id: '1001',
        eventName: 'Arsenal vs Chelsea',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        homeBadge: 'https://www.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png',
        awayBadge: 'https://www.thesportsdb.com/images/media/team/badge/yvwvtu1448813215.png',
        dateStr: '2026-09-12',
        timeStr: '16:30',
        round: 'Round 5',
        league: 'English Premier League'
      },
      form: [
        { result: 'W', score: '2 - 0', opponent: 'Wolves', date: '2026-08-17' },
        { result: 'W', score: '2 - 0', opponent: 'Aston Villa', date: '2026-08-24' },
        { result: 'D', score: '1 - 1', opponent: 'Brighton', date: '2026-08-31' },
        { result: 'W', score: '1 - 0', opponent: 'Tottenham', date: '2026-09-01' },
        { result: 'W', score: '3 - 1', opponent: 'Leicester', date: '2026-09-03' }
      ]
    },
    'real madrid': {
      id: '133738',
      name: 'Real Madrid',
      badge: 'https://www.thesportsdb.com/images/media/team/badge/8p1k0v1612467234.png',
      stadium: 'Santiago Bernabéu',
      league: 'Spanish La Liga',
      country: 'Spain',
      nextMatch: {
        id: '1002',
        eventName: 'Real Sociedad vs Real Madrid',
        homeTeam: 'Real Sociedad',
        awayTeam: 'Real Madrid',
        homeBadge: 'https://www.thesportsdb.com/images/media/team/badge/6c6cbf1612467246.png',
        awayBadge: 'https://www.thesportsdb.com/images/media/team/badge/8p1k0v1612467234.png',
        dateStr: '2026-09-14',
        timeStr: '20:00',
        round: 'Round 5',
        league: 'Spanish La Liga'
      },
      form: [
        { result: 'D', score: '1 - 1', opponent: 'Mallorca', date: '2026-08-18' },
        { result: 'W', score: '3 - 0', opponent: 'Valladolid', date: '2026-08-25' },
        { result: 'D', score: '1 - 1', opponent: 'Las Palmas', date: '2026-08-29' },
        { result: 'W', score: '2 - 0', opponent: 'Betis', date: '2026-09-01' },
        { result: 'W', score: '2 - 1', opponent: 'Getafe', date: '2026-09-03' }
      ]
    }
  };

  for (const key of Object.keys(clubs)) {
    if (n.includes(key) || key.includes(n)) {
      return clubs[key];
    }
  }
  return null;
}

export const favoriteTeamService = new FavoriteTeamService();
export default favoriteTeamService;
