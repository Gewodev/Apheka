import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';

const isTauri = !!(window as any).__TAURI__;

async function saveDataUrlToTempFile(dataUrl: string, fileName: string): Promise<string | null> {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/data:([^;]+)/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

    const pathMod = await import('@tauri-apps/api/path');
    const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
    const appDataDirPath = await pathMod.appDataDir();
    const tempDir = await pathMod.join(appDataDirPath, 'temp_files');
    if (!await exists(tempDir)) await mkdir(tempDir, { recursive: true });
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = await pathMod.join(tempDir, `vw_${Date.now()}_${safeName}`);
    await writeFile(filePath, new Uint8Array(ab));
    return filePath;
  } catch { return null; }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    if (!dataUrl.startsWith('data:')) return null;
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/data:([^;]+)/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mime });
  } catch { return null; }
}

function openDataUrlInBrowser(dataUrl: string, fileName: string) {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const isViewable = blob.type.startsWith('image/') || blob.type === 'application/pdf';
  if (isViewable) {
    a.target = '_blank';
    a.rel = 'noopener,noreferrer';
  } else {
    a.download = fileName || 'file';
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

function openLinkInBrowser(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function openPdfViewer(dataUrl: string, title: string, type: string) {
  if (!isTauri) {
    if (dataUrl.startsWith('http') || dataUrl.startsWith('blob:')) {
      openLinkInBrowser(dataUrl);
    } else if (dataUrl.startsWith('data:')) {
      openDataUrlInBrowser(dataUrl, title);
    } else {
      openLinkInBrowser(dataUrl);
    }
    return;
  }

  try {
    const existing = await WebviewWindow.getByLabel('pdf-viewer');
    if (existing) {
      try { await existing.destroy(); } catch {}
      await new Promise(r => setTimeout(r, 400));
    }
  } catch {}

  let finalUrl = dataUrl;
  if (dataUrl.startsWith('data:')) {
    const savedPath = await saveDataUrlToTempFile(dataUrl, title);
    if (savedPath) {
      try { finalUrl = convertFileSrc(savedPath); } catch { finalUrl = dataUrl; }
    }
  } else if (!dataUrl.startsWith('http') && !dataUrl.startsWith('blob:')) {
    try { finalUrl = convertFileSrc(dataUrl); } catch { finalUrl = dataUrl; }
  }

  const params = new URLSearchParams();
  params.set('vw_url', finalUrl);
  params.set('vw_title', title || 'Archivo');
  params.set('vw_type', type || 'file');

  try {
    new WebviewWindow('pdf-viewer', {
      url: `/?${params.toString()}`,
      title: 'Visor de archivo',
      width: 1000,
      height: 720,
      minWidth: 480,
      minHeight: 380,
      decorations: false,
      transparent: false,
      center: true,
      resizable: true,
      alwaysOnTop: false,
    });
  } catch (e) {
    console.error('[PdfViewer] failed to create window', e);
  }
}

function openWithSystemApp(path: string) {
  if (isTauri) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      openUrl(path).catch(() => openLinkInBrowser(path));
    } else {
      openPath(path).catch(() => openLinkInBrowser(path));
    }
  } else {
    openLinkInBrowser(path);
  }
}

export async function openFileSmart(dataUrl: string, fileName: string) {
  if (!dataUrl) return;

  const isLink = dataUrl.startsWith('http');
  const isData = dataUrl.startsWith('data:');
  const isLocal = !isLink && !isData && !dataUrl.startsWith('blob:');

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf' || dataUrl.includes('application/pdf');
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || dataUrl.startsWith('data:image');
  const isVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext) || dataUrl.startsWith('data:video');
  const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext) || dataUrl.startsWith('data:audio');
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext);
  const isYouTube = isLink && (dataUrl.includes('youtube.com') || dataUrl.includes('youtu.be'));
  const isWeb = isLink && !isYouTube;

  if (!isTauri) {
    if (isYouTube) {
      const match = dataUrl.match(/(?:v=|\.be\/|embed\/)([^&?#]+)/);
      const ytUrl = `https://www.youtube.com/watch?v=${match?.[1] || ''}`;
      openLinkInBrowser(ytUrl);
      return;
    }
    if (isLink || isLocal) {
      openLinkInBrowser(dataUrl);
      return;
    }
    if (isImage || isPdf || isAudio || isVideo || isData) {
      openDataUrlInBrowser(dataUrl, fileName);
      return;
    }
    openLinkInBrowser(dataUrl);
    return;
  }

  // ── Tauri mode ──
  if (isYouTube || isVideo) {
    let embedUrl = dataUrl;
    if (isYouTube) {
      const match = dataUrl.match(/(?:v=|\.be\/|embed\/)([^&?#]+)/);
      embedUrl = `https://www.youtube.com/embed/${match?.[1] || ''}`;
    }
    openPdfViewer(embedUrl, fileName, 'video');
    return;
  }

  if (isPdf || isImage) {
    openPdfViewer(dataUrl, fileName, isPdf ? 'pdf' : 'image');
    return;
  }

  if (isAudio) {
    openPdfViewer(dataUrl, fileName, 'audio');
    return;
  }

  if (isWeb) {
    openWithSystemApp(dataUrl);
    return;
  }

  if (isOffice || isData || isLocal) {
    openWithSystemApp(dataUrl);
    return;
  }

  openWithSystemApp(dataUrl);
}
