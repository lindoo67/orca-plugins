'use strict';
class ScratchpadDocument {
  constructor(orca, view) {
    this.orca = orca;
    this.view = view;
    this.version = null;
    this.baseline = null;
    this.pending = null;
    this.sent = null;
    this.readOnly = true;
    this.conflict = false;
  }
  parse(text) {
    if (!text.trim()) return [];
    const value = JSON.parse(text);
    if (value?.version !== 1 || !Array.isArray(value.items) ||
        value.items.some(item => !item || typeof item.id !== 'string' || typeof item.text !== 'string' || typeof item.done !== 'boolean') ||
        new Set(value.items.map(item => item.id)).size !== value.items.length) {
      throw new Error('Invalid scratchpad file. Switch to Source to fix it.');
    }
    return value.items;
  }
  receive(doc) {
    if (!Number.isSafeInteger(doc?.version) || doc.content?.kind !== 'text') return;
    this.version = doc.version;
    const text = doc.content.text;
    if (text === this.sent) {
      this.baseline = text;
      this.readOnly = !!doc.readOnly;
      this.view.readOnly(this.readOnly);
      return;
    }
    if (this.pending !== null || this.sent !== null) {
      if (text === this.baseline) return;
      this.conflict = true;
      this.view.status('File changed while editing. Copy your edits, then reopen the file.', false);
      return;
    }
    try {
      const rows = this.parse(text);
      this.baseline = text;
      this.readOnly = !!doc.readOnly;
      this.view.render(rows);
      this.view.readOnly(this.readOnly);
      this.view.status(this.readOnly ? 'Read-only file' : 'Save with ⌘S / Ctrl+S', false);
    } catch (error) {
      this.readOnly = true;
      this.view.readOnly(true);
      this.view.status(error.message, false);
    }
  }
  load() {
    if (!this.orca?.document) {
      this.view.status('Create or open a .scratchpad file in Orca.', false);
      return;
    }
    this.orca.document.onDidChange(doc => this.receive(doc));
    this.orca.on('editor.flush', () => this.flush());
  }
  save(items) {
    if (this.readOnly) return;
    this.pending = JSON.stringify({ version: 1, items }, null, 2) + '\n';
    this.view.status(this.conflict ? 'File changed. Copy your edits before reopening.' : 'Editing…', false);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush().catch(() => {}), 100);
  }
  flush() {
    if (this.active) return this.active;
    this.active = this.drain().finally(() => { this.active = null; });
    return this.active;
  }
  async drain() {
    while (this.pending !== null) {
      if (this.readOnly || this.conflict) throw new Error('Cannot update this file.');
      const text = this.pending;
      this.pending = null;
      this.sent = text;
      try {
        await this.orca.document.applyEdit({ baseVersion: this.version, content: { kind: 'text', text } });
        this.baseline = text;
        this.view.status('Save with ⌘S / Ctrl+S', false);
      } catch (error) {
        this.pending ??= text;
        this.conflict ||= error.code === 'conflict';
        this.view.status(`Edits not applied: ${error.message || 'Retry'}`, !this.conflict);
        throw error;
      } finally { this.sent = null; }
    }
  }
  retry() { return this.flush().catch(() => {}); }
}
if (typeof module !== 'undefined') module.exports = { ScratchpadDocument };
