// ═══════════════════════════════════════════════════
//  CHARVIS — Panel de proveedores de IA (Ajustes → Sistema)
// ═══════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, Eye, EyeOff, ExternalLink, KeyRound, Globe, Cpu, ShieldCheck, Zap, ChevronDown } from 'lucide-react';
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

function hostOf(url: string): string {
  try { return url.replace(/^https?:\/\//, '').split('/')[0]; } catch { return url; }
}

export default function CharvisProviders() {
  const { settings, updateSettings, addNotification } = useApp();
  const activeId = settings.owaBrainProvider || DEFAULT_PROVIDER_ID;

  const [states, setStates] = useState<Record<string, CharvisProviderState>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const [expandedId, setExpandedId] = useState<string>(activeId);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelsNote, setModelsNote] = useState('');

  const expanded: CharvisProvider = CHARVIS_PROVIDERS.find(p => p.id === expandedId) || CHARVIS_PROVIDERS[0];

  const persist = (next: Record<string, CharvisProviderState>) => {
    setStates(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  // Al montar o cambiar de proveedor, se cargan los borradores desde el estado guardado.
  useEffect(() => {
    const p = CHARVIS_PROVIDERS.find(pp => pp.id === expandedId) || CHARVIS_PROVIDERS[0];
    const s = providerState(states, p);
    setApiKeyDraft(s.apiKey);
    setUrlDraft(s.baseUrl || p.baseUrl);
    setModelDraft(s.model || s.models[0] || p.defaultModel);
    setModels(s.models.length ? s.models : p.defaultModels);
    setModelsNote(s.validatedAt ? 'Modelos detectados con tu API' : 'Modelos de referencia del proveedor');
    setResult(null);
    setShowKey(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  const st = providerState(states, expanded);
  const isActive = activeId === expanded.id;

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
          note = detected.length ? `${detected.length} modelos detectados con la API` : 'El endpoint /models devolvió vacío — lista de referencia';
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
        setResult({ ok: true, msg: `Conectado · HTTP ${probe.status} · ${probe.latencyMs} ms` });
        updateSettings({ owaBrainProvider: p.id, owaBrainApiKey: apiKey, owaBrainBaseUrl: baseUrl, owaBrainModel: finalModel } as any);
        addNotification(`${p.name} configurado y activado`, 'success');
      } else {
        setResult({ ok: false, msg: `HTTP ${probe.status} · ${probe.message}` });
      }
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setValidating(false);
    }
  };

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
          <Zap size={12} /> Proveedor de IA
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cada proveedor guarda su propia clave en tu dispositivo</span>
      </div>

      {/* Grid de proveedores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(152px, 1fr))', gap: 10 }}>
        {CHARVIS_PROVIDERS.map(p => {
          const ps = providerState(states, p);
          const active = activeId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setExpandedId(p.id)}
              title={`${p.name} — ${p.baseUrl}`}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                padding: '12px 12px 11px',
                borderRadius: 12,
                cursor: 'pointer', textAlign: 'left',
                background: 'linear-gradient(160deg, var(--bg-elevated-alpha, rgba(255,255,255,0.03)) 0%, rgba(255,255,255,0.015) 82%)',
                border: active ? `1px solid ${p.brandColor}88` : '1px solid var(--border-subtle)',
                boxShadow: active ? `0 0 0 2px ${p.brandColor}1f, 0 8px 22px ${p.brandColor}14` : 'none',
                transition: 'all 160ms',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              {active && (
                <span style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: p.brandColor, boxShadow: `0 0 8px ${p.brandColor}` }} />
              )}
              <BrandLogo id={p.id} size={38} radius={11} />
              <div style={{ minWidth: 0, width: '100%' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{hostOf(ps.baseUrl || p.baseUrl)}</div>
              </div>
              {ps.validatedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#10B981' }}>
                  <ShieldCheck size={10} /> Verificado
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel de detalle del proveedor expandido */}
      <div style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', border: `1px solid ${expanded.brandColor}44`, background: 'linear-gradient(180deg, var(--bg-deep) 0%, rgba(255,255,255,0.015) 100%)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <BrandLogo id={expanded.id} size={46} radius={13} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>{expanded.name}</span>
              {isActive && <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: expanded.brandColor, background: `${expanded.brandColor}1c`, border: `1px solid ${expanded.brandColor}55`, borderRadius: 6, padding: '2px 6px' }}>Activo</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expanded.baseUrl}</div>
          </div>
          <a href={expanded.docsUrl} target="_blank" rel="noreferrer" title="Documentación oficial"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-secondary)', textDecoration: 'none', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-elevated, transparent)', whiteSpace: 'nowrap' }}>
            <ExternalLink size={11} /> Docs
          </a>
        </div>

        <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                style={{ flex: 1, height: 38, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                onKeyDown={e => { if (e.key === 'Enter') validate(); }}
              />
              <button onClick={() => setShowKey(s => !s)} title={showKey ? 'Ocultar' : 'Mostrar'} style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>{expanded.keyHint}</p>
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
              style={{ width: '100%', height: 38, fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace" }}
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
                style={{ width: '100%', height: 38, fontSize: 12, appearance: 'none', paddingRight: 30, fontFamily: "'JetBrains Mono', monospace" }}
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
              <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: 13, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>{modelsNote || 'Pulsa "Guardar y validar" para detectar los modelos exactos de tu cuenta.'}</p>
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

          {/* Acciones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={validate}
              disabled={validating}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: `${expanded.brandColor}1a`, border: `1px solid ${expanded.brandColor}66`, color: expanded.brandColor,
                transition: 'all 150ms', opacity: validating ? 0.6 : 1,
              }}
            >
              {validating ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />}
              {validating ? 'Validando…' : 'Guardar y validar'}
            </button>
            <button
              onClick={activate}
              disabled={validating}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
                transition: 'all 150ms',
              }}
            >
              <Zap size={13} /> Activar proveedor
            </button>
            {st.validatedAt && (
              <span style={{ fontSize: 10, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={11} /> Verificado
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
