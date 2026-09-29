// ── OWA Ventanas — popup v2.0 (grupos · bloqueos · rendimiento) ─────────────
// Extensión autónoma: todo vive en chrome.storage.local, sin app ni servidor.
const $ = id => document.getElementById(id);

// Paleta de grupos de Chrome + hash estable: color fijo por carpeta.
const GROUP_COLORS = ['#8AB4F8', '#78D9EC', '#81C995', '#FDD663', '#FABA6E', '#F28B82', '#F890CB', '#C58AF9'];
function folderColor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}

function send(msg) {
  return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
}
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2200);
}

// ── Pestañas ──
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    btn.classList.add('on');
    $('view-' + btn.dataset.tab).classList.add('on');
    if (btn.dataset.tab === 'rendimiento') renderPerf();
  });
});

// ── Estado general ──
async function refresh() {
  await renderGroups();
}

// ── GRUPOS: lista + CRUD ──
async function renderGroups() {
  const { owaState, owaOpenGroups } = await chrome.storage.local.get(['owaState', 'owaOpenGroups']);
  const state = owaState || { folders: [], blocks: [] };
  const open = owaOpenGroups || {};
  const wrap = $('groups');
  wrap.innerHTML = '';
  const roots = (state.folders || []).filter(f => !f.parentId);
  if (roots.length === 0) {
    wrap.innerHTML = '<div class="empty">Sin grupos todavía.<br>Escribe un nombre arriba y pulsa + para crear el primero, o guarda tus pestañas abiertas.</div>';
    return;
  }
  roots.forEach(f => {
    const color = folderColor(f.id);
    const isOpen = !!open[f.id];
    const el = document.createElement('div');
    el.className = 'grp' + (isOpen ? ' open' : '');
    el.innerHTML =
      '<div class="grp-top">' +
      '<span class="dot" style="background:' + color + '"></span>' +
      '<span class="name" title="' + escapeHtml(f.name) + '">' + escapeHtml(f.name) + '</span>' +
      (isOpen ? '<span class="badge">ACTIVA</span>' : '') +
      '<span class="cnt">' + (f.urls || []).length + '</span>' +
      '</div>' +
      '<div class="grp-actions">' +
      (isOpen
        ? '<button class="openb" data-act="focus">' + eyeSvg() + 'Enfocar</button>' +
          '<button data-act="close">' + xSvg() + 'Cerrar grupo</button>'
        : '<button class="openb" data-act="open">' + playSvg() + 'Abrir como grupo</button>') +
      '<button data-act="addurl">' + plusSvg() + 'Página</button>' +
      '<button data-act="rename">' + penSvg() + 'Renombrar</button>' +
      '<button class="danger" data-act="delete">' + trashSvg() + 'Eliminar</button>' +
      '</div>';
    el.querySelector('[data-act="open"]').onclick = async () => {
      const r = await send({ type: 'openFolder', folderId: f.id });
      if (r && r.ok) { if (r.focused) toast('Ya estaba abierta — enfocada'); await refresh(); setTimeout(() => window.close(), 450); }
      else toast((r && r.error) || 'No se pudo abrir');
    };
    const focusBtn = el.querySelector('[data-act="focus"]');
    if (focusBtn) focusBtn.onclick = async () => {
      await send({ type: 'openFolder', folderId: f.id }); // focus-if-open
      toast('Grupo enfocado');
      await refresh();
    };
    const closeBtn = el.querySelector('[data-act="close"]');
    if (closeBtn) closeBtn.onclick = async () => {
      const r = await send({ type: 'closeFolder', folderId: f.id });
      toast(r && r.ok ? 'Grupo cerrado (pestañas cerradas)' : ((r && r.error) || 'No se pudo cerrar'));
      await refresh();
    };
    el.querySelector('[data-act="addurl"]').onclick = async () => {
      let u = prompt('URL de la página:', 'https://');
      if (!u || !u.trim()) return;
      u = u.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const title = prompt('Nombre (opcional — Enter para usar el dominio):', '') || '';
      const r = await send({ type: 'addUrl', folderId: f.id, url: u, title: title.trim() });
      toast(r && r.ok ? 'Página añadida' : ((r && r.error) || 'No se pudo añadir'));
      await refresh();
    };
    el.querySelector('[data-act="rename"]').onclick = async () => {
      const name = prompt('Nuevo nombre del grupo:', f.name);
      if (!name || !name.trim() || name.trim() === f.name) return;
      const r = await send({ type: 'renameFolder', folderId: f.id, name: name.trim() });
      toast(r && r.ok ? 'Grupo renombrado' : 'No se pudo renombrar');
      await refresh();
    };
    el.querySelector('[data-act="delete"]').onclick = async () => {
      if (!confirm('¿Eliminar el grupo «' + f.name + '» y sus ' + (f.urls || []).length + ' páginas guardadas?')) return;
      const r = await send({ type: 'deleteFolder', folderId: f.id });
      toast(r && r.ok ? 'Grupo eliminado' : 'No se pudo eliminar');
      await refresh();
    };
    wrap.appendChild(el);
  });
}

$('createGroupBtn').onclick = async () => {
  const name = $('newGroupName').value.trim();
  if (!name) { toast('Escribe un nombre para el grupo'); return; }
  const r = await send({ type: 'createFolder', name });
  if (r && r.ok) { $('newGroupName').value = ''; toast('Grupo «' + name + '» creado'); await renderGroups(); }
  else toast('No se pudo crear');
};
$('newGroupName').addEventListener('keydown', e => { if (e.key === 'Enter') $('createGroupBtn').click(); });

// ── Guardar pestañas abiertas como grupo (sin duplicados) ──
$('saveTabsBtn').onclick = async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const urls = tabs.filter(t => t.url && /^https?:/i.test(t.url)).map(t => ({ url: t.url, title: t.title }));
  if (urls.length === 0) { toast('No hay pestañas web abiertas para guardar'); return; }
  const name = prompt('Nombre del grupo:', 'Pestañas · ' + new Date().toLocaleDateString('es', { day: '2-digit', month: 'short' }));
  if (!name) return;
  const r = await send({ type: 'saveTabs', name: name.trim(), urls });
  if (r && r.ok) toast(r.skipped > 0 ? `Grupo guardado · ${r.skipped} duplicadas omitidas` : 'Grupo guardado');
  else toast((r && r.error) || 'No se pudo guardar');
  await renderGroups();
};

// ── BLOQUEOS ──
async function renderBlocks() {
  const { owaState } = await chrome.storage.local.get('owaState');
  const blocks = (owaState && owaState.blocks) || [];
  const wrap = $('blocks');
  wrap.innerHTML = '';
  if (blocks.length === 0) {
    wrap.innerHTML = '<div class="empty">Sin bloqueos todavía.<br>Agrega un sitio y un horario arriba.</div>';
    return;
  }
  blocks.forEach(b => {
    const active = b.enabled && isNowWithin(b.from, b.to);
    const el = document.createElement('div');
    el.className = 'brow' + (b.enabled ? '' : ' off');
    el.innerHTML =
      '<div class="info">' +
      '<div class="d">' + escapeHtml(b.domain) + '</div>' +
      '<div class="h">' + b.from + ' — ' + b.to + (active ? ' · <span class="active">BLOQUEANDO AHORA</span>' : '') + '</div>' +
      '</div>' +
      '<button class="sw' + (b.enabled ? ' on' : '') + '" title="' + (b.enabled ? 'Desactivar' : 'Activar') + '"><span class="k"></span></button>' +
      '<button class="iconbtn" title="Eliminar">' + trashSvg() + '</button>';
    el.querySelector('.sw').onclick = async () => {
      const r = await send({ type: 'toggleBlock', blockId: b.id });
      if (!(r && r.ok)) toast('No se pudo cambiar');
      await renderBlocks();
    };
    el.querySelector('.iconbtn').onclick = async () => {
      if (!confirm('¿Eliminar el bloqueo de ' + b.domain + '?')) return;
      const r = await send({ type: 'deleteBlock', blockId: b.id });
      toast(r && r.ok ? 'Bloqueo eliminado' : 'No se pudo eliminar');
      await renderBlocks();
    };
    wrap.appendChild(el);
  });
}
function isNowWithin(from, to) {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const f = fh * 60 + (fm || 0), t = th * 60 + (tm || 0);
  if (t >= f) return mins >= f && mins < t;
  return mins >= f || mins < t;
}
$('addBlockBtn').onclick = async () => {
  const domain = $('bDomain').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  if (!domain) { toast('Escribe el sitio a bloquear'); return; }
  const r = await send({ type: 'addBlock', domain, from: $('bFrom').value, to: $('bTo').value });
  if (r && r.ok) { $('bDomain').value = ''; toast(domain + ' se bloqueará de ' + $('bFrom').value + ' a ' + $('bTo').value); await renderBlocks(); }
  else toast((r && r.error) || 'No se pudo agregar');
};
$('bDomain').addEventListener('keydown', e => { if (e.key === 'Enter') $('addBlockBtn').click(); });

