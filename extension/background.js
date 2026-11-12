// ── APHEKA — Ventanas v2.0: service worker autónomo ─────────────────────
// Todo vive en chrome.storage.local: sin app, sin servidor, sin emparejamiento.
// Secciones: grupos de pestañas (CRUD), bloqueo de páginas y rendimiento.

// ── Estado ──
async function getState() {
  const { owaState } = await chrome.storage.local.get('owaState');
  return owaState || { folders: [], blocks: [] };
}
async function setState(st) {
  await chrome.storage.local.set({ owaState: st });
}
const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ── Grupos abiertos: tracking folderId → groupId ("ya está abierto") ──
async function getOpenGroups() {
  const { owaOpenGroups } = await chrome.storage.local.get('owaOpenGroups');
  return owaOpenGroups || {};
}
async function setOpenGroups(map) {
  await chrome.storage.local.set({ owaOpenGroups: map });
}
async function forgetGroup(folderId) {
  const map = await getOpenGroups();
  if (map[folderId]) { delete map[folderId]; await setOpenGroups(map); }
}

// Abre la carpeta como grupo de pestañas de Chrome. Si ya está abierta,
// la enfoca (descollar + activar) en vez de duplicar. Devuelve { focused }.
async function openFolderTabs(name, urls, folderId) {
  if (folderId) {
    const map = await getOpenGroups();
    const entry = map[folderId];
    if (entry && entry.groupId) {
      let tabsInGroup = [];
      try { tabsInGroup = await chrome.tabs.query({ groupId: entry.groupId }); } catch (e) { /* grupo inexistente */ }
      if (tabsInGroup.length > 0) {
        try { await chrome.tabGroups.update(entry.groupId, { collapsed: false }); } catch (e) { /* noop */ }
        const target = tabsInGroup.find(t => !t.discarded) || tabsInGroup[0];
        try {
          await chrome.tabs.update(target.id, { active: true });
          if (target.windowId) await chrome.windows.update(target.windowId, { focused: true });
        } catch (e) { /* noop */ }
        return { focused: true };
      }
      await forgetGroup(folderId);
    }
  }
  const ids = [];
  for (const u of urls) {
    try {
      const tab = await chrome.tabs.create({ url: u.url, active: false });
      ids.push(tab.id);
    } catch (e) { /* url inválida: continúa */ }
  }
  if (ids.length >= 2 && chrome.tabGroups) {
    try {
      const gid = await chrome.tabs.group({ tabIds: ids });
      await chrome.tabGroups.update(gid, { title: (name || 'APHEKA').slice(0, 24), color: 'pink' });
      if (folderId) {
        const map = await getOpenGroups();
        map[folderId] = { groupId: gid, title: name || 'APHEKA', at: Date.now() };
        await setOpenGroups(map);
      }
    } catch (e) { /* sin grupo: pestañas sueltas */ }
  }
  return { focused: false };
}

// Cierra el grupo abierto de una carpeta (sin borrar la carpeta)
async function closeFolderGroup(folderId) {
  const map = await getOpenGroups();
  const entry = map[folderId];
  if (!entry || !entry.groupId) return 0;
  let tabsInGroup = [];
  try { tabsInGroup = await chrome.tabs.query({ groupId: entry.groupId }); } catch (e) { /* ya no existe */ }
  if (tabsInGroup.length) await chrome.tabs.remove(tabsInGroup.map(t => t.id));
  await forgetGroup(folderId);
  return tabsInGroup.length;
}

// Limpieza viva: grupo sin pestañas o grupo cerrado → se olvida
chrome.tabs.onRemoved.addListener(() => {
  void (async () => {
    const map = await getOpenGroups();
    for (const fid of Object.keys(map)) {
      if (!map[fid] || !map[fid].groupId) continue;
      let tabsInGroup = [];
      try { tabsInGroup = await chrome.tabs.query({ groupId: map[fid].groupId }); } catch (e) { tabsInGroup = []; }
      if (tabsInGroup.length === 0) await forgetGroup(fid);
    }
  })();
});
if (chrome.tabGroups && chrome.tabGroups.onRemoved) {
  chrome.tabGroups.onRemoved.addListener(group => {
    void (async () => {
      const map = await getOpenGroups();
      for (const fid of Object.keys(map)) {
        if (map[fid] && map[fid].groupId === group.groupId) { await forgetGroup(fid); break; }
      }
    })();
  });
}

// ── Bloqueo de páginas ──
function isWithinBlockTime(from, to) {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const f = fh * 60 + (fm || 0);
  const t = th * 60 + (tm || 0);
  if (t >= f) return mins >= f && mins < t;
  return mins >= f || mins < t; // horario que cruza medianoche
}

function blockedDomainFor(url, blocks) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    for (const b of blocks || []) {
      if (!b.enabled) continue;
      if (host === b.domain || host.endsWith('.' + b.domain)) {
        if (isWithinBlockTime(b.from, b.to)) return b;
      }
    }
  } catch (e) { /* url inválida */ }
  return null;
}

async function enforceBlock(tabId, url) {
  if (!url || !url.startsWith('http')) return;
  const st = await getState();
  const b = blockedDomainFor(url, st.blocks);
  if (b) {
    const target = chrome.runtime.getURL('block.html') + '?d=' + encodeURIComponent(b.domain) + '&to=' + encodeURIComponent(b.to);
    chrome.tabs.update(tabId, { url: target });
  }
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) void enforceBlock(tabId, changeInfo.url);
});
chrome.tabs.onCreated.addListener(tab => {
  if (tab.pendingUrl) void enforceBlock(tab.id, tab.pendingUrl);
});

