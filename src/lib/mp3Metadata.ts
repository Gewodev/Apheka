import { readFile } from '@tauri-apps/plugin-fs';

function toDataUrl(mime: string, data: Uint8Array): string {
  const binary = Array.from(data).map(b => String.fromCharCode(b)).join('');
  return `data:${mime};base64,${btoa(binary)}`;
}

function readSyncsafeInt(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 21) | (buf[offset + 1] << 14) | (buf[offset + 2] << 7) | buf[offset + 3];
}

export function parseCollaborators(artistRaw: string): { artist: string; collaborators: string[] } {
  const separators = /[,;&]|\bfeat\.\b|\bft\.\b|\bfeat\b|\bft\b|\bfeaturing\b|\bx\b/i;
  const parts = artistRaw.split(separators).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return { artist: artistRaw, collaborators: [] };
  return { artist: parts[0], collaborators: parts.slice(1) };
}

function parseId3v2Tags(buf: Uint8Array): { coverUrl?: string; title?: string; artist?: string; collaborators?: string[] } | null {
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x53) return null; // "ID3"
  
  const major = buf[3];
  const size = readSyncsafeInt(buf, 6);
  const tagHdrSize = 10;
  const end = Math.min(tagHdrSize + size, buf.length);
  
  let coverUrl: string | undefined;
  let title: string | undefined;
  let artist: string | undefined;
  let offset = tagHdrSize;

  while (offset + 1 <= end) {
    const frameHdrSize = major >= 3 ? 10 : 6;
    if (offset + frameHdrSize > end) break;

    let frameId: string;
    let frameSize: number;

    if (major >= 4) {
      // v2.4: frame sizes are syncsafe integers (4 bytes)
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
      frameSize = readSyncsafeInt(buf, offset + 4);
    } else if (major >= 3) {
      // v2.3: 4-byte IDs, plain big-endian 4-byte sizes
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
      frameSize = (buf[offset + 4] << 24) | (buf[offset + 5] << 16) | (buf[offset + 6] << 8) | buf[offset + 7];
    } else {
      // v2.2: 3-byte IDs, plain big-endian 3-byte sizes
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2]);
      frameSize = (buf[offset + 3] << 16) | (buf[offset + 4] << 8) | buf[offset + 5];
    }

    if (frameSize === 0) break;
    const frameEnd = offset + frameHdrSize + frameSize;
    if (frameEnd > end) break;

    if (frameId === 'APIC' || frameId === 'PIC') {
      const body = buf.slice(offset + frameHdrSize, frameEnd);
      let pos = 0;
      if (pos >= body.length) { offset = frameEnd; continue; }
      const encoding = body[pos++];
      
      let mimeType: string;
      if (frameId === 'APIC') {
        const mimeEnd = body.indexOf(0, pos);
        if (mimeEnd === -1) { offset = frameEnd; continue; }
        mimeType = String.fromCharCode(...body.slice(pos, mimeEnd));
        pos = mimeEnd + 1;
      } else {
        mimeType = body[pos] === 0x03 ? 'image/png' : 'image/jpeg';
        pos += 1;
      }
      
      if (pos >= body.length) { offset = frameEnd; continue; }
      pos += 1; // picture type byte
      
      // skip description (null-terminated)
      if (encoding === 0x01 || encoding === 0x02) {
        while (pos + 1 < body.length && !(body[pos] === 0 && body[pos + 1] === 0)) pos++;
        pos += 2;
      } else {
        while (pos < body.length && body[pos] !== 0) pos++;
        pos += 1;
      }
      
      if (pos < body.length) {
        const pictureData = body.slice(pos);
        if (pictureData.length > 100) {
          coverUrl = toDataUrl(mimeType, pictureData);
        }
      }
    }

    if (frameId === 'TIT2' || frameId === 'TT2') {
      const textStart = offset + frameHdrSize + 1;
      if (textStart >= frameEnd) { offset = frameEnd; continue; }
      const raw = buf.slice(textStart, frameEnd);
      const enc = raw[0];
      let str: string;
      if (enc === 0x01 || enc === 0x02) {
        str = new TextDecoder('utf-16le').decode(raw.slice(1));
      } else {
        str = new TextDecoder('latin1').decode(raw.slice(1));
      }
      title = str.replace(/\0/g, '').trim();
    }

    if (frameId === 'TPE1' || frameId === 'TP1') {
      const textStart = offset + frameHdrSize + 1;
      if (textStart >= frameEnd) { offset = frameEnd; continue; }
      const raw = buf.slice(textStart, frameEnd);
      const enc = raw[0];
      let str: string;
      if (enc === 0x01 || enc === 0x02) {
        str = new TextDecoder('utf-16le').decode(raw.slice(1));
      } else {
        str = new TextDecoder('latin1').decode(raw.slice(1));
      }
      artist = str.replace(/\0/g, '').trim();
    }

    offset = frameEnd;
  }

  const parsed = artist ? parseCollaborators(artist) : undefined;
  return {
    coverUrl,
    title,
    artist: parsed?.artist || artist,
    collaborators: parsed?.collaborators,
  };
}

export async function extractMp3Metadata(filePath: string): Promise<{
  coverUrl?: string;
  title?: string;
  artist?: string;
  collaborators?: string[];
  duration: number;
}> {
  try {
    const data = await readFile(filePath);
    const tags = parseId3v2Tags(data);
    return {
      coverUrl: tags?.coverUrl,
      title: tags?.title,
      artist: tags?.artist,
      collaborators: tags?.collaborators,
      duration: 0,
    };
  } catch {
    return { duration: 0 };
  }
}
