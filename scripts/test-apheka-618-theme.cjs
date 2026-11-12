const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('theme618')) return;
      sessionStorage.setItem('theme618', '1');
      localStorage.setItem('apheka_route_v2', JSON.stringify({ view: 'notas' }));
      const now = new Date().toISOString();
      localStorage.setItem('owa_studio_data', JSON.stringify({
        _savedAt: Date.now(), settings: { notifications: false, theme: 'oscuro', useThreeColors: false, uiOpacity: .2, navigationMode: 'pinned' },
        notes: [{ id: 'theme-note', title: 'Lectura con contraste', content: '<p>Texto legible al cambiar el ambiente.</p>', tags: [], createdAt: now, updatedAt: now }]
      }));
    });
    await page.goto(process.env.APHEKA_QA_URL || 'http://127.0.0.1:1422');
    const navigation = page.locator('aside.sidebar');
    const colors = [];
    for (const theme of ['oscuro', 'claro', 'vibrante', 'claro', 'oscuro']) {
      await navigation.getByRole('button', { name: 'Ajustes', exact: true }).click();
      await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
      await page.getByLabel('Tema del espacio', { exact: true }).selectOption(theme);
      await navigation.getByRole('button', { name: 'Notas', exact: true }).click();
      await page.getByLabel('Lectura con contraste', { exact: true }).click();
      const reader = page.getByRole('region', { name: 'Vista previa de nota', exact: true });
      await reader.locator('h2').waitFor();
      const metrics = await reader.evaluate(element => {
        const context = document.createElement('canvas').getContext('2d');
        const sample = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
        const background = sample(getComputedStyle(element).backgroundColor);
        const text = sample(getComputedStyle(element.querySelector('h2')).color);
        const blended = text.slice(0, 3).map((value, index) => value * text[3] / 255 + background[index] * (1 - text[3] / 255));
        const luminance = rgb => rgb.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const b = luminance(background), t = luminance(blended);
        return { background, contrast: (Math.max(b, t) + .05) / (Math.min(b, t) + .05), theme: document.documentElement.dataset.theme };
      });
      assert.equal(metrics.theme, theme);
      assert.equal(metrics.background[3], 255);
      assert.ok(metrics.contrast >= 4.5, JSON.stringify(metrics));
      assert.equal(metrics.background[0] > 180, theme === 'claro', 'opaque background follows active theme');
      colors.push(metrics.background);
      await page.screenshot({ path: 'release/qa-notes-theme-618-' + theme + '.png' });
    }
    assert.deepEqual(colors[0], colors[4]);
    assert.deepEqual(colors[1], colors[3]);
    for (const [surface, light] of [['#e5e9eb', true], ['#171f22', false]]) {
      await navigation.getByRole('button', { name: 'Ajustes', exact: true }).click();
      await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
      await page.getByLabel('Color de superficie', { exact: true }).fill(surface);
      await navigation.getByRole('button', { name: 'Notas', exact: true }).click();
      await page.getByLabel('Lectura con contraste', { exact: true }).click();
      const reader = page.getByRole('region', { name: 'Vista previa de nota', exact: true });
      await reader.locator('h2').waitFor();
      const channel = await reader.evaluate(element => {
        const c = document.createElement('canvas').getContext('2d');
        c.fillStyle = getComputedStyle(element).backgroundColor;
        c.fillRect(0, 0, 1, 1);
        return [...c.getImageData(0, 0, 1, 1).data];
      });
      assert.equal(channel[3], 255);
      assert.equal(channel[0] > 180, light, 'custom surface updates the opaque reader');
    }
    assert.deepEqual(errors, []);
    console.log('PASS theme changes: opaque note surface refreshes dark/light/vibrant repeatedly and custom colors, title contrast >= 4.5, no stale inline snapshot');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
