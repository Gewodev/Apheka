import { readFile } from '@tauri-apps/plugin-fs';

function toDataUrl(mime: string, data: Uint8Array): string {
  const binary = Array.from(data).map(b => String.fromCharCode(b)).join('');
  return `data:${mime};base64,${btoa(binary)}`;
}

function readSyncsafeInt(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 21) | (buf[offset + 1] << 14) | (buf[offset + 2] << 7) | buf[offset + 3];
}

function read32BE(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
}

function read24BE(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
}

export function parseCollaborators(artistRaw: string): { artist: string; collaborators: string[] } {
  const separators = /[,;&]|\bfeat\.\b|\bft\.\b|\bfeat\b|\bft\b|\bfeaturing\b|\bx\b/i;
  const parts = artistRaw.split(separators).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return { artist: artistRaw, collaborators: [] };
  return { artist: parts[0], collaborators: parts.slice(1) };
}

function parseId3v2Tags(buf: Uint8Array): { coverUrl?: string; title?: string; artist?: string; collaborators?: string[] } | null {
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x53) return null;
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
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
      frameSize = readSyncsafeInt(buf, offset + 4);
    } else if (major >= 3) {
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
      frameSize = read32BE(buf, offset + 4);
    } else {
      frameId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2]);
      frameSize = read24BE(buf, offset + 3);
    }
    if (frameSize === 0) break;
    const frameEnd = offset + frameHdrSize + frameSize;
    if (frameEnd > end) break;
    if (frameId === 'APIC' || frameId === 'PIC') {
      try {
        const body = buf.slice(offset + frameHdrSize, frameEnd);
        let pos = 0;
        if (pos >= body.length) { offset = frameEnd; continue; }
        const encoding = body[pos++];
        let mimeType: string;
        if (frameId === 'APIC') {
          const mimeEnd = body.indexOf(0, pos);
          if (mimeEnd === -1) { offset = frameEnd; continue; }
          mimeType = new TextDecoder('latin1').decode(body.slice(pos, mimeEnd));
          pos = mimeEnd + 1;
        } else {
          mimeType = body[pos] === 0x03 ? 'image/png' : 'image/jpeg';
          pos += 1;
        }
        if (pos >= body.length) { offset = frameEnd; continue; }
        pos += 1;
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
      } catch {
        // APIC parse failed — continue with other frames
      }
    }
    try {
      if (frameId === 'TIT2' || frameId === 'TT2') {
        const textStart = offset + frameHdrSize;
        if (textStart >= frameEnd) { offset = frameEnd; continue; }
        const enc = buf[textStart];
        const raw = textStart + 1 < frameEnd ? buf.slice(textStart + 1, frameEnd) : new Uint8Array(0);
        let str: string;
        if (enc === 0x01) {
          str = new TextDecoder('utf-16le').decode(raw);
        } else if (enc === 0x02) {
          str = new TextDecoder('utf-16be').decode(raw);
        } else if (enc === 0x03) {
          str = new TextDecoder('utf-8').decode(raw);
        } else {
          str = new TextDecoder('latin1').decode(raw);
        }
        title = str.replace(/\0/g, '').trim();
      }
    } catch { /* TIT2 failed */ }
    try {
      if (frameId === 'TPE1' || frameId === 'TP1') {
        const textStart = offset + frameHdrSize;
        if (textStart >= frameEnd) { offset = frameEnd; continue; }
        const enc = buf[textStart];
        const raw = textStart + 1 < frameEnd ? buf.slice(textStart + 1, frameEnd) : new Uint8Array(0);
        let str: string;
        if (enc === 0x01) {
          str = new TextDecoder('utf-16le').decode(raw);
        } else if (enc === 0x02) {
          str = new TextDecoder('utf-16be').decode(raw);
        } else if (enc === 0x03) {
          str = new TextDecoder('utf-8').decode(raw);
        } else {
          str = new TextDecoder('latin1').decode(raw);
        }
        artist = str.replace(/\0/g, '').trim();
      }
    } catch { /* TPE1 failed */ }
    offset = frameEnd;
  }
  const parsed = artist ? parseCollaborators(artist) : undefined;
  return { coverUrl, title, artist: parsed?.artist || artist, collaborators: parsed?.collaborators };
}

