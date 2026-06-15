import { isTauri } from './tauri';
import { createHash } from 'crypto';

const LOG_PATH = 'audit.log'; // will be resolved relative to app's data folder when in Tauri

// Simple write helper – in a real app you would use Tauri's fs API with proper rotation
export async function audit(action: string, userId: string, details: Record<string, any>, success: boolean) {
  const entry = {
    ts: new Date().toISOString(),
    user: userId,
    action,
    details: Object.fromEntries(
      Object.entries(details).map(([k, v]) => {
        if (typeof v === 'string') {
          const hash = createHash('sha256').update(v).digest('hex').slice(0, 12);
          return [k, hash];
        }
        return [k, v];
      })
    ),
    success,
  };
  const line = JSON.stringify(entry) + '\n';
  if (isTauri()) {
    try {
      const { readTextFile, writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      let existing = '';
      try { existing = await readTextFile(LOG_PATH, { baseDir: BaseDirectory.AppData }); } catch {}
      await writeTextFile(LOG_PATH, existing + line, { baseDir: BaseDirectory.AppData });
    } catch (e) {
      console.error('Audit write failed:', e);
    }
  } else {
    // Browser fallback – just console.log (won't persist)
    console.log('AUDIT:', line.trim());
  }
}