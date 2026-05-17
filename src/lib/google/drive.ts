import { apiFetch } from './index';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  parents?: string[];
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export async function listFiles(
  query?: string,
  pageSize = 50,
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents)',
    orderBy: 'modifiedTime desc',
  });
  if (query) params.set('q', query);

  const res = await apiFetch<DriveListResponse>(
    `/drive/v3/files?${params}`,
  );
  return res.files;
}

export async function findOrCreateFolder(name: string): Promise<string> {
  const existing = await listFiles(
    `name='${name}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    1,
  );
  if (existing.length > 0) return existing[0].id;

  const folder = await apiFetch<DriveFile>('/drive/v3/files', {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
    }),
  });
  return folder.id;
}

export async function uploadFile(
  name: string,
  content: string,
  mimeType = 'text/plain',
  parentId?: string,
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = { name, mimeType };
  if (parentId) metadata.parents = [parentId];

  const boundary = 'drv_bnd_' + Date.now().toString(36);
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  return apiFetch<DriveFile>(`/upload/drive/v3/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
}

export async function downloadFile(fileId: string): Promise<string> {
  const res = await apiFetch<{ content: string }>(
    `/drive/v3/files/${fileId}?alt=media`,
  );
  return (res as unknown as string);
}

export async function backupAppData(
  data: Record<string, unknown>,
): Promise<string> {
  const folderId = await findOrCreateFolder('OWA_Studio_Backup');
  const timestamp = new Date().toISOString().split('.')[0].replace(/[:]/g, '-');
  const file = await uploadFile(
    `backup_${timestamp}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
    folderId,
  );
  return `https://drive.google.com/file/d/${file.id}/view`;
}

export async function listBackups(): Promise<{ id: string; name: string; modifiedTime: string }[]> {
  const folderId = await findOrCreateFolder('OWA_Studio_Backup');
  const files = await listFiles(
    `'${folderId}' in parents and trashed=false`,
    20,
  );
  return files.map(f => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
}

export async function restoreFromBackup(
  fileId: string,
): Promise<Record<string, unknown>> {
  const raw = await downloadFile(fileId);
  return JSON.parse(raw) as Record<string, unknown>;
}
