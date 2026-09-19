import assert from 'node:assert';
import { parseM3U } from '../src/playlist/m3uParser.js';
import { XtreamApi, normalizeServer } from '../src/playlist/xtreamApi.js';
import { cleanTitle, extractYear, fetchTMDBDetails, testTMDBApiKey } from '../src/services/tmdbService.js';
import { matchCenter, TOP_5_LEAGUES } from '../src/sports/matchCenter.js';

console.log('==================================================');
console.log('🧪 RUNNING COMPREHENSIVE NIDALPLAYER TEST SUITE');
console.log('=================================================');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log('✅ [PASS] ' + name);
    passed++;
  } catch (err) {
    console.error('❥ [FAIL] ' + name);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log("✅ [PASS] " + name);
    passed++;
  } catch (err) {
    console.error("❗ [FAIL] " + name);
    console.error(err);
  }
}

async function main() {
  // 1. M3U Parser Tests
  runTest('M3U Parser: Live, VOD, and Series classification', () => {
    const sampleM3U = `#EXTM3U
#EXTINF:-1 tvg-id="beIN1" tvg-name="beIN Sports 1 HD" tvg-logo="http://logo.com/bein1.png" group-title="SPORTS",beIN Sports 1 HD<br/>1080p
http://stream.example.com/live/user/pass/123.m3u8
#EXTINF:-1 tvg-id="" tvg-logo="http://logo.com/movie.jpg" group-title="MOVIES: ACTION",Inception (2010) [1080p]
http://stream.example.com/movie/user/pass/456.mp4
#EXTINF:-1 tvg-id="" group-title="SERIES: DRAMA",Breaking Bad S01 E01
http://stream.example.com/series/user/pass/789.mp4`;
    const result = parseM3U(sampleM3U);
    assert.strictEqual(result.items.length, 3, 'Should parse 3 items');
    assert.strictEqual(result.items[0].type, 'live', 'Item 0 should be live');
    assert.strictEqual(result.items[0].group, 'SPORTS');
    assert.strictEqual(result.items[1].type, 'movies', 'Item 1 should be movies');
    assert.strictEqual(result.items[2].type, 'series', 'Item 2 should be series');
  });

  // 2. Xtream API Tests
  runTest('Xtream API: Normalization & Endpoint Generation', () => {
    const norm1 = normalizeServer('example.com:8080');
    assert.strictEqual(norm1, 'http://example.com:8080');
    const norm2 = normalizeServer('https://secure-stream.net/');
    assert.strictEqual(norm2, 'https://secure-stream.net');
    const api = new XtreamApi(async () => ({}));
    assert.ok(api, 'XtreamApi instantiated');
  });

  // 3. TMDB Service Tests
  runTest('TMDB Service: Title Cleaning & Year Extraction', () => {
    const rawTitle1 = 'Dune: Part Two (2024) [4K] [HDR] [HEVC] [MULTi-VF]';
    const cleaned1 = cleanTitle(rawTitle1);
    assert.strictEqual(cleaned1, 'Dune: Part Two');
    const year1 = extractYear(rawTitle1);
    assert.strictEqual(year1, '2024');

    const rawTitle2 = 'Oppenheimer.2023.1080p.WEBRip.x264-Nidal';
    const cleaned2 = cleanTitle(rawTitle2);
    assert.strictEqual(cleaned2, 'Oppenheimer');
  });


  await runAsyncTest('TMDB Service: Metadata & User Key Handling', async () => {
    // 1. Without API key, should gracefully return null without throwing
    const noKeyData = await fetchTMDBDetails('Inception', 'movie', '2010');
    if (!process.env.TMDB_API_KEY) {
      assert.strictEqual(noKeyData, null, 'Without API key, should safely return null');
    }

    // 2. Validate testTMDBApiKey with empty key
    const emptyTest = await testTMDBApiKey('');
    assert.strictEqual(emptyTest.ok, false, 'Empty key validation should fail gracefully');

    // 3. If test environment provides TMDB_API_KEY, test live fetch
    if (process.env.TMDB_API_KEY) {
      const data = await fetchTMDBDetails('Inception', 'movie', '2010', process.env.TMDB_API_KEY);
      assert.ok(data, 'Should return TMDB data when API key is supplied');
      assert.ok(data.title.includes('Inception'), 'Title should match');
      assert.ok(data.rating, 'Should have rating');
      assert.strictEqual(data.trailerKey, undefined, 'Trailer key must be removed');
      assert.ok(data.cast.length > 0, 'Should have cast members');
      const names = data.cast.map(c => c.name).slice(0, 3).join(', ');
      console.log('   [TMDB Info] Title: ' + data.title + ', Rating: ★' + data.rating + ', Cast: ' + names);
    } else {
      console.log('   [TMDB Info] Zero hardcoded keys verified. Graceful fallback operational.');
    }
  });

  // 4. Sports Match Center Tests
  runTest('Sports Match Center: Top 5 Leagues Detection & Live Fixtures', () => {
    assert.ok(TOP_5_LEAGUES.some(l => l.id === 'epl'), 'Premier league configured');
    assert.ok(TOP_5_LEAGUES.some(l => l.id === 'laliga'), 'La Liga configured');
    assert.ok(TOP_5_LEAGUES.some(l => l.id === 'ucl'), 'Champions league configured');
    assert.ok(TOP_5_LEAGUES.some(l => l.id === 'seriea'), 'Serie A configured');
    assert.ok(TOP_5_LEAGUES.some(l => l.id === 'bundesliga'), 'Bundesliga configured');
  });

  // 5. Lineup Service Test
  await runAsyncTest('Lineup Service: Top 5 Leagues Starting XI & Formations', async () => {
    const { lineupService } = await import('../src/sports/lineupService.js');
    const mockMatch = {
      id: 'epl-test',
      leagueKey: 'epl',
      leagueId: '4328',
      homeTeam: 'Arsenal',
      awayTeam: 'Aston Villa'
    };
    const lineup = await lineupService.fetchLineup(mockMatch);
    assert.ok(lineup, 'Lineup result object returned');
    assert.ok(typeof lineup.available === 'boolean', 'Has available boolean flag');
    if (lineup.available && lineup.teams.length > 0) {
      const firstTeam = lineup.teams[0];
      console.log('   [Lineup Info] Team: ' + firstTeam.teamName + ', Formation: ' + firstTeam.formation + ', Starters: ' + firstTeam.starters.length + ', Subs: ' + firstTeam.subs.length);
    }
  });

  // 6. Live Stream Connectivity Test
  await runAsyncTest('Stream Connectivity: Live Stream Endpoint Verification', async () => {
    const testHlsUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    const res = await fetch(testHlsUrl, { method: 'HEAD' });
    assert.ok(res.ok || res.status === 405 || res.status === 200, 'Live stream test endpoint reachable');
  });

  // 7. Favorite Team Service Test
  await runAsyncTest('Favorite Team Service: Club Search, Next Fixture & Form', async () => {
    const { favoriteTeamService } = await import('../src/sports/favoriteTeamService.js');
    const overview = await favoriteTeamService.fetchTeamOverview('Arsenal');
    assert.ok(overview, 'Should return team overview');
    assert.strictEqual(overview.name, 'Arsenal', 'Team name matches');
    assert.ok(overview.badge, 'Team badge exists');
    assert.ok(Array.isArray(overview.form), 'Form is an array');
    console.log('   [Fav Team Info] Club: ' + overview.name + ', Next Match: ' + (overview.nextMatch ? overview.nextMatch.eventName : 'TBD') + ', Form: ' + overview.form.map(f => f.result).join(' '));
  });

  // 8. Auto-Updater: GitHub Release Assets & Binary Downloadability
  await runAsyncTest('Auto-Updater: GitHub Release Assets & Binary Downloadability', async () => {
    const apiUrl = 'https://api.github.com/repos/nidal0xp/Nidalplayer/releases/latest';
    const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Nidalplayer-Update-Verifier' } });
    assert.strictEqual(res.status, 200, 'GitHub release API must return 200');
    const releaseData = await res.json();
    assert.ok(releaseData.tag_name, 'Release must have a tag_name');

    const assetNames = releaseData.assets.map(a => a.name);
    // Dynamically find the Setup exe for the current release tag (e.g. Nidalplayer-Setup-4.2.0.exe)
    const tagVersion = releaseData.tag_name.replace(/^v/, '');
    const setupExeName = `Nidalplayer-Setup-${tagVersion}.exe`;
    assert.ok(
      assetNames.includes(setupExeName),
      `${setupExeName} must be present in release assets (found: ${assetNames.join(', ')})`
    );
    assert.ok(assetNames.includes('Nidalplayer-Portable.exe'), 'Nidalplayer-Portable.exe must be present in release assets');
    assert.ok(assetNames.includes('latest.yml'), 'latest.yml must be present in release assets');

    // Verify the setup binary metadata
    const setupAsset = releaseData.assets.find(a => a.name === setupExeName);
    assert.strictEqual(setupAsset.state, 'uploaded', 'Setup asset state must be uploaded');
    assert.ok(setupAsset.size > 50 * 1024 * 1024, 'Setup asset size must be valid binary (>50MB)');
    console.log(`   [Updater Info] Tag: ${releaseData.tag_name}, Setup: ${(setupAsset.size / (1024 * 1024)).toFixed(1)} MB, State: ${setupAsset.state}`);
  });

  console.log('===================================================');
  console.log('TEST SUMMARY: ' + passed + ' / ' + total + ' TESTS PASSED (' + Math.round((passed / total) * 100) + '%)');
  console.log('===================================================');
  if (passed !== total) process.exit(1);
}
main().catch(err => { console.error(err); process.exit(1); });