function parseMp4Metadata(buf: Uint8Array): { coverUrl?: string; title?: string; artist?: string; duration: number } {
  let coverUrl: string | undefined;
  let title: string | undefined;
  let artist: string | undefined;

  function readBox(d: Uint8Array, start: number): { type: string; data: Uint8Array; next: number } | null {
    if (start + 8 > d.length) return null;
    const size = read32BE(d, start);
    if (size < 8) return null;
    const type = String.fromCharCode(d[start + 4], d[start + 5], d[start + 6], d[start + 7]);
    const data = d.slice(start + 8, Math.min(start + size, d.length));
    return { type, data, next: start + size };
  }

  function findBox(d: Uint8Array, target: string, start = 0): Uint8Array | null {
    let pos = start;
    while (pos < d.length) {
      const box = readBox(d, pos);
      if (!box) break;
      if (box.type === target) return box.data;
      pos = box.next;
    }
    return null;
  }

  function walkBox(d: Uint8Array, ...types: string[]): Uint8Array | null {
    let remaining = d;
    for (const t of types) {
      const found = findBox(remaining, t);
      if (!found) return null;
      remaining = found;
    }
    return remaining;
  }

  const moov = findBox(buf, 'moov');
  if (moov) {
    const udta = findBox(moov, 'udta');
    if (udta) {
      const meta = findBox(udta, 'meta');
      if (meta) {
        // meta is a "full box" — 8-byte header + 4-byte version/flags before children
        const metaBody = meta.slice(4);
        const ilst = findBox(metaBody, 'ilst');
        if (ilst) {
          let pos = 0;
          while (pos < ilst.length) {
            const box = readBox(ilst, pos);
            if (!box) break;
            if (box.type === 'covr') {
              const dataBox = findBox(box.data, 'data');
              if (dataBox && dataBox.length > 16) {
                const typeCode = read32BE(dataBox, 4);
                const imageData = dataBox.slice(8);
                if (imageData.length > 100) {
                  const mime = typeCode === 13 ? 'image/png' : 'image/jpeg';
                  coverUrl = toDataUrl(mime, imageData);
                }
              }
            }
            if (box.type === '\u00a9nam') {
              const dataBox = findBox(box.data, 'data');
              if (dataBox && dataBox.length > 8) {
                const raw = dataBox.slice(8);
                const enc = raw[0];
                if (enc === 0x01 || enc === 0x02) {
                  title = new TextDecoder('utf-16le').decode(raw.slice(1)).replace(/\0/g, '').trim();
                } else {
                  title = new TextDecoder('utf-8').decode(raw).replace(/\0/g, '').trim();
                }
              }
            }
            if (box.type === '\u00a9ART') {
              const dataBox = findBox(box.data, 'data');
              if (dataBox && dataBox.length > 8) {
                const raw = dataBox.slice(8);
                const enc = raw[0];
                if (enc === 0x01 || enc === 0x02) {
                  artist = new TextDecoder('utf-16le').decode(raw.slice(1)).replace(/\0/g, '').trim();
                } else {
                  artist = new TextDecoder('utf-8').decode(raw).replace(/\0/g, '').trim();
                }
              }
            }
            pos = box.next;
          }
        }
      }
    }
  }
  return { coverUrl, title, artist };
}

function parseFlacMetadata(buf: Uint8Array): { coverUrl?: string; title?: string; artist?: string } {
  if (buf[0] !== 0x66 || buf[1] !== 0x4C || buf[2] !== 0x61 || buf[3] !== 0x43) return {};
  let coverUrl: string | undefined;
  let title: string | undefined;
  let artist: string | undefined;
  let pos = 4;
  let lastBlock = false;
  while (!lastBlock && pos + 4 <= buf.length) {
    const hdr = buf[pos];
    lastBlock = (hdr & 0x80) !== 0;
    const blockType = hdr & 0x7F;
    const blockSize = read24BE(buf, pos + 1);
    pos += 4;
    if (pos + blockSize > buf.length) break;
    if (blockType === 6 && blockSize > 20) {
      const picType = read32BE(buf, pos);
      if (picType === 3) {
        const mimeLen = read32BE(buf, pos + 4);
        const mimeType = String.fromCharCode(...buf.slice(pos + 8, pos + 8 + mimeLen));
        const descLen = read32BE(buf, pos + 8 + mimeLen);
        const picDataOffset = pos + 12 + mimeLen + descLen;
        const picDataLen = read32BE(buf, picDataOffset - 4);
        if (picDataLen > 100 && picDataOffset + picDataLen <= buf.length) {
          const pictureData = buf.slice(picDataOffset, picDataOffset + picDataLen);
          coverUrl = toDataUrl(mimeType, pictureData);
        }
      }
    }
    if (blockType === 4) {
      const vendorLen = read32BE(buf, pos);
      let tagPos = pos + 4 + vendorLen;
      while (tagPos + 4 < pos + blockSize) {
        const tagLen = read32BE(buf, tagPos);
        tagPos += 4;
        if (tagPos + tagLen > pos + blockSize) break;
        const tagStr = new TextDecoder('utf-8').decode(buf.slice(tagPos, tagPos + tagLen));
        const eq = tagStr.indexOf('=');
        if (eq > 0) {
          const key = tagStr.slice(0, eq).toUpperCase();
          const val = tagStr.slice(eq + 1);
          if (key === 'TITLE') title = val;
          if (key === 'ARTIST') artist = val;
        }
        tagPos += tagLen;
      }
    }
    pos += blockSize;
  }
  return { coverUrl, title, artist };
}

