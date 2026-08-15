// ═══════════════════════════════════════════════════
//  CHARVIS — Panel de proveedores de IA (Ajustes → Sistema)
//  Tarjetas solo-logo (sin nombres, sin colores de marca) y
//  detalle en modal: primero VALIDAR la API, luego elegir
//  modelo y por último ACTIVAR el proveedor.
// ═══════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, Eye, EyeOff, ExternalLink, KeyRound, Globe, Cpu, ShieldCheck, ChevronDown, Boxes } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useApp } from '../../store/AppContext';
import { BrandLogo } from '../../lib/ai/providerBrands';
import {
  CHARVIS_PROVIDERS,
  CharvisProvider,
  CharvisProviderState,
  DEFAULT_PROVIDER_ID,
  providerState,
  fetchProviderModels,
} from '../../lib/ai/aiProviders';

const STORAGE_KEY = 'owa_charvis_providers_v1';

export default function CharvisProviders() {
  const { settings, updateSettings, addNotification } = useApp();
  const activeId = settings.owaBrainProvider || DEFAULT_PROVIDER_ID;

  const [states, setStates] = useState<Record<string, CharvisProviderState>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelsNote, setModelsNote] = useState('');

  const expanded: CharvisProvider = CHARVIS_PROVIDERS.find(p => p.id === openId) || CHARVIS_PROVIDERS[0];
  const st = providerState(states, expanded);
  const isActive = openId ? activeId === expanded.id : false;

  const persist = (next: Record<string, CharvisProviderState>) => {
    setStates(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  // Al abrir el modal de un proveedor se cargan los borradores desde el estado guardado.
  useEffect(() => {
    if (!openId) return;
    const p = CHARVIS_PROVIDERS.find(pp => pp.id === openId) || CHARVIS_PROVIDERS[0];
    const s = providerState(states, p);
    setApiKeyDraft(s.apiKey);
    setUrlDraft(s.baseUrl || p.baseUrl);
    setModelDraft(s.model || s.models[0] || p.defaultModel);
    setModels(s.models.length ? s.models : p.defaultModels);
    setModelsNote(s.validatedAt ? 'Modelos detectados con tu API' : 'Pulsa "Validar API" para detectar los modelos exactos de tu cuenta');
    setResult(null);
    setShowKey(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  // Escape cierra el modal.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  // VALIDAR: comprueba la clave, detecta los modelos y guarda borradores (NO activa).
  const validate = async () => {
    const p = expanded;
    const apiKey = apiKeyDraft.trim();
    const baseUrl = (urlDraft.trim() || p.baseUrl).replace(/\/+$/, '');
    const model = modelDraft || p.defaultModel;
    setValidating(true);
    setResult(null);
    try {
      const { probeProvider } = await import('../../lib/ai/aiProvider');
      const probe = await probeProvider({ apiKey, model, baseUrl });
      let detected: string[] = [];
      let note = '';
      if (probe.ok) {
        try {
          detected = await fetchProviderModels(baseUrl, apiKey);
          note = detected.length ? `${detected.length} modelos detectados con tu API` : 'El endpoint /models devolvió vacío — lista de referencia';
        } catch {
          detected = p.defaultModels;
          note = 'El proveedor no expone /models — lista de referencia';
        }
      } else {
        detected = p.defaultModels;
        note = '';
      }
      const finalModels = detected.slice(0, 80);
      const finalModel = finalModels.includes(model) ? model : (finalModels[0] || p.defaultModel);
      const nextState: CharvisProviderState = {
        apiKey, baseUrl, model: finalModel, models: finalModels,
        validatedAt: probe.ok ? Date.now() : (st.validatedAt || null),
      };
      persist({ ...states, [p.id]: nextState });
      setModelDraft(finalModel);
      setModels(finalModels);
      setModelsNote(note);
      if (probe.ok) {
        setResult({ ok: true, msg: `Clave válida · HTTP ${probe.status} · ${probe.latencyMs} ms · ${finalModels.length} modelos` });
        addNotification(`${p.name}: clave válida (${probe.latencyMs} ms)`, 'success');
      } else {
        setResult({ ok: false, msg: `HTTP ${probe.status} · ${probe.message}` });
      }
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setValidating(false);
    }
  };

  // ACTIVAR: aplica la clave validada y el modelo elegido al proveedor activo de Charvis.
  const activate = () => {
    const p = expanded;
    const apiKey = apiKeyDraft.trim();
    const baseUrl = (urlDraft.trim() || p.baseUrl).replace(/\/+$/, '');
    const model = modelDraft || p.defaultModel;
    const nextState: CharvisProviderState = { ...st, apiKey, baseUrl, model, models: models.length ? models : st.models };
    persist({ ...states, [p.id]: nextState });
    updateSettings({ owaBrainProvider: p.id, owaBrainApiKey: apiKey, owaBrainBaseUrl: baseUrl, owaBrainModel: model } as any);
    addNotification(`${p.name} activado como proveedor de Charvis`, 'success');
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Boxes size={12} /> Proveedor de IA
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cada proveedor guarda su propia clave en tu dispositivo</span>
      </div>

      {/* Grid de proveedores: solo logos oficiales, sin nombres ni colores de marca */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 10 }}>
        {CHARVIS_PROVIDERS.map(p => {
          const ps = providerState(states, p);
          const active = activeId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setOpenId(p.id)}
              title={`${p.name} — ${p.baseUrl}`}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                aspectRatio: '1',
                borderRadius: 16,
                cursor: 'pointer',
                background: 'linear-gradient(160deg, var(--bg-elevated) 0%, var(--bg-deep) 100%)',
                border: active ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                boxShadow: active ? '0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent), 0 10px 26px rgba(0,0,0,0.20)' : '0 2px 8px rgba(0,0,0,0.10)',
                transition: 'all 170ms',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              <BrandLogo id={p.id} size={64} radius={17} />
              {active && (
                <span style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
              )}
              {ps.validatedAt && (
                <span style={{ position: 'absolute', bottom: 9, right: 9, color: '#10B981', display: 'flex', alignItems: 'center' }}>
                  <ShieldCheck size={13} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Modal de detalle del proveedor */}
      {openId && createPortal(
        <div
          onClick={() => setOpenId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99995,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bento-card"
            style={{
              width: 540, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto',
              borderRadius: 18,
              border: '1px solid var(--border-soft)',
              boxShadow: '0 40px 90px rgba(0,0,0,0.55)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '22px 28px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
              <BrandLogo id={expanded.id} size={52} radius={15} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{expanded.name}</span>
                  {isActive && (
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)', borderRadius: 6, padding: '2px 7px' }}>Activo</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{expanded.baseUrl}</div>
              </div>
              <a href={expanded.docsUrl} target="_blank" rel="noreferrer" title="Documentación oficial"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-secondary)', textDecoration: 'none', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', whiteSpace: 'nowrap' }}>
                <ExternalLink size={11} /> Docs
              </a>
              <button
                onClick={() => setOpenId(null)}
                title="Cerrar"
                style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '18px 28px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* API key */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <KeyRound size={11} /> API Key de {expanded.name}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyDraft}
                    onChange={e => setApiKeyDraft(e.target.value)}
                    placeholder={expanded.id === 'opencode' ? 'sk-... (opcional: funciona gratis sin clave)' : 'sk-...'}
                    className="input-base"
                    style={{ flex: 1, height: 40, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                    onKeyDown={e => { if (e.key === 'Enter') validate(); }}
                  />
                  <button onClick={() => setShowKey(s => !s)} title={showKey ? 'Ocultar' : 'Mostrar'} style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{expanded.keyHint}</p>
              </div>

              {/* Base URL */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Globe size={11} /> URL base (endpoint OpenAI-compatible)
                </label>
                <input
                  type="text"
                  value={urlDraft}
                  onChange={e => setUrlDraft(e.target.value)}
                  className="input-base"
                  style={{ width: '100%', height: 40, fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>

              {/* Modelo */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Cpu size={11} /> Modelo · {models.length}
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={modelDraft}
                    onChange={e => setModelDraft(e.target.value)}
                    className="input-base"
                    style={{ width: '100%', height: 40, fontSize: 12, appearance: 'none', paddingRight: 30, fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {models.length ? (
                      <>
                        {!models.includes(modelDraft) && modelDraft && <option value={modelDraft}>{modelDraft}</option>}
                        {models.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </>
                    ) : (
                      <option value={expanded.defaultModel}>{expanded.defaultModel}</option>
                    )}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: 14, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{modelsNote || 'Valida tu API para detectar los modelos exactos de tu cuenta.'}</p>
              </div>

              {/* Resultado */}
              {result && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px', borderRadius: 9,
                  background: result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${result.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  fontSize: 11, fontWeight: 500,
                  color: result.ok ? '#34d399' : '#f87171',
                }}>
                  {result.ok ? <Check size={13} /> : <X size={13} />}
                  {result.msg}
                </div>
              )}

              {/* Acciones: primero validar, después activar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                <button
                  onClick={validate}
                  disabled={validating}
                  title="Comprueba tu API, detecta los modelos y guarda la configuración (sin activarla todavía)"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
                    transition: 'all 150ms', opacity: validating ? 0.6 : 1,
                  }}
                >
                  {validating ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />}
                  {validating ? 'Validando…' : 'Validar API'}
                </button>
                <button
                  onClick={activate}
                  disabled={validating || !st.validatedAt}
                  title={st.validatedAt ? `Activar ${expanded.name} como proveedor de Charvis` : 'Primero valida tu API para poder activar este proveedor'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9,
                    fontSize: 12, fontWeight: 600, cursor: st.validatedAt ? 'pointer' : 'not-allowed',
                    background: st.validatedAt ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--bg-deep)',
                    border: st.validatedAt ? '1px solid color-mix(in srgb, var(--accent) 55%, transparent)' : '1px solid var(--border-soft)',
                    color: st.validatedAt ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'all 150ms', opacity: validating ? 0.6 : 1,
                  }}
                >
                  <Check size={13} /> Activar proveedor
                </button>
                {st.validatedAt && (
                  <span style={{ fontSize: 10, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldCheck size={11} /> Verificado
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}