// ── Rendimiento: auto-suspensión de pestañas inactivas ──
async function autoSuspend() {
  const { owaAutoSuspend } = await chrome.storage.local.get('owaAutoSuspend');
  const minutes = owaAutoSuspend || 0;
  if (!minutes) return;
  const thresholdMs = minutes * 60000;
  const now = Date.now();
  for (const t of await chrome.tabs.query({})) {
    if (t.active || t.pinned || t.audible || t.discarded) continue;
    if (!t.url || !/^https?:/i.test(t.url)) continue;
    const idleMs = t.lastAccessed ? now - t.lastAccessed : 0;
    if (idleMs > thresholdMs) {
      try { await chrome.tabs.discard(t.id); } catch (e) { /* noop */ }
    }
  }
}
chrome.alarms.create('owa-autosuspend', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'owa-autosuspend') void autoSuspend(); });

// ── Mensajes del popup ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'openFolder') {
      const st = await getState();
      const folder = (st.folders || []).find(f => f.id === msg.folderId);
      if (!folder || !(folder.urls || []).length) { sendResponse({ ok: false, error: 'La carpeta está vacía o no existe' }); return; }
      const r = await openFolderTabs(folder.name, folder.urls, folder.id);
      sendResponse({ ok: true, focused: r.focused });
      return;
    }
    if (msg.type === 'closeFolder') {
      const closed = await closeFolderGroup(msg.folderId);
      sendResponse({ ok: true, closed });
      return;
    }
    if (msg.type === 'createFolder') {
      const st = await getState();
      const folder = { id: uid(), name: (msg.name || 'Nuevo grupo').slice(0, 60), parentId: null, urls: [], createdAt: Date.now() };
      await setState({ ...st, folders: [...(st.folders || []), folder] });
      sendResponse({ ok: true, folderId: folder.id });
      return;
    }
    if (msg.type === 'renameFolder') {
      const st = await getState();
      await setState({ ...st, folders: st.folders.map(f => f.id === msg.folderId ? { ...f, name: (msg.name || f.name).slice(0, 60) } : f) });
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'deleteFolder') {
      const st = await getState();
      const doomed = new Set([msg.folderId]);
      let grew = true;
      while (grew) {
        grew = false;
        st.folders.forEach(f => { if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) { doomed.add(f.id); grew = true; } });
      }
      await setState({ ...st, folders: st.folders.filter(f => !doomed.has(f.id)) });
      await closeFolderGroup(msg.folderId); // si su grupo está abierto, ciérralo también
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'addUrl') {
      const st = await getState();
      let u = msg.url || '';
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      let title = (msg.title || '').trim();
      if (!title) { try { title = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { title = u; } }
      await setState({ ...st, folders: st.folders.map(f => f.id === msg.folderId ? { ...f, urls: [...(f.urls || []), { id: uid(), url: u, title }] } : f) });
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'saveTabs') {
      const st = await getState();
      const existing = new Set((st.folders || []).flatMap(f => (f.urls || []).map(u => (u.url || '').split('#')[0])));
      const seen = new Set();
      const urls = [];
      let skipped = 0;
      for (const u of msg.urls || []) {
        const key = (u.url || '').split('#')[0];
        if (!key || seen.has(key) || existing.has(key)) { skipped++; continue; }
        seen.add(key);
        urls.push({ id: uid(), url: u.url, title: u.title || u.url });
      }
      if (!urls.length) { sendResponse({ ok: false, error: 'Esas pestañas ya están guardadas' }); return; }
      const folder = {
        id: uid(),
        name: msg.name || 'Pestañas guardadas',
        parentId: null,
        urls,
        createdAt: Date.now(),
      };
      await setState({ ...st, folders: [...(st.folders || []), folder] });
      sendResponse({ ok: true, folderId: folder.id, skipped });
      return;
    }
    if (msg.type === 'toggleBlock') {
      const st = await getState();
      await setState({ ...st, blocks: st.blocks.map(b => b.id === msg.blockId ? { ...b, enabled: !b.enabled } : b) });
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'deleteBlock') {
      const st = await getState();
      await setState({ ...st, blocks: st.blocks.filter(b => b.id !== msg.blockId) });
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'addBlock') {
      const st = await getState();
      if (!msg.domain) { sendResponse({ ok: false, error: 'Dominio vacío' }); return; }
      await setState({ ...st, blocks: [...st.blocks, { id: uid(), domain: msg.domain, from: msg.from || '08:00', to: msg.to || '18:00', enabled: true }] });
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'suspendNow' || msg.type === 'suspendInactive') {
      let n = 0;
      for (const t of await chrome.tabs.query({})) {
        if (t.active || t.pinned || t.audible || t.discarded) continue;
        if (!t.url || !/^https?:/i.test(t.url)) continue;
        try { await chrome.tabs.discard(t.id); n++; } catch (e) { /* noop */ }
      }
      if (n > 0) {
        const { owaSuspendStats } = await chrome.storage.local.get('owaSuspendStats');
        const total = ((owaSuspendStats && owaSuspendStats.total) || 0) + n;
        await chrome.storage.local.set({ owaSuspendStats: { total } });
      }
      sendResponse({ ok: true, count: n });
      return;
    }
    if (msg.type === 'closeDuplicates') {
      const seen = new Set();
      const toClose = [];
      for (const t of await chrome.tabs.query({})) {
        if (!t.url) continue;
        const key = t.url.split('#')[0];
        if (key.startsWith('chrome://') || key.startsWith('chrome-extension://')) continue;
        if (seen.has(key)) { if (!t.active) toClose.push(t); } else seen.add(key);
      }
      for (const t of toClose) {
        try { await chrome.tabs.remove(t.id); } catch (e) { /* noop */ }
      }
      sendResponse({ ok: true, count: toClose.length });
      return;
    }
    sendResponse({ ok: false, error: 'mensaje desconocido' });
  })();
  return true;
});
