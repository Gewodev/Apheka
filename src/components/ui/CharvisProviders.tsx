// ═══════════════════════════════════════════════════
//  CHARVIS — Panel de proveedores de IA (Ajustes → Sistema)
//  Tarjetas solo-logo (marca oficial en su color sobre tile
//  neutro) y detalle en modal: primero VALIDAR la API, luego
//  elegir modelo y por último ACTIVAR el proveedor.
// ═══════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, Eye, EyeOff, ChevronDown, RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useApp } from '../../store/AppContext';
import { BrandLogo, providerBrandColor } from '../../lib/ai/providerBrands';
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
  const activeProvider: CharvisProvider = CHARVIS_PROVIDERS.find(p => p.id === activeId) || CHARVIS_PROVIDERS[0];

  const [states, setStates] = useState<Record<string, CharvisProviderState>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
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

  // Al abrir el modal de un proveedor se cargan los borradores desde el estado guardado
  // y se detectan los modelos AUTOMÁTICAMENTE (opencode no necesita clave; con clave
  // guardada se consulta el /models real del proveedor, como en Gemini).
  useEffect(() => {
    if (!openId) return;
    const p = CHARVIS_PROVIDERS.find(pp => pp.id === openId) || CHARVIS_PROVIDERS[0];
    const s = providerState(states, p);
    setApiKeyDraft(s.apiKey);
    setUrlDraft(s.baseUrl || p.baseUrl);
    setModelDraft(s.validatedAt ? (s.model || s.models[0] || '') : '');
    setModels(s.validatedAt ? s.models : []);
    setModelsNote(s.validatedAt ? 'Modelos detectados con tu API' : 'Valida tu API para detectar los modelos exactos de tu cuenta');
    setResult(null);
    setShowKey(false);
    if ((!s.validatedAt || p.id === activeId) && (p.id === 'opencode' || s.apiKey.trim())) {
      let cancelled = false;
      (async () => {
        try {
          const detected = await fetchProviderModels(s.baseUrl || p.baseUrl, s.apiKey.trim());
          if (cancelled) return;
          if (detected.length) {
            const list = detected.slice(0, 80);
            setModels(list);
            setModelsNote(`${list.length} modelos detectados desde la API de ${p.name} (automático)`);
            setModelDraft(m => m || list[0] || '');
          }
        } catch {}
      })();
      return () => { cancelled = true; };
    }
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
      const finalModel = finalModels.includes(model) ? model : (finalModels[0] || model || p.defaultModel);
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

  // DIAGNOSTICAR: vuelve a consultar /models en vivo (por si el proveedor
  // actualizó o retiró modelos) usando la clave/URL actuales. NO usa la
  // lista de referencia: solo lo que devuelve la API.
  const diagnose = async () => {
    const p = expanded;
    const apiKey = apiKeyDraft.trim();
    const baseUrl = (urlDraft.trim() || p.baseUrl).replace(/\/+$/, '');
    setDiagnosing(true);
    setResult(null);
    try {
      const detected = await fetchProviderModels(baseUrl, apiKey);
      if (!detected.length) throw new Error('El endpoint /models devolvió vacío');
      const list = detected.slice(0, 80);
      setModels(list);
      setModelDraft(m => (m && list.includes(m) ? m : list[0] || m));
      const note = `${list.length} modelos detectados desde la API de ${p.name} (diagnóstico en vivo)`;
      setModelsNote(note);
      const nextState: CharvisProviderState = { ...st, apiKey, baseUrl, models: list, model: list.includes(modelDraft) ? modelDraft : (list[0] || st.model) };
      persist({ ...states, [p.id]: nextState });
      setResult({ ok: true, msg: `Diagnóstico: ${list.length} modelos disponibles en la API` });
      addNotification(`${p.name}: ${list.length} modelos detectados desde la API`, 'success');
    } catch (err) {
      setModelsNote('No se pudo consultar /models — revisa tu clave o la URL base');
      setResult({ ok: false, msg: `Diagnóstico fallido: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setDiagnosing(false);
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

  const validated = !!st.validatedAt;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Proveedor de IA
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cada proveedor guarda su propia clave en tu dispositivo</span>
      </div>

      {/* Grid de proveedores: solo logos oficiales en su color de marca, sin nombres */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 12 }}>
        {CHARVIS_PROVIDERS.map(p => {
          const ps = providerState(states, p);
          const active = activeId === p.id;
          const verified = !!ps.validatedAt;
          return (
            <button
              key={p.id}
              onClick={() => setOpenId(p.id)}
              title={`${p.name} — ${p.baseUrl}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                aspectRatio: '1',
                borderRadius: 18,
                cursor: 'pointer',
                background: 'linear-gradient(160deg, var(--bg-elevated) 0%, var(--bg-deep) 100%)',
                border: active ? '1.5px solid var(--accent)' : verified ? `1.5px solid ${p.brandColor}` : '1px solid var(--border-subtle)',
                boxShadow: active
                  ? '0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent), 0 12px 28px rgba(0,0,0,0.22)'
                  : verified
                    ? `0 0 14px ${p.brandColor}22, 0 8px 22px rgba(0,0,0,0.16)`
                    : '0 2px 8px rgba(0,0,0,0.10)',
                transition: 'all 180ms',
              }}
              onMouseEnter={e => { if (!active && !verified) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
              onMouseLeave={e => { if (!active && !verified) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              <BrandLogo id={p.id} size={76} radius={19} />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 30px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
              <BrandLogo id={expanded.id} size={60} radius={16} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{expanded.name}</span>
                  {isActive && (
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)', borderRadius: 6, padding: '2px 7px' }}>Activo</span>
                  )}
                  {validated && !isActive && (
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#34d399', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 6, padding: '2px 7px' }}>Validado</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>{expanded.baseUrl}</div>
              </div>
              {expanded.docsUrl && (
                <a href={expanded.docsUrl} target="_blank" rel="noreferrer" title="Documentación oficial"
                  style={{ fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'none', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-deep)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  Documentación
                </a>
              )}
              <button
                onClick={() => setOpenId(null)}
                title="Cerrar"
                style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '20px 30px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* API key */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                  API Key de {expanded.name}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyDraft}
                    onChange={e => setApiKeyDraft(e.target.value)}
                    placeholder="sk-..."
                    className="input-base"
                    style={{ flex: 1, height: 40, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                    onKeyDown={e => { if (e.key === 'Enter') validate(); }}
                  />
                  <button onClick={() => setShowKey(s => !s)} title={showKey ? 'Ocultar' : 'Mostrar'} style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>{expanded.keyHint}</p>
              </div>

              {/* Base URL */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                  URL base (endpoint OpenAI-compatible)
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
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                  Modelo{expanded.id === 'custom' ? ' (escribe el identificador exacto de tu API)' : models.length ? ` · ${models.length}` : ''}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {expanded.id === 'custom' ? (
                    <input
                      type="text"
                      value={modelDraft}
                      onChange={e => setModelDraft(e.target.value)}
                      placeholder="mi-modelo (ej. gpt-4o, claude-3-5-sonnet)"
                      className="input-base"
                      style={{ flex: 1, height: 40, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                  ) : (
                    <div style={{ position: 'relative', flex: 1 }}>
                      <select
                        value={modelDraft}
                        onChange={e => setModelDraft(e.target.value)}
                        disabled={!validated}
                        className="input-base"
                        style={{ width: '100%', height: 40, fontSize: 12, appearance: 'none', paddingRight: 30, fontFamily: "'JetBrains Mono', monospace", opacity: validated ? 1 : 0.65, cursor: validated ? 'pointer' : 'not-allowed' }}
                      >
                        {!validated ? (
                          <option value="">Valida tu API para ver los modelos disponibles</option>
                        ) : (
                          <>
                            {!models.includes(modelDraft) && modelDraft && <option value={modelDraft}>{modelDraft}</option>}
                            {models.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </>
                        )}
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: 14, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    </div>
                  )}
                  <button
                    onClick={diagnose}
                    disabled={diagnosing || validating || (!validated && !apiKeyDraft.trim() && expanded.id !== 'opencode' && expanded.id !== 'custom')}
                    title={expanded.id === 'custom' ? 'Consulta los modelos que expone tu endpoint /models (opcional)' : 'Vuelve a consultar los modelos desde la API del proveedor (por si se actualizaron o retiraron)'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '0 12px', height: 40, borderRadius: 9, flexShrink: 0, whiteSpace: 'nowrap',
                      fontSize: 11, fontWeight: 600, cursor: (diagnosing || validating || (!validated && !apiKeyDraft.trim() && expanded.id !== 'opencode' && expanded.id !== 'custom')) ? 'not-allowed' : 'pointer',
                      background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
                      opacity: (diagnosing || validating || (!validated && !apiKeyDraft.trim() && expanded.id !== 'opencode' && expanded.id !== 'custom')) ? 0.55 : 1,
                      transition: 'all 150ms',
                    }}
                  >
                    {diagnosing ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                    Diagnosticar
                  </button>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>{expanded.id === 'custom' ? 'Este proveedor es 100% configurable: pega la URL base, la clave y el identificador del modelo de tu API.' : (modelsNote || (validated ? '' : 'Pulsa "Validar API" para detectar los modelos exactos de tu cuenta.'))}</p>
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

              {/* Nodo actual vs este proveedor */}
              {!isActive && (
                <div style={{
                  fontSize: 10.5, lineHeight: 1.55, color: 'var(--text-secondary)',
                  background: 'var(--bg-deep)', border: '1px dashed var(--border-default)',
                  borderRadius: 9, padding: '9px 12px',
                }}>
                  La app usa actualmente el nodo <b style={{ color: 'var(--text-primary)' }}>{activeProvider.name}</b>.
                  {validated
                    ? ' Este proveedor quedó validado: pulsa "Activar proveedor" para que Charvis pase a usar tu clave.'
                    : ' Valida tu API y luego actívalo para cambiar el nodo.'}
                </div>
              )}

              {/* Acciones: primero validar, después activar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                <button
                  onClick={validate}
                  disabled={validating}
                  title="Comprueba tu API, detecta los modelos y guarda la configuración (sin activarla todavía)"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 18px', borderRadius: 9,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
                    transition: 'all 150ms', opacity: validating ? 0.6 : 1,
                  }}
                >
                  {validating ? <Loader2 size={13} className="spin" /> : null}
                  {validating ? 'Validando…' : 'Validar API'}
                </button>
                <button
                  onClick={activate}
                  disabled={validating || !validated}
                  title={validated ? `Activar ${expanded.name} como proveedor de Charvis` : 'Primero valida tu API para poder activar este proveedor'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 18px', borderRadius: 9,
                    fontSize: 12, fontWeight: 600, cursor: validated ? 'pointer' : 'not-allowed',
                    background: validated ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--bg-deep)',
                    border: validated ? '1px solid color-mix(in srgb, var(--accent) 55%, transparent)' : '1px solid var(--border-soft)',
                    color: validated ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'all 150ms', opacity: validating ? 0.6 : 1,
                  }}
                >
                  Activar proveedor
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}