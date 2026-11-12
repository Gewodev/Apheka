const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      localStorage.setItem('owa_studio_data', JSON.stringify({ _savedAt: Date.now(),
        courses: [{ id: 'spacing', name: 'Ingeniería de sistemas y diseño', color: '#8b5cf6', groups: [], studyTopics: [], progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0 }],
        tasks: [], notes: [{ id: 'apunte', title: 'Apunte de trabajo', content: '<p>Ideas claras, espacio para pensar.</p>', course: 'Ingeniería de sistemas y diseño', courseColor: '#8b5cf6', isCoursePrivate: true, tags: [], createdAt: now, updatedAt: now }],
        settings: { notifications: false }
      }));
    });
    await page.goto(process.env.APHEKA_TEST_URL || 'http://127.0.0.1:1420', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Cursos', exact: true }).first().click();
    await page.getByRole('button', { name: 'Abrir curso Ingeniería de sistemas y diseño', exact: true }).click();
    await page.getByPlaceholder('Nombre de la tarea', { exact: true }).waitFor();
    for (const width of [900, 1024, 1200, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const collapsed of [false, true]) {
        if (collapsed) await page.getByRole('button', { name: 'Contraer menú', exact: true }).click();
        await page.waitForTimeout(250);
        const overflow = await page.getByPlaceholder('Nombre de la tarea', { exact: true }).evaluate(el => {
          const card = el.parentElement.parentElement, r = card.getBoundingClientRect();
          return [...card.querySelectorAll('input,select,button')].map(x => ({ name: x.placeholder || x.title || x.tagName, rect: x.getBoundingClientRect() }))
            .filter(x => x.rect.left < r.left + 5 || x.rect.right > r.right - 5).map(x => x.name);
        });
        assert.deepEqual(overflow, [], `course task fields fit at ${width}, collapsed=${collapsed}`);
        const title = await page.locator('.course-overview-title').boundingBox();
        assert.ok(title.x + title.width <= width - 30, 'course title leaves room for actions');
        if (width === 900 && !collapsed) await page.screenshot({ path: 'docs/apheka-final-curso-900.png' });
        if (collapsed) await page.getByRole('button', { name: 'Expandir menú', exact: true }).click();
      }
    }
    await page.getByRole('button', { name: 'Modo Estudio', exact: true }).click();
    await page.waitForTimeout(800);
    for (const width of [900, 1024, 1200, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const collapsed of [false, true]) {
        if (collapsed) await page.getByRole('button', { name: 'Contraer menú', exact: true }).click();
        await page.waitForTimeout(400);
        for (const name of ['course-material-section', 'course-session-section', 'course-group-section']) {
          const r = await page.locator('.' + name).boundingBox();
          assert.ok(r.width >= 290 && r.x + r.width <= width + 1, `${name} has usable width at ${width}, collapsed=${collapsed}: ${JSON.stringify(r)}`);
        }
        if (width === 900 && !collapsed) await page.screenshot({ path: 'docs/apheka-final-curso-estudio-900.png' });
        if (collapsed) await page.getByRole('button', { name: 'Expandir menú', exact: true }).click();
      }
    }
    await page.setViewportSize({ width: 900, height: 700 });
    await page.getByRole('button', { name: 'Configurar curso', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Configurar curso', exact: true });
    await settings.waitFor();
    const dialog = await settings.boundingBox();
    const ancestors = await settings.evaluate(el => { const out = []; for (let x = el; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.transform !== 'none' || s.contain !== 'none' || s.containerType !== 'normal') out.push({ class: x.className, transform: s.transform, contain: s.contain, containerType: s.containerType }); } return out; });
    assert.ok(Math.abs(dialog.x + dialog.width / 2 - 450) < 2, `course dialog stays centered on the window: ${JSON.stringify({ dialog, ancestors })}`);
    assert.ok(dialog.y >= 24 && dialog.y + dialog.height <= 676, 'course settings fits a shorter desktop window');
    await settings.getByRole('button', { name: 'Guardar cambios', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/apheka-final-curso-ajustes-900.png' });
    await settings.getByTitle('Cerrar', { exact: true }).click();
    await page.getByRole('button', { name: 'Vista General', exact: true }).click();
    await page.waitForTimeout(700);
    await page.setViewportSize({ width: 900, height: 800 });
    await page.getByText('Ideas claras, espacio para pensar.', { exact: true }).click();
    const edit = page.getByTitle('Editar apunte', { exact: true });
    if (await edit.count()) await edit.click();
    else await page.getByTitle('Editar', { exact: true }).last().click();
    const writer = page.getByRole('textbox', { name: 'Contenido del apunte', exact: true });
    await writer.waitFor();
    assert.ok((await writer.boundingBox()).width >= 400, 'course editor retains comfortable writing width');
    await writer.fill('Última revisión: sin bloques apretados.');
    await page.screenshot({ path: 'docs/apheka-final-curso-editor-900.png' });
    assert.deepEqual(errors, []);
    console.log('PASS course controls, study columns and editor at four desktop widths, menu open/closed; centered course settings at 900x700');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
