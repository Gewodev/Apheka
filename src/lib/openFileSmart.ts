import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { convertFileSrc } from '@tauri-apps/api/core';

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

async function openPdfViewer(dataUrl: string, title: string, type: string) {
  try {
    const existing = await WebviewWindow.getByLabel('pdf-viewer');
    if (existing) {
      try { await existing.destroy(); } catch {}
      await new Promise(r => setTimeout(r, 400));
    }
  } catch {}

  // Convert the data to a URL the viewer window can load directly
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
  if ((window as any).__TAURI__?.shell?.open) {
    (window as any).__TAURI__.shell.open(path).catch(() => {
      window.open(path, '_blank', 'noopener,noreferrer');
    });
  } else {
    window.open(path, '_blank', 'noopener,noreferrer');
  }
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string; mime: string } | null {
  try {
    if (!dataUrl.startsWith('data:')) return null;
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/data:([^;]+)/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return { blob: new Blob([ab], { type: mime }), ext, mime };
  } catch { return null; }
}

async function saveBase64ToFile(dataUrl: string, fileName: string): Promise<string | null> {
  const result = dataUrlToBlob(dataUrl);
  if (!result) return null;
  try {
    const pathMod = await import('@tauri-apps/api/path');
    const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
    const appDataDirPath = await pathMod.appDataDir();
    const tempDir = await pathMod.join(appDataDirPath, 'temp_files');
    if (!await exists(tempDir)) await mkdir(tempDir, { recursive: true });
    const filePath = await pathMod.join(tempDir, fileName);
    const arrayBuffer = await result.blob.arrayBuffer();
    await writeFile(filePath, new Uint8Array(arrayBuffer));
    return filePath;
  } catch { return null; }
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

  if (isOffice) {
    if (isData) {
      const savedPath = await saveBase64ToFile(dataUrl, fileName);
      if (savedPath) { openWithSystemApp(savedPath); return; }
    } else if (isLocal) {
      openWithSystemApp(dataUrl);
      return;
    }
    openWithSystemApp(dataUrl);
    return;
  }

  if (isLocal) {
    openWithSystemApp(dataUrl);
    return;
  }

  if (isData) {
    const savedPath = await saveBase64ToFile(dataUrl, fileName);
    if (savedPath) { openWithSystemApp(savedPath); return; }
  }

  openWithSystemApp(dataUrl);
}
