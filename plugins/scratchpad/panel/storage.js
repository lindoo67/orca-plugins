'use strict';
class ScratchpadStore {
  constructor(host, view) {
    this.host = host;
    this.view = view;
    this.base = null;
    this.pending = null;
    this.busy = false;
    this.loaded = false;
  }
  validate(value) {
    if (value === null) return [];
    if (value?.version !== 1 || !Array.isArray(value.items) ||
        value.items.some(item => typeof item.id !== 'string' || typeof item.text !== 'string' || typeof item.done !== 'boolean') ||
        new Set(value.items.map(item => item.id)).size !== value.items.length) {
      throw new Error('Saved scratchpad is invalid. It has been preserved.');
    }
    return value.items;
  }
  async load() {
    try {
      if (!this.host?.has('storage.compareAndSet')) throw new Error('Update Orca to a version with panel storage support.');
      const { value } = await this.host.call('storage.get', { key: 'scratchpad' });
      const rows = this.validate(value);
      this.base = value;
      this.loaded = true;
      this.view.render(rows);
      this.view.status('Saved on this device', false);
    } catch (error) { this.view.status(error.message || 'Could not load scratchpad.', true); }
  }
  save(items) {
    this.pending = { version: 1, items };
    this.view.status('Saving…', false);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }
  async flush() {
    if (this.busy || !this.pending) return;
    this.busy = true;
    const value = this.pending;
    this.pending = null;
    try {
      const result = await this.host.call('storage.compareAndSet', { key: 'scratchpad', expected: this.base, value });
      if (!result.swapped) throw new Error('Changed in another panel. Copy your unsaved edits here, then reopen Scratchpad.');
      this.base = value;
      this.view.status(this.pending ? 'Saving…' : 'Saved on this device', false);
    } catch (error) {
      this.pending ??= value;
      this.view.status(`Not saved: ${error.message || 'Please retry.'}`, true);
      this.busy = false;
      return;
    }
    this.busy = false;
    if (this.pending) this.flush();
  }
  retry() { this.loaded ? this.flush() : this.load(); }
}
if (typeof module !== 'undefined') module.exports = { ScratchpadStore };
