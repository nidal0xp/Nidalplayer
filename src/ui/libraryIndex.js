export class LibraryIndex {
  constructor() { this.items = []; this.byId = new Map(); this.byType = new Map(); this.byCategory = new Map(); }
  rebuild(items) {
    this.items = Array.isArray(items) ? items : [];
    this.byId = new Map(this.items.map(item => [item.id, item]));
    this.byType = new Map();
    this.byCategory = new Map();
    for (const item of this.items) {
      if (!this.byType.has(item.type)) this.byType.set(item.type, []);
      this.byType.get(item.type).push(item);
      const category = item.group || 'Other';
      const key = `${item.type}:${category}`;
      if (!this.byCategory.has(key)) this.byCategory.set(key, []);
      this.byCategory.get(key).push(item);
    }
  }
  search(query, type) {
    const source = this.byType.get(type) || [];
    const q = String(query || '').trim().toLowerCase();
    if (!q) return source;
    return source.filter(item => `${item.name} ${item.group || ''} ${item.language || ''} ${item.country || ''}`.toLowerCase().includes(q));
  }
}
