// All persistence goes through this adapter. To move to a backend, implement the same
// methods against an API (async-ready: every method returns a Promise).
const PREFIX = 'navle.v1.';

export class LocalStorageAdapter {
  _get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  }
  _set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  async getActiveSession() { return this._get('active', null); }
  async saveActiveSession(s) { return this._set('active', s); }
  async clearActiveSession() { try { localStorage.removeItem(PREFIX + 'active'); } catch {} }

  async listHistory() { return this._get('history', []); }
  async addHistory(entry) {
    const h = this._get('history', []);
    h.unshift(entry);
    return this._set('history', h);
  }
  async deleteHistory(id) { return this._set('history', this._get('history', []).filter((e) => e.id !== id)); }

  async getSeenIds() { return new Set(this._get('seen', [])); }
  async addSeenIds(ids) { return this._set('seen', [...new Set([...this._get('seen', []), ...ids])]); }

  async getReviews() { return this._get('reviews', {}); }
  async saveReview(itemId, review) {
    const r = this._get('reviews', {});
    r[itemId] = review;
    return this._set('reviews', r);
  }

  async getSettings() { return this._get('settings', { reviewerMode: false, reviewerName: '' }); }
  async saveSettings(s) { return this._set('settings', s); }

  async exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      history: this._get('history', []),
      reviews: this._get('reviews', {}),
      seen: this._get('seen', []),
    };
  }
  async importAll(data) {
    if (Array.isArray(data.history)) this._set('history', data.history);
    if (data.reviews && typeof data.reviews === 'object') this._set('reviews', data.reviews);
    if (Array.isArray(data.seen)) this._set('seen', data.seen);
  }
}
