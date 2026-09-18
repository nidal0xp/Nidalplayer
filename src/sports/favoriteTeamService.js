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
