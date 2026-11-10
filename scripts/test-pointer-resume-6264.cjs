const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.APHEKA_QA_URL || 'http://127.0.0.1:1422';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], checks = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const callbacks = new Map(), listeners = new Map();
      let sequence = 0;
      window.isTauri = true;
      const q = window.__qa = { active: false, focused: true, focus: 0, pointer: 0, writes: 0, visible: 'visible', denied: false };
      Object.defineProperty(document, 'visibilityState', { get: () => q.visible });
      q.emit = name => { for (const listener of listeners.values()) if (listener.event === name) callbacks.get(listener.handler)?.({ event: name, id: listener.id, payload: null }); };
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        transformCallback: cb => { callbacks.set(++sequence, cb); return sequence; },
        invoke: async (cmd, args) => {
          if (cmd === 'plugin:window|is_fullscreen') return q.active;
          if (cmd === 'plugin:window|set_fullscreen') { if (q.denied) throw Error('denied'); q.active = args.value; q.writes++; return; }
          if (cmd === 'plugin:window|is_focused') return q.focused;
          if (cmd === 'plugin:webview|set_webview_focus') { q.focus++; window.dispatchEvent(new Event('focus')); return; }
          if (cmd === 'restore_workspace_pointer') { q.pointer++; return; }
          if (cmd === 'plugin:event|listen') { const id = ++sequence; listeners.set(id, { ...args, id }); return id; }
          if (cmd === 'plugin:event|unlisten') { listeners.delete(args.eventId); return; }
          throw Error(cmd);
        }
      };
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    });
    await page.goto(base + '/scripts/apheka-fullscreen-preview.html');
    const button = page.getByRole('button', { name: 'Pantalla completa', exact: true });
    await button.click();
    await page.waitForFunction(() => window.__qa.pointer >= 1);
    const first = await page.evaluate(() => ({ ...window.__qa }));
    assert.equal(first.writes, 1);
    // The floating window remains alive while main loses and then regains focus.
    await page.evaluate(() => { const q = window.__qa; q.focused = false; q.emit('tauri://blur'); window.dispatchEvent(new Event('blur')); });
    await page.evaluate(() => { const q = window.__qa; q.focused = true; q.emit('tauri://focus'); });
    await page.waitForFunction(n => window.__qa.pointer > n, first.pointer);
    assert.equal(await page.evaluate(() => window.__qa.writes), 1, 'same fullscreen state must recover without toggling');
    checks.push('Native focus resumes input with fullscreen unchanged and auxiliary window not destroyed');
    let before = await page.evaluate(() => window.__qa.pointer);
    await page.evaluate(async () => {
      const { resumeFullscreenInput } = await import('/src/hooks/useWindowFullscreen.ts');
      await resumeFullscreenInput(true);
    });
    assert.equal(await page.evaluate(() => window.__qa.pointer), before + 1);
    checks.push('Explicit timer-hide recovery works immediately without waiting for a focus event');
    before++;
    await page.evaluate(() => { const q = window.__qa; q.visible = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); q.visible = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(n => window.__qa.pointer > n, before);
    checks.push('Visibility restoration recovers WebView focus and native cursor');
    before = await page.evaluate(() => window.__qa.pointer);
    await page.evaluate(() => { const q = window.__qa; q.focused = false; q.emit('tauri://focus'); });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__qa.pointer), before);
    checks.push('No focus or cursor restoration while another window owns focus');
    await page.evaluate(() => { window.__qa.focused = true; for (let i = 0; i < 30; i++) window.__qa.emit('tauri://focus'); });
    await page.waitForFunction(n => window.__qa.pointer > n, before);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__qa.pointer), before + 1);
    before++;
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => window.__qa.pointer), before, 'no background polling or recursive focus');
    checks.push('Focus bursts coalesce; no polling or recursive recovery');
    await page.getByRole('button', { name: 'Abrir diálogo' }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__qa.active);
    before = await page.evaluate(() => window.__qa.pointer);
    await page.evaluate(() => window.__qa.emit('tauri://focus'));
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__qa.pointer), before + 1, 'restored and maximized windows recover too');
    checks.push('Native cursor recovers outside exclusive fullscreen, including maximized windows');
    await page.keyboard.press('F11');
    await page.waitForFunction(() => window.__qa.active);
    await page.keyboard.press('F11');
    await page.waitForFunction(() => !window.__qa.active);
    checks.push('Dialog Escape, fullscreen Escape/F11 and normal-window focus remain correct');
    await page.evaluate(() => { window.__qa.denied = true; });
    await button.click();
    await page.waitForFunction(() => document.querySelector('output').textContent.includes('No se pudo'));
    assert.deepEqual(errors, []);
    checks.push('Denied native operation is recoverable; no runtime errors');
    fs.writeFileSync('release/qa-6264-pointer-resume.json', JSON.stringify({ checks, errors, scope: 'Real React lifecycle in Edge; mocked Tauri IPC/focus and visibility. Physical Windows/GPU cursor not exercised.' }, null, 2));
    console.log('PASS: ' + checks.join('; '));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
