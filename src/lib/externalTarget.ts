/** Internal WebView URLs must never be handed to an external application. */
export function localPathFromUrl(value: string): string | null {
  const asset = value.match(/^(?:https?:\/\/asset\.localhost\/|asset:\/\/localhost\/)(.*)$/i);
  if (asset) {
    try { return decodeURIComponent(asset[1]); } catch { throw new Error('La ruta del archivo está dañada.'); }
  }
  if (/^file:\/\//i.test(value)) {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname);
    return url.hostname ? `\\\\${url.hostname}${path.replace(/\//g, '\\')}` : path.replace(/^\/(?=[a-z]:)/i, '');
  }
  return /^[a-z]:[\\/]|^\\\\|^\//i.test(value) ? value : null;
}

export function externalTarget(value: string): string {
  const local = localPathFromUrl(value);
  if (local) return local;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Este recurso debe guardarse como archivo antes de abrirlo.');
  return url.href;
}
