
    (() => {
      'use strict';

      const openList = document.querySelector('.rows.open');
      const doneList = document.querySelector('.rows.done');
      const doneSection = document.querySelector('.done-section');
      const toggle = document.querySelector('.toggle');
      const composer = document.querySelector('.composer input');
      const count = document.querySelector('.count');

      function updateDone() {
        const n = doneList.children.length;
        doneSection.hidden = n === 0;
        if (n === 0) {
          toggle.setAttribute('aria-expanded', 'false');
          doneList.hidden = true;
        }
        toggle.textContent = `Done · ${n}`;
        const open = openList.children.length;
        count.textContent = `${open} little ${open === 1 ? 'thing' : 'things'} left`;
        save();
      }
      function focusEnd(el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      function makeRow(text, done = false) {
        const row = document.createElement('li');
        row.className = 'row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tick';
        checkbox.checked = done;
        const line = document.createElement('span');
        line.className = 'line';
        line.contentEditable = 'plaintext-only';
        line.setAttribute('role', 'textbox');
        line.setAttribute('aria-label', 'Item text');
        line.textContent = text;
        row.dataset.id = crypto.randomUUID();
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove';
        remove.textContent = '×';
        const label = () => {
          const name = line.textContent.trim() || 'item';
          checkbox.setAttribute('aria-label', `${checkbox.checked ? 'Mark open' : 'Mark done'}: ${name}`);
          remove.setAttribute('aria-label', `Delete: ${name}`);
        };
        label();
        line.addEventListener('input', () => { label(); save(); });
        checkbox.addEventListener('change', () => {
          (checkbox.checked ? doneList : openList)[checkbox.checked ? 'prepend' : 'append'](row);
          label();
          updateDone();
          if (checkbox.checked && doneList.hidden) composer.focus();
          else checkbox.focus();
        });
        remove.addEventListener('click', () => { row.remove(); updateDone(); composer.focus(); });
        line.addEventListener('keydown', event => {
          if (event.isComposing) return;
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            line.blur();
            composer.focus();
          } else if (event.key === 'Backspace' && !line.textContent) {
            event.preventDefault();
            const prev = row.previousElementSibling?.querySelector('.line');
            row.remove();
            updateDone();
            prev ? focusEnd(prev) : composer.focus();
          }
        });
        line.addEventListener('blur', () => { if (!line.textContent.trim()) { row.remove(); updateDone(); } });
        row.append(checkbox, line, remove);
        return row;
      }

      composer.addEventListener('keydown', event => {
        if (event.isComposing) return;
        if (event.key === 'Enter' && composer.value.trim()) {
          openList.append(makeRow(composer.value.trim()));
          composer.value = '';
          updateDone();
        } else if (event.key === 'Backspace' && !composer.value && openList.lastElementChild) {
          event.preventDefault();
          focusEnd(openList.lastElementChild.querySelector('.line'));
        }
      });
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        doneList.hidden = !open;
      });
      document.querySelector('.clear').addEventListener('click', () => {
        doneList.replaceChildren();
        updateDone();
        composer.focus();
      });

      const status = document.querySelector('#status');
      const retry = document.querySelector('#retry');
      const items = document.querySelector('#items');
      let ready = false;
      const store = new ScratchpadStore(window.orca?.host, {
        status(message, failed) { status.textContent = message; retry.hidden = !failed; },
        render(rows) {
          ready = false;
          openList.replaceChildren(); doneList.replaceChildren();
          for (const item of rows) {
            const row = makeRow(item.text, item.done);
            row.dataset.id = item.id;
            (item.done ? doneList : openList).append(row);
          }
          updateDone(); ready = true; items.disabled = false;
        }
      });
      function save() {
        if (!ready) return;
        store.save([...openList.children, ...doneList.children].map(row => ({
          id: row.dataset.id,
          text: row.querySelector('.line').textContent,
          done: row.querySelector('.tick').checked
        })));
      }
      retry.addEventListener('click', () => store.retry());
      store.load();
      const root = document.documentElement;
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
      function applyTheme(mode) {
        root.dataset.theme = mode;
        const next = mode === 'light' ? 'dark' : 'light';

      }
      function followHostTheme() {
        const scheme = getComputedStyle(root).colorScheme;
        applyTheme(root.classList.contains('light') ? 'light'
          : root.classList.contains('dark') ? 'dark'
          : scheme === 'light' || scheme === 'dark' ? scheme
          : systemTheme.matches ? 'dark' : 'light');
      }

      systemTheme.addEventListener('change', followHostTheme);
      window.orca?.on?.('theme', ({ colorScheme }) => {
        if (colorScheme === 'light' || colorScheme === 'dark') applyTheme(colorScheme);
        else followHostTheme();
      });
      new MutationObserver(followHostTheme).observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
      followHostTheme();
    })();
