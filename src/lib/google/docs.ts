import { apiFetch } from './index';

interface DocResponse {
  documentId: string;
  documentUrl: string;
}

export async function createDocument(title: string, content: string): Promise<DocResponse> {
  const doc = await apiFetch<{ documentId: string }>('/docs/v1/documents', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });

  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text: content,
      },
    },
  ];

  await apiFetch(`/docs/v1/documents/${doc.documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });

  return {
    documentId: doc.documentId,
    documentUrl: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

interface SheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

export async function createSpreadsheet(title: string, rows: (string | number)[][]): Promise<SheetResponse> {
  const sheet = await apiFetch<{ spreadsheetId: string; spreadsheetUrl: string }>('/sheets/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: 'Data' } }],
    }),
  });

  if (rows.length > 0) {
    await apiFetch(`/sheets/v4/spreadsheets/${sheet.spreadsheetId}/values/A1:append`, {
      method: 'POST',
      body: JSON.stringify({
        values: rows,
        majorDimension: 'ROWS',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return {
    spreadsheetId: sheet.spreadsheetId,
    spreadsheetUrl: sheet.spreadsheetUrl,
  };
}

export async function exportNotesToDoc(
  notes: { title: string; content: string; folder?: string }[],
): Promise<string> {
  const content = notes
    .map(n => `${n.title}\n${'='.repeat(n.title.length)}\n\n${n.content || '(sin contenido)'}\n\n---\n`)
    .join('\n');
  const result = await createDocument('POUH - Notas', content);
  return result.documentUrl;
}

export async function exportStatsToSheet(
  headers: string[],
  data: (string | number)[][],
): Promise<string> {
  const result = await createSpreadsheet('POUH - Estadísticas', [headers, ...data]);
  return result.spreadsheetUrl;
}

export async function exportStudyPlanToSlides(
  title: string,
  points: string[],
): Promise<string> {
  const slide = await apiFetch<{ presentationId: string; presentationUrl: string }>('/slides/v1/presentations', {
    method: 'POST',
    body: JSON.stringify({
      title,
      slides: [
        {
          pageElements: [
            {
              shape: {
                shapeType: 'TEXT_BOX',
                text: {
                  textElements: [{
                    textRun: { content: points.join('\n• '), style: { fontSize: { magnitude: 18, unit: 'PT' } } },
                  }],
                },
              },
              size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 400, unit: 'PT' } },
              transform: { scaleX: 1, scaleY: 1, translateX: 50, translateY: 50, unit: 'PT' },
            },
          ],
        },
      ],
    }),
  });
  return slide.presentationUrl;
}
