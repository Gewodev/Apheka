import { readFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as mm from 'music-metadata-browser';

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

function decodeId3Text(enc: number, raw: Uint8Array): string {
  // Strip trailing nulls (simple loop)
  let end = raw.length;
  while (end > 0 && raw[end - 1] === 0) end--;
  const data = end > 0 ? raw.subarray(0, end) : raw;
  if (data.length === 0) return '';

  if (enc === 0x01) {
    if (data.length >= 2) {
      if (data[0] === 0xFF && data[1] === 0xFE) return new TextDecoder('utf-16le').decode(data.subarray(2));
      if (data[0] === 0xFE && data[1] === 0xFF) return new TextDecoder('utf-16be').decode(data.subarray(2));
    }
    return new TextDecoder('utf-16le').decode(data);
  }
  if (enc === 0x02) return new TextDecoder('utf-16be').decode(data);
  if (enc === 0x03) return new TextDecoder('utf-8').decode(data);
  // enc === 0x00 (ISO-8859-1 / Latin-1):
  // Many encoders write UTF-8 but forget to set encoding byte to $03.
  // Try UTF-8 first — if result has no U+FFFD, it was valid UTF-8.
  const utf8 = new TextDecoder('utf-8').decode(data);
  if (!utf8.includes('\uFFFD')) return utf8;
  return new TextDecoder('latin1').decode(data);
}

function parseId3v2Tags(buf: Uint8Array): { coverUrl?: string; title?: string; artist?: string } | null {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return null;
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
        // APIC parse failed — continue
      }
    }
    try {
      if (frameId === 'TIT2' || frameId === 'TT2') {
        const textStart = offset + frameHdrSize;
        if (textStart >= frameEnd) { offset = frameEnd; continue; }
        const enc = buf[textStart];
        const raw = textStart + 1 < frameEnd ? buf.slice(textStart + 1, frameEnd) : new Uint8Array(0);
        title = decodeId3Text(enc, raw).replace(/\0/g, '').trim();
      }
    } catch { /* TIT2 failed */ }
    try {
      if (frameId === 'TPE1' || frameId === 'TP1') {
        const textStart = offset + frameHdrSize;
        if (textStart >= frameEnd) { offset = frameEnd; continue; }
        const enc = buf[textStart];
        const raw = textStart + 1 < frameEnd ? buf.slice(textStart + 1, frameEnd) : new Uint8Array(0);
        artist = decodeId3Text(enc, raw).replace(/\0/g, '').trim();
      }
    } catch { /* TPE1 failed */ }
    offset = frameEnd;
  }
  return { coverUrl, title, artist };
}

// ID3v1: 128 bytes at end of file
function decodeId3v1Text(raw: Uint8Array): string {
  // Truncate at first null (ID3v1 fields are null-terminated, remaining bytes are garbage)
  let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === 0) { end = i; break; }
  }
  const data = raw.subarray(0, end);
  const latin1 = new TextDecoder('latin1').decode(data).trim();
  if (!latin1) return latin1;
  // Check for high bytes: some encoders write UTF-8 into ID3v1 fields
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= 0x80) {
      const utf8 = new TextDecoder('utf-8').decode(data).trim();
      if (utf8 && !utf8.includes('\uFFFD')) return utf8;
      break;
    }
  }
  return latin1;
}

function parseId3v1Tags(buf: Uint8Array): { title?: string; artist?: string } | null {
  if (buf.length < 128) return null;
  const tagStart = buf.length - 128;
  if (buf[tagStart] !== 0x54 || buf[tagStart + 1] !== 0x41 || buf[tagStart + 2] !== 0x47) return null;
  const title = decodeId3v1Text(buf.slice(tagStart + 3, tagStart + 33));
  const artist = decodeId3v1Text(buf.slice(tagStart + 33, tagStart + 63));
  return {
    title: title || undefined,
    artist: artist || undefined,
  };
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

  const moov = findBox(buf, 'moov');
  let duration = 0;
  if (moov) {
    const mvhd = findBox(moov, 'mvhd');
    if (mvhd) {
      const version = mvhd[0];
      const timescale = read32BE(mvhd, version === 0 ? 12 : 20);
      if (timescale > 0) {
        const dur = version === 0 ? read32BE(mvhd, 16) : read32BE(mvhd, 24);
        duration = dur / timescale;
      }
    }
    const udta = findBox(moov, 'udta');
    if (udta) {
      const meta = findBox(udta, 'meta');
      if (meta) {
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
                title = decodeId3Text(enc, raw.slice(1)).replace(/\0/g, '').trim();
              }
            }
            if (box.type === '\u00a9ART') {
              const dataBox = findBox(box.data, 'data');
              if (dataBox && dataBox.length > 8) {
                const raw = dataBox.slice(8);
                const enc = raw[0];
                artist = decodeId3Text(enc, raw.slice(1)).replace(/\0/g, '').trim();
              }
            }
            pos = box.next;
          }
        }
      }
    }
  }
  return { coverUrl, title, artist, duration };
}

function parseFlacMetadata(buf: Uint8Array): { coverUrl?: string; title?: string; artist?: string; duration: number } {
  if (buf[0] !== 0x66 || buf[1] !== 0x4C || buf[2] !== 0x61 || buf[3] !== 0x43) return { duration: 0 };
  let coverUrl: string | undefined;
  let title: string | undefined;
  let artist: string | undefined;
  let duration = 0;
  let pos = 4;
  let lastBlock = false;
  while (!lastBlock && pos + 4 <= buf.length) {
    const hdr = buf[pos];
    lastBlock = (hdr & 0x80) !== 0;
    const blockType = hdr & 0x7F;
    const blockSize = read24BE(buf, pos + 1);
    pos += 4;
    if (pos + blockSize > buf.length) break;
    if (blockType === 0 && blockSize >= 18) {
      const sampleRate = (buf[pos + 10] << 12) | (buf[pos + 11] << 4) | (buf[pos + 12] >> 4);
      const totalSamples = ((buf[pos + 12] & 0x0F) << 32) | (buf[pos + 13] << 24) | (buf[pos + 14] << 16) | (buf[pos + 15] << 8) | buf[pos + 16];
      if (sampleRate > 0) duration = totalSamples / sampleRate;
    }
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
  return { coverUrl, title, artist, duration };
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

export async function extractAudioMetadata(filePath: string): Promise<{
  coverUrl?: string;
  title?: string;
  artist?: string;
  duration: number;
}> {
  const fileName = filePath.split(/[/\\]/).pop() || 'Unknown';
  try {
    let data = await readFile(filePath);
    if (!data || data.length < 10) {
      console.warn('[Metadata] File too small or empty:', fileName, data?.length);
      return { duration: 0 };
    }
    // Ensure data is Uint8Array (some Tauri versions return number[])
    if (!(data instanceof Uint8Array)) {
      data = new Uint8Array(data as any);
    }
    const ext = filePath.toLowerCase().split('.').pop() || '';

    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      mp4: 'audio/mp4',
      flac: 'audio/flac',
      ogg: 'audio/ogg',
      opus: 'audio/opus',
      wav: 'audio/wav',
      wma: 'audio/x-ms-wma',
      aiff: 'audio/aiff',
      ape: 'audio/ape',
    };

    const mimeType = mimeMap[ext] || 'audio/mpeg';

    // Try music-metadata-browser first (AETHER approach)
    let metadata: mm.IAudioMetadata | null = null;
    try {
      const audioFile = new File([data], fileName, { type: mimeType });
      metadata = await mm.parseBlob(audioFile);
    } catch (err) {
      console.warn('[Metadata] parseBlob(File) failed:', fileName);
      metadata = null;
    }
    if (!metadata) {
      try {
        metadata = await mm.parseBuffer(data, mimeType);
      } catch {
        console.warn('[Metadata] parseBuffer failed:', fileName);
        metadata = null;
      }
    }
    if (!metadata) {
      try {
        const blob = new Blob([data], { type: mimeType });
        metadata = await mm.parseBlob(blob);
      } catch {
        console.warn('[Metadata] parseBlob(Blob) failed:', fileName);
        metadata = null;
      }
    }

    // Tier 4 — fetch via Tauri asset protocol (same mechanism playback uses)
    if (!metadata) {
      try {
        const assetUrl = convertFileSrc(filePath);
        const resp = await fetch(assetUrl);
        const blob = await resp.blob();
        if (blob.size > 100) {
          metadata = await mm.parseBlob(blob);
        }
      } catch {
        console.warn('[Metadata] fetch+parseBlob failed:', fileName);
        metadata = null;
      }
    }

    if (metadata) {
      const { common, format } = metadata;
      const title = common.title || fileName.replace(/\.[^/.]+$/, "");
      const artist = common.artist || 'Unknown Artist';
      const duration = format.duration || 0;
      const hasPics = !!(common.picture && common.picture.length > 0);
      console.log('[Metadata] music-metadata-browser OK:', fileName, { title, artist, hasCover: hasPics });

      let coverUrl: string | undefined;
      if (hasPics) {
        const pic = common.picture![0];
        const format2 = pic.format;
        console.log('[Metadata] Cover pic.format:', format2, 'pic.data.length:', (pic.data as any).length || (pic.data as any).byteLength || '?');
        const binary = Array.from(new Uint8Array(pic.data)).map(b => String.fromCharCode(b)).join('');
        coverUrl = `data:${format2};base64,${btoa(binary)}`;
        console.log('[Metadata] Raw coverUrl length:', coverUrl.length, 'prefix:', coverUrl.substring(0, 50));
        try {
          coverUrl = await compressCover(coverUrl);
          console.log('[Metadata] After compress, length:', coverUrl.length);
        } catch (e) {
          console.warn('[Metadata] compressCover failed, using original:', e);
        }
      } else {
        console.log('[Metadata] No cover art in metadata — trying manual APIC path...');
        const manual = parseId3v2Tags(data);
        console.log('[Metadata] Manual APIC result:', { hasCover: !!manual?.coverUrl, coverLen: manual?.coverUrl?.length });
        if (manual?.coverUrl) {
          coverUrl = manual.coverUrl;
        }
      }
      return { coverUrl, title, artist, duration: Math.round(duration) };
    }

    // Manual fallback: format-specific byte-level parsers
    console.log('[Metadata] Manual parsing for', fileName, 'ext:', ext, 'size:', data.length, 'firstBytes:', Array.from(data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    let title: string | undefined;
    let artist: string | undefined;
    let coverUrl: string | undefined;
    let duration = 0;

    if (ext === 'mp3') {
      // ID3v2
      const id3v2 = parseId3v2Tags(data);
      if (id3v2) {
        console.log('[Metadata] ID3v2 found:', { title: id3v2.title, artist: id3v2.artist, hasCover: !!id3v2.coverUrl });
        title = id3v2.title;
        artist = id3v2.artist;
        coverUrl = id3v2.coverUrl;
      }
      // ID3v1 (if ID3v2 didn't give us title/artist)
      if (!title || !artist) {
        const id3v1 = parseId3v1Tags(data);
        if (id3v1) {
          console.log('[Metadata] ID3v1 found:', { title: id3v1.title, artist: id3v1.artist });
          title = title || id3v1.title;
          artist = artist || id3v1.artist;
        }
      }
    } else if (ext === 'm4a' || ext === 'mp4' || ext === 'aac') {
      const mp4 = parseMp4Metadata(data);
      title = mp4.title;
      artist = mp4.artist;
      coverUrl = mp4.coverUrl;
      duration = mp4.duration;
    } else if (ext === 'flac') {
      const flac = parseFlacMetadata(data);
      title = flac.title;
      artist = flac.artist;
      coverUrl = flac.coverUrl;
      duration = flac.duration;
    }

    return {
      coverUrl,
      title,
      artist,
      duration: Math.round(duration),
    };
  } catch (err) {
    console.warn('[Metadata] extractAudioMetadata failed for', fileName, err);
    return { duration: 0 };
  }
}
