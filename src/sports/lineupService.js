/**
 * Match Lineup Service for Nidalplayer
 * Fetches Starting XI, Formations (4-3-3, 4-2-3-1), Player Jersey Numbers, and Bench Substitutes
 * Supports English Premier League, Spanish La Liga, Italian Serie A, German Bundesliga,
 * French Ligue 1, and UEFA Champions League.
 */

const LEAGUE_ESPN_MAP = {
  '4328': 'eng.1',
  '4335': 'esp.1',
  '4332': 'ita.1',
  '4331': 'ger.1',
  '4334': 'fra.1',
  '4480': 'uefa.champions',
  'epl': 'eng.1',
  'laliga': 'esp.1',
  'seriea': 'ita.1',
  'bundesliga': 'ger.1',
  'ligue1': 'fra.1',
  'ucl': 'uefa.champions'
};

class LineupService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 mins
  }

  async fetchLineup(match) {
    if (!match) return { available: false, message: 'No match provided' };

    const cacheKey = `${match.id || match.eventName}-${match.leagueKey || match.leagueId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      return cached.data;
    }

    const leagueKey = LEAGUE_ESPN_MAP[match.leagueKey] || LEAGUE_ESPN_MAP[match.leagueId] || 'eng.1';
    
    try {
      // 1. Fetch current scoreboard for league
      const scoreUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueKey}/scoreboard`;
      const scoreRes = await fetch(scoreUrl, { cache: 'no-store' });
      if (!scoreRes.ok) return { available: false, message: 'Could not connect to lineups service' };
      const scoreData = await scoreRes.json();
      const events = scoreData.events || [];

      if (events.length === 0) {
        return { available: false, message: 'Lineups will be announced ~1 hour before kickoff' };
      }

      // 2. Fuzzy match team names
      const homeTokens = (match.homeTeam || '').toLowerCase().split(/\s+/).filter(t => t.length >= 3);
      const awayTokens = (match.awayTeam || '').toLowerCase().split(/\s+/).filter(t => t.length >= 3);

      let matchedEvent = events.find(ev => {
        const name = (ev.name || '').toLowerCase();
        const shortName = (ev.shortName || '').toLowerCase();
        const hasHome = homeTokens.some(t => name.includes(t) || shortName.includes(t));
        const hasAway = awayTokens.some(t => name.includes(t) || shortName.includes(t));
        return hasHome || hasAway;
      });

      if (!matchedEvent) {
        // Try fallback to first event if only 1 event today
        if (events.length === 1) {
          matchedEvent = events[0];
        } else {
          return { available: false, message: 'Lineups will be announced ~1 hour before kickoff' };
        }
      }

      // 3. Fetch summary for rosters
      const sumUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueKey}/summary?event=${matchedEvent.id}`;
      const sumRes = await fetch(sumUrl, { cache: 'no-store' });
      if (!sumRes.ok) return { available: false, message: 'Lineup summary unavailable' };
      const sumData = await sumRes.json();

      const rosters = sumData.rosters || [];
      if (rosters.length === 0) {
        return { available: false, message: 'Official lineups not announced yet' };
      }

      const parsedTeams = rosters.map(r => {
        const roster = r.roster || [];
        const starters = roster
          .filter(p => p.starter)
          .map(p => ({
            name: p.athlete?.displayName || p.athlete?.shortName || 'Player',
            jersey: p.jersey || '',
            position: p.position?.abbreviation || p.position?.displayName || 'POS',
            avatar: p.athlete?.headshot?.href || ''
          }));

        const subs = roster
          .filter(p => !p.starter)
          .map(p => ({
            name: p.athlete?.displayName || p.athlete?.shortName || 'Player',
            jersey: p.jersey || '',
            position: p.position?.abbreviation || p.position?.displayName || 'SUB',
            avatar: p.athlete?.headshot?.href || ''
          }));

        return {
          teamId: r.team?.id,
          teamName: r.team?.displayName || match.homeTeam,
          logo: r.team?.logo || '',
          formation: r.formation || '4-3-3',
          starters,
          subs
        };
      });

      const result = {
        available: parsedTeams.length >= 1 && parsedTeams.some(t => t.starters.length > 0),
        teams: parsedTeams,
        message: parsedTeams.length === 0 ? 'Lineups not released yet' : ''
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      console.warn('[LineupService] Error fetching lineup:', err);
      return { available: false, message: 'Lineups temporarily unavailable' };
    }
  }
}

export const lineupService = new LineupService();
export default lineupService;
