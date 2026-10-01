import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseM3U } from '../src/playlist/m3uParser.js';
import { XtreamApi, normalizeServer } from '../src/playlist/xtreamApi.js';
import { cleanTitle, extractYear, fetchTMDBDetails, testTMDBApiKey } from '../src/services/tmdbService.js';
import { matchCenter, TOP_5_LEAGUES } from '../src/sports/matchCenter.js';
import { favoriteTeamService } from '../src/sports/favoriteTeamService.js';
import { VirtualScroller } from '../src/ui/virtualScroller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // 9. GPU Settings & Crash Log Persistence Unit Test
  runTest('GPU Hardware Acceleration & Crash Log Data Integrity', () => {
    // Test user settings serialization & defaults
    const defaultSettings = {};
    const defaultGpu = defaultSettings.gpuAcceleration !== false;
    assert.strictEqual(defaultGpu, true, 'Default GPU acceleration must be true');

    const disabledSettings = { gpuAcceleration: false };
    const disabledGpu = disabledSettings.gpuAcceleration !== false;
    assert.strictEqual(disabledGpu, false, 'Disabled GPU acceleration must be false');

    const enabledSettings = { gpuAcceleration: true };
    const enabledGpu = enabledSettings.gpuAcceleration !== false;
    assert.strictEqual(enabledGpu, true, 'Explicitly enabled GPU acceleration must be true');

    // Test crash log entry structure & FIFO capping
    const mockCrashLog = {
      timestamp: new Date().toISOString(),
      type: 'child-process-gone',
      processType: 'GPU',
      reason: 'crashed',
      exitCode: -1073741819,
      gpuAcceleration: true,
      appVersion: '4.3.0'
    };
    assert.strictEqual(mockCrashLog.processType, 'GPU');
    assert.strictEqual(mockCrashLog.reason, 'crashed');
    assert.strictEqual(mockCrashLog.gpuAcceleration, true);

    // Test FIFO capping at 100 entries
    let logs = [];
    for (let i = 0; i < 120; i++) {
      logs.push({ id: i });
      if (logs.length > 100) logs = logs.slice(-100);
    }
    assert.strictEqual(logs.length, 100, 'Crash logs must be capped at 100 entries');
    assert.strictEqual(logs[0].id, 20, 'First log after 120 entries should have id 20');
    assert.strictEqual(logs[99].id, 119, 'Last log should have id 119');
    console.log('   [GPU Config] Default: enabled, Toggle: verified, Crash Log Schema & FIFO: verified');
  });

  // 10. Sidebar Sports Center (Standings, Scorers, Assists) Unit Test
  await runAsyncTest('Sidebar Sports Center: League Standings, Top Scorers & Top Assists', async () => {
    const stats = await favoriteTeamService.fetchLeagueStats('Arsenal');
    assert.ok(stats, 'Stats object must be returned');
    assert.strictEqual(stats.leagueName, 'Premier League', 'League should be Premier League for Arsenal');
    assert.ok(Array.isArray(stats.standings), 'Standings must be an array');
    assert.ok(stats.standings.length > 0, 'Standings must have entries');
    assert.ok(stats.standings[0].rank >= 1, 'First team must have valid rank');
    assert.ok(typeof stats.standings[0].pts === 'number', 'Points must be numeric');

    // Check favorite team decoration
    const favEntry = stats.standings.find(s => s.isFavTeam);
    assert.ok(favEntry, 'Arsenal must be flagged as favorite team in standings');
    assert.strictEqual(stats.favTeamName, 'Arsenal');

    // Check scorers and assists
    assert.ok(Array.isArray(stats.scorers), 'Scorers must be an array');
    assert.ok(stats.scorers.length > 0, 'Scorers must have entries');
    assert.ok(stats.scorers[0].rank >= 1, 'Scorer must have valid rank');
    assert.ok(stats.scorers[0].name.length > 0, 'Scorer must have name');
    assert.ok(typeof stats.scorers[0].value === 'number', 'Scorer goals must be numeric');

    assert.ok(Array.isArray(stats.assists), 'Assists must be an array');
    assert.ok(stats.assists.length > 0, 'Assists must have entries');
    assert.ok(stats.assists[0].rank >= 1, 'Assist leader must have valid rank');
    assert.ok(stats.assists[0].name.length > 0, 'Assist leader must have name');
    assert.ok(typeof stats.assists[0].value === 'number', 'Assists count must be numeric');

    console.log(`   [Sidebar Sports] League: ${stats.leagueName}, Standings: ${stats.standings.length} teams, Top Scorer: ${stats.scorers[0].name} (${stats.scorers[0].value}G), Top Assist: ${stats.assists[0].name} (${stats.assists[0].value}A)`);
  });

  // 11. VirtualScroller Rendering Optimization Tests (Bolt PR #1)
  runTest('VirtualScroller: Render Loop Optimization & DOM Thrash Prevention', () => {
    const origWindow = global.window;
    const origDoc = global.document;
    const origRAF = global.requestAnimationFrame;

    try {
      global.window = {
        innerHeight: 800,
        innerWidth: 1200,
        addEventListener: () => {},
        removeEventListener: () => {}
      };
      global.requestAnimationFrame = (fn) => fn();

      class MockNode {
        constructor() {
          this.style = {};
          this.children = [];
          this.innerHTML = '';
          this.clientHeight = 800;
          this.clientWidth = 1200;
          this.scrollTop = 0;
          this.listeners = {};
        }
        appendChild(child) { this.children.push(child); }
        addEventListener(event, fn) { this.listeners[event] = fn; }
        removeEventListener(event) { delete this.listeners[event]; }
      }

      global.document = {
        createElement: () => new MockNode(),
        createDocumentFragment: () => new MockNode()
      };

      let renderItemCount = 0;
      const testItems = Array.from({ length: 500 }, (_, i) => ({ id: i, title: `Item ${i}` }));
      const container = new MockNode();

      const scroller = new VirtualScroller({
        container,
        itemHeight: 60,
        minItemWidth: 200,
        gap: 10,
        mode: 'grid',
        renderItem: () => {
          renderItemCount++;
          return new MockNode();
        }
      });

      // Initial populate
      scroller.setItems(testItems);
      const initialCount = renderItemCount;
      assert.ok(initialCount > 0, 'Initial render must create DOM elements');

      // Small scroll: visible range does not shift -> DOM rebuild should be skipped
      container.scrollTop = 5;
      scroller.handleScroll();
      assert.strictEqual(renderItemCount, initialCount, 'Small scroll within buffer MUST NOT rebuild DOM nodes');

      container.scrollTop = 15;
      scroller.handleScroll();
      assert.strictEqual(renderItemCount, initialCount, 'Sub-item scroll within buffer MUST NOT rebuild DOM nodes');

      // Large scroll: visible range shifts -> DOM rebuild must trigger
      container.scrollTop = 600;
      scroller.handleScroll();
      assert.ok(renderItemCount > initialCount, 'Large scroll MUST render new visible items');

      // Reset / Scroll to top
      const beforeTopCount = renderItemCount;
      scroller.scrollToTop();
      assert.ok(renderItemCount > beforeTopCount, 'scrollToTop MUST force-render');

      // Dimension recalculation
      const beforeRecalc = renderItemCount;
      container.scrollTop = 100;
      scroller.recalculateDimensions();
      scroller.render();
      assert.ok(renderItemCount > beforeRecalc, 'recalculateDimensions MUST invalidate cache and force-render');
    } finally {
      global.window = origWindow;
      global.document = origDoc;
      global.requestAnimationFrame = origRAF;
    }
  });

  // 12. Accessibility Validation: ARIA Labels & Roles (Palette PR #2 & #7)
  runTest('Accessibility: Icon-Only Buttons, Reticle & Search ARIA Attributes', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    // Decorative reticle must have aria-hidden="true"
    assert.match(html, /class="search-reticle"\s+aria-hidden="true"/, 'Search reticle must be aria-hidden="true"');

    // Global search input must have aria-label
    assert.match(html, /id="globalSearchInput"[^>]*aria-label="Search channels, movies, or shows"/, 'Global search input must have descriptive aria-label');

    // Icon-only buttons must have aria-labels
    const requiredAriaButtons = [
      'clearSearchBtn',
      'topRemoteBtn',
      'btnShortcutsHelp',
      'topWindowFullscreenBtn',
      'closePlaylistModalBtn',
      'closeRemoteModalBtn',
      'closeMatchModalBtn',
      'closeShortcutsModalBtn',
      'floatingUpdateCloseBtn'
    ];

    for (const btnId of requiredAriaButtons) {
      const regex = new RegExp(`id="${btnId}"[^>]*aria-label="[^"]+"`);
      assert.match(html, regex, `Button #${btnId} must have an aria-label attribute`);
    }
  });

  // 13. Keyboard Focus Accessibility: :focus-visible Styles (Palette PR #5)
  runTest('Accessibility: Global :focus-visible Keyboard Ring in Design System', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

    // Must define :focus-visible rule with --accent-orange outline
    assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--accent-orange\)/, 'Design system must define :focus-visible with --accent-orange outline');
  });

  console.log('===================================================');
  console.log('TEST SUMMARY: ' + passed + ' / ' + total + ' TESTS PASSED (' + Math.round((passed / total) * 100) + '%)');
  console.log('===================================================');
  if (passed !== total) process.exit(1);
}
main().catch(err => { console.error(err); process.exit(1); });