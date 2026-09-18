const STORAGE_KEY = 'nidalplayer-diagnostics';
const MAX_ENTRIES = 500;

function safeDetails(details) {
  if (details == null) return '';
  try {
    return typeof details === 'string' ? details : JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export class DiagnosticLogger {
  constructor(bridge) {
    this.bridge = bridge;
    this.entries = [];
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) this.entries = saved.slice(0, MAX_ENTRIES);
    } catch {}
    window.addEventListener('error', event => this.error('renderer', event.message || 'Unhandled renderer error', { file: event.filename, line: event.lineno, column: event.colno }));
    window.addEventListener('unhandledrejection', event => this.error('renderer', 'Unhandled promise rejection', { reason: String(event.reason?.message || event.reason || 'Unknown rejection') }));
  }

  write(level, area, message, details = '') {
    const entry = { timestamp: new Date().toISOString(), level, area, message: String(message || 'Unknown event'), details: safeDetails(details) };
    this.entries.unshift(entry);
    this.entries = this.entries.slice(0, MAX_ENTRIES);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries)); } catch {}
    const line = `[${entry.level.toUpperCase()}] [${entry.area}] ${entry.message}${entry.details ? ` — ${entry.details}` : ''}`;
    if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.info(line);
    const pending = this.bridge.saveDiagnostic?.(entry); pending?.catch?.(() => {});
    return entry;
  }

  info(area, message, details) { return this.write('info', area, message, details); }
  warn(area, message, details) { return this.write('warn', area, message, details); }
  error(area, message, details) { return this.write('error', area, message, details); }
  clear() { this.entries = []; try { localStorage.removeItem(STORAGE_KEY); } catch {} const pending = this.bridge.clearDiagnostics?.(); pending?.catch?.(() => {}); }
  text() { return this.entries.slice().reverse().map(entry => `${entry.timestamp} [${entry.level.toUpperCase()}] [${entry.area}] ${entry.message}${entry.details ? ` — ${entry.details}` : ''}`).join('\n'); }
  filtered(level = 'all') { return level === 'all' ? this.entries : this.entries.filter(entry => entry.level === level); }
}
