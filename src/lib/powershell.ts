import { spawn } from 'child_process';
import { isTauri } from './tauri';
import { audit } from './auditLog';

// Very strict path validation – allows only alphanum, dot, dash, underscore, slash/backslash
const SAFE_PATH_RE = /^[a-zA-Z0-9._\\/-]+$/;

export function assertSafePath(p: string) {
  if (!SAFE_PATH_RE.test(p)) {
    throw new Error(`Unsafe path supplied: ${p}`);
  }
}

/** Execute a PowerShell script safely. Returns stdout string. */
export async function runPowerShell(script: string, args: string[], userId: string): Promise<string> {
  // Validate each argument
  args.forEach(assertSafePath);

  const psArgs = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-Command', script,
    ...args,
  ];

  return new Promise<string>((resolve, reject) => {
    const proc = spawn('powershell.exe', psArgs, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => (stdout += d));
    proc.stderr.on('data', d => (stderr += d));
    proc.on('close', code => {
      const success = code === 0;
      audit('run:powershell', userId, { script, args }, success);
      if (success) resolve(stdout);
      else reject(new Error(`PowerShell error ${code}: ${stderr}`));
    });
  });
}