function compressCover(dataUrl: string, maxSize = 300): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w <= maxSize && h <= maxSize) {
          resolve(dataUrl);
          return;
        }
        if (w > h) { h = h * (maxSize / w); w = maxSize; }
        else { w = w * (maxSize / h); h = maxSize; }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

function parseId3v1Tags(buf: Uint8Array): { title?: string; artist?: string } | null {
  if (buf.length < 128) return null;
  const tagStart = buf.length - 128;
  if (buf[tagStart] !== 0x54 || buf[tagStart + 1] !== 0x41 || buf[tagStart + 2] !== 0x47) return null;
  const decode = (start: number, len: number) => {
    const slice = buf.slice(tagStart + start, tagStart + start + len);
    const end = slice.indexOf(0);
    const text = new TextDecoder('latin1').decode(end >= 0 ? slice.slice(0, end) : slice).trim();
    return text || undefined;
  };
  return { title: decode(3, 30), artist: decode(33, 30) };
}

export async function extractAudioMetadata(filePath: string): Promise<{
  coverUrl?: string;
  title?: string;
  artist?: string;
  collaborators?: string[];
  duration: number;
}> {
  try {
    const ext = filePath.toLowerCase().split('.').pop() || '';
    const data = await readFile(filePath);

    let coverUrl: string | undefined;
    let title: string | undefined;
    let artist: string | undefined;
    let collaborators: string[] | undefined;

    if (ext === 'mp3') {
      const tags = parseId3v2Tags(data);
      coverUrl = tags?.coverUrl;
      title = tags?.title || title;
      artist = tags?.artist || artist;
      collaborators = tags?.collaborators || collaborators;
      // Fallback: try ID3v1 (at end of file) if ID3v2 didn't find title/artist
      if (!title || !artist) {
        const v1 = parseId3v1Tags(data);
        if (v1) {
          if (!title) title = v1.title;
          if (!artist) artist = v1.artist;
        }
      }
    } else if (ext === 'm4a' || ext === 'aac' || ext === 'mp4') {
      const tags = parseMp4Metadata(data);
      coverUrl ||= tags.coverUrl;
      title ||= tags.title;
      artist ||= tags.artist;
    } else if (ext === 'flac') {
      const tags = parseFlacMetadata(data);
      coverUrl ||= tags.coverUrl;
      title ||= tags.title;
      artist ||= tags.artist;
    } else if (ext === 'ogg' || ext === 'opus') {
      const tags = parseFlacMetadata(data);
      coverUrl ||= tags.coverUrl;
      title ||= tags.title;
      artist ||= tags.artist;
    }

    if (coverUrl) {
      try {
        coverUrl = await compressCover(coverUrl);
      } catch {
        // keep original coverUrl if compression fails
      }
    }

  // If structured parsing didn't find cover, scan raw buffer for embedded image headers
  if (!coverUrl) {
    const scanEnd = Math.min(data.length, 1_048_576);
    for (let i = 0; i <= scanEnd - 4; i++) {
      if (data[i] === 0xFF && data[i + 1] === 0xD8 && data[i + 2] === 0xFF) {
        // JPEG header found — find EOI marker
        for (let j = i + 2; j < data.length - 1; j++) {
          if (data[j] === 0xFF && data[j + 1] === 0xD9) {
            const img = data.slice(i, j + 2);
            if (img.length > 5000) {
              coverUrl = toDataUrl('image/jpeg', img);
            }
            break;
          }
        }
        if (coverUrl) break;
      }
      if (data[i] === 0x89 && data[i + 1] === 0x50 && data[i + 2] === 0x4E && data[i + 3] === 0x47) {
        // PNG header found — find IEND
        for (let j = i + 4; j < data.length - 3; j++) {
          if (data[j] === 0x49 && data[j + 1] === 0x45 && data[j + 2] === 0x4E && data[j + 3] === 0x44) {
            const img = data.slice(i, j + 4);
            if (img.length > 5000) {
              coverUrl = toDataUrl('image/png', img);
            }
            break;
          }
        }
        if (coverUrl) break;
      }
    }
  }

  const parsed = artist ? parseCollaborators(artist) : undefined;
    return {
      coverUrl,
      title,
      artist: parsed?.artist || artist,
      collaborators: parsed?.collaborators || collaborators,
      duration: 0,
    };
  } catch {
    return { duration: 0 };
  }
}