// ── RENDIMIENTO ──
async function renderPerf() {
  const { owaAutoSuspend, owaSuspendStats, owaAdblock } = await chrome.storage.local.get(['owaAutoSuspend', 'owaSuspendStats', 'owaAdblock']);
  $('autoSuspend').value = String(owaAutoSuspend || 0);
  const tabs = await chrome.tabs.query({});
  $('statTabs').textContent = String(tabs.length);
  const stats = owaSuspendStats || { total: 0 };
  $('statSuspended').textContent = String(stats.total || 0);
  $('statSaved').textContent = String(Math.round((stats.total || 0) * 70));
  const on = !!owaAdblock;
  $('adblockToggle').classList.toggle('on', on);
  $('adblockSub').textContent = on ? 'Activo · 100 reglas de anuncios y rastreadores' : '100 reglas de anuncios y rastreadores';
}
$('autoSuspend').onchange = async () => {
  await chrome.storage.local.set({ owaAutoSuspend: parseInt($('autoSuspend').value) || 0 });
  toast($('autoSuspend').value === '0' ? 'Auto-suspensión desactivada' : 'Auto-suspensión tras ' + $('autoSuspend').value + ' min sin uso');
};
const suspendNow = async () => {
  const r = await send({ type: 'suspendNow' });
  if (r && r.ok) {
    if (r.count > 0) await chrome.storage.local.set({ owaSuspendStats: { total: ((await chrome.storage.local.get('owaSuspendStats')).owaSuspendStats || { total: 0 }).total + r.count } });
    toast(r && r.count > 0 ? r.count + ' pestaña(s) suspendidas · ~' + Math.round(r.count * 70) + ' MB liberados' : 'Nada que liberar');
  } else toast('No se pudo');
  await renderPerf();
};
$('freeRamBtn').onclick = suspendNow;
$('suspendNowBtn').onclick = suspendNow;
$('dupesBtn').onclick = async () => {
  const r = await send({ type: 'closeDuplicates' });
  toast(r && r.ok ? (r.count > 0 ? r.count + ' duplicada(s) cerradas' : 'No hay duplicadas') : 'No se pudo');
};
$('adblockToggle').onclick = async () => {
  const { owaAdblock } = await chrome.storage.local.get('owaAdblock');
  const nv = !owaAdblock;
  await chrome.storage.local.set({ owaAdblock: nv });
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    [nv ? 'enableRulesetIds' : 'disableRulesetIds']: ['owa_ads'],
  });
  await renderPerf();
};

// iconos inline
function eyeSvg() { return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'; }
function playSvg() { return '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21"/></svg>'; }
function xSvg() { return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'; }
function penSvg() { return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>'; }
function plusSvg() { return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'; }
function trashSvg() { return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'; }

// arranque
(async () => {
  await refresh();
  await renderBlocks();
  await renderPerf();
})();
