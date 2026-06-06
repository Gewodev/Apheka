const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

function getCryptoKey(): CryptoKey | null {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  return null;
}

export async function generateKey(): Promise<ArrayBuffer> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  return await crypto.subtle.exportKey('raw', key);
}

export async function encrypt(data: string, key: ArrayBuffer): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: ALGORITHM },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    encoded
  );

  const combined = new Uint8Array(IV_LENGTH + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), IV_LENGTH);

  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedData: string, key: ArrayBuffer): Promise<string> {
  const combined = new Uint8Array(
    atob(encryptedData)
      .split('')
      .map(char => char.charCodeAt(0))
  );

  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: ALGORITHM },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}