import re

# Read the current file
with open(r'C:\Users\USER\tauri-app\src\components\CourseHub.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the start of the problematic section - the Notas conditional
notas_start = None
for i, line in enumerate(lines):
    if '/* NOTAS CONTENT */' in line:
        notas_start = i
        break

# Find the end - after the History section and before Event Modal
history_end = None
for i, line in enumerate(lines):
    if '/* Event Modal */' in line:
        history_end = i
        break

print(f"Found Notas section: {notas_start+1} to {history_end}")

# The new clean Notas section with proper structure
clean_notas = '''            {/* NOTAS CONTENT */}
            {repasoTab === 'notas' && (
              <>
                {!recordarNote && !recordarShowResult && !recordarActive && (
                  <>
                    {recordarNotes.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px', opacity: 0.5 }}>
                        <p style={{ fontSize: '11px', margin: '0 0 8px' }}>No hay notas para repasar</p>
                        <button onClick={() => crearNota({ titulo: 'Nueva Nota', cursoId: courseId })} style={{ padding: '8px 16px', borderRadius: '10px', background: course.color, border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, color: 'white' }}>+ Crear Nota</button>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Timer size={12} style={{ opacity: 0.5 }} />
                          <span style={{ fontSize: '10px', color: 'var(--on-surface-muted)' }}>Tiempo:</span>
                          <select value={recordarSeconds} onChange={e => setRecordarSeconds(parseInt(e.target.value))} style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', fontSize: '10px', color: 'var(--on-surface)', cursor: 'pointer' }}>
                            <option value={15}>15 seg</option>
                            <option value={30}>30 seg</option>
                            <option value={45}>45 seg</option>
                            <option value={60}>60 seg</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                          {recordarNotes.map(note => {
                            const status = getDominoStatus(note.domino);
                            return (
                              <button key={note.id} onClick={() => startRecordar(note)} style={{ padding: '10px', borderRadius: '10px', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={14} style={{ color: course.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.titulo}</p>
                                </div>
                                <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: `${status.color}20`, color: status.color }}>{status.label}</span>
                                <Play size={12} style={{ color: course.color }} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Active session */}
                {recordarActive && recordarNote && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>{recordarNote.titulo}</span>
                      <span style={{ fontSize: '14px', fontWeight: 950, color: course.color, fontFamily: 'monospace' }}>{Math.floor((recordarSeconds - recordarElapsed) / 60)}:{String((recordarSeconds - recordarElapsed) % 60).padStart(2, '0')}</span>
                    </div>
                    <textarea value={recordarUserText} onChange={e => setRecordarUserText(e.target.value)} placeholder="Escribe todo lo que recuerdas..." style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', fontSize: '13px', color: 'var(--on-surface)', resize: 'none', outline: 'none', minHeight: '80px' }} />
                    <button onClick={() => { setRecordarActive(false); setRecordarShowResult(true); }} style={{ padding: '10px', borderRadius: '10px', background: course.color, border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 800, color: 'white' }}>Finalizar</button>
                  </div>
                )}

                {/* Result comparison */}
                {recordarShowResult && recordarNote && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>Comparación</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: '#10b98120', color: '#10b981', fontWeight: 800 }}>{(() => { const n = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^\\w\\s]/g, ' ').split(/\\s+/).filter(w => w.length > 2); const u = new Set(n(recordarUserText)); const o = new Set(n(recordarNote.contenido || '')); return [...u].filter(w => o.has(w)).length; })()} coincidencias</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 1 }}>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', overflowY: 'auto', maxHeight: '150px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 800, color: 'var(--on-surface-muted)', marginBottom: '6px' }}>TU RESPUESTA</p>
                        <p style={{ fontSize: '11px', lineHeight: 1.5, margin: 0 }}>{recordarUserText || 'Sin respuesta'}</p>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--surface-container-low)', border: '1px solid var(--outline-variant)', overflowY: 'auto', maxHeight: '150px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 800, color: 'var(--on-surface-muted)', marginBottom: '6px' }}>NOTA ORIGINAL</p>
                        <p style={{ fontSize: '11px', lineHeight: 1.5, margin: 0 }}>{recordarNote.contenido || 'Sin contenido'}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { setRecordarShowResult(false); setRecordarNote(null); setRecordarUserText(''); }} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: 'var(--surface-container)', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700 }}>Cerrar</button>
                      <button onClick={saveToHistory} style={{ flex: 1, padding: '8px', borderRadius: '10px', background: course.color, border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><Check size={12} /> Guardar</button>
                    </div>
                  </div>
                )}

                {/* History */}
                {recordarHistory.length > 0 && !recordarNote && !recordarShowResult && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px' }}>
                    <p style={{ fontSize: '9px', fontWeight: 800, color: 'var(--on-surface-muted)', marginBottom: '6px' }}>HISTORIAL ({recordarHistory.length})</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }} className="custom-scrollbar">
                      {recordarHistory.slice(0, 3).map(entry => (
                        <div key={entry.id} style={{ padding: '8px', borderRadius: '8px', background: 'var(--surface-container-low)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{entry.noteTitle}</span>
                          <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 800 }}>{entry.matchCount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
'''

# Build the new file
new_lines = lines[:notas_start] + [clean_notas + '\n'] + lines[history_end:]

with open(r'C:\Users\USER\tauri-app\src\components\CourseHub.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("File updated successfully")
