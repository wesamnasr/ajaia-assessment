import { NextRequest, NextResponse } from 'next/server';
import { addAttachmentToDocument, createDocument } from '@/lib/db';
import {
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTENSIONS,
  parseUploadedFileToRichContent,
} from '@/lib/file-parser';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    interface IncomingFileItem {
      fileName: string;
      mimeType: string;
      fileBuffer: Buffer;
    }

    const incomingFiles: IncomingFileItem[] = [];
    let mode = 'new-document';
    let userId = req.headers.get('x-user-id') || 'user-wesam';
    let documentId = '';
    let customTitle = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const rawEntries = [
        ...formData.getAll('files'),
        ...formData.getAll('file'),
      ];
      const seen = new Set<File>();
      for (const entry of rawEntries) {
        if (entry && typeof entry !== 'string' && !seen.has(entry)) {
          seen.add(entry);
          const arrayBuf = await entry.arrayBuffer();
          incomingFiles.push({
            fileName: entry.name || 'uploaded.txt',
            mimeType: entry.type || 'text/plain',
            fileBuffer: Buffer.from(arrayBuf),
          });
        }
      }
      if (incomingFiles.length === 0) {
        return NextResponse.json({ error: 'A valid file upload is required' }, { status: 400 });
      }
      mode = String(formData.get('mode') || 'new-document');
      userId = String(formData.get('userId') || userId);
      documentId = String(formData.get('documentId') || '');
      customTitle = String(formData.get('title') || '').trim();
    } else {
      const body = (await req.json()) as {
        fileName?: string;
        mimeType?: string;
        contentBase64?: string;
        contentText?: string;
        mode?: string;
        userId?: string;
        documentId?: string;
        title?: string;
      };
      const fileName = String(body.fileName || '').trim();
      if (!fileName) {
        return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
      }
      const mimeType = String(body.mimeType || 'text/plain');
      const fileBuffer = body.contentBase64
        ? Buffer.from(String(body.contentBase64), 'base64')
        : Buffer.from(String(body.contentText ?? ''), 'utf8');

      incomingFiles.push({ fileName, mimeType, fileBuffer });
      mode = String(body.mode || 'new-document');
      userId = String(body.userId || userId);
      documentId = String(body.documentId || '');
      customTitle = String(body.title || '').trim();
    }

    for (const item of incomingFiles) {
      if (item.fileBuffer.length === 0) {
        return NextResponse.json(
          { error: `Uploaded file "${item.fileName}" cannot be empty` },
          { status: 400 }
        );
      }
      if (item.fileBuffer.length > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `File "${item.fileName}" exceeds maximum allowed size of 2 MB` },
          { status: 413 }
        );
      }
    }

    const parsedItems = incomingFiles.map((item) => ({
      ...item,
      parsed: parseUploadedFileToRichContent(item.fileName, item.fileBuffer),
    }));

    if (mode === 'new-document') {
      const first = parsedItems[0];
      const combinedHtml = parsedItems.map((p) => p.parsed.contentHtml).join('\n<hr/>\n');
      const created = await createDocument({
        title: customTitle || first.parsed.suggestedTitle,
        contentHtml: combinedHtml,
        ownerId: userId,
        versionSummary: `Created from uploaded file(s): ${parsedItems.map((p) => p.fileName).join(', ')}`,
      });
      let updatedWithAtt = created;
      for (const item of parsedItems) {
        updatedWithAtt = await addAttachmentToDocument({
          documentId: created.id,
          userId,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.fileBuffer.length,
          extractedText: item.parsed.plainText.slice(0, 5000),
          base64Data: item.fileBuffer.toString('base64'),
        });
      }
      return NextResponse.json(
        {
          mode,
          supportedExtensions: SUPPORTED_EXTENSIONS,
          document: updatedWithAtt,
        },
        { status: 201 }
      );
    }

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required when importing into or attaching to an existing document' },
        { status: 400 }
      );
    }

    let updatedDoc = null;
    for (const item of parsedItems) {
      updatedDoc = await addAttachmentToDocument({
        documentId,
        userId,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sizeBytes: item.fileBuffer.length,
        extractedText: item.parsed.plainText.slice(0, 5000),
        base64Data: item.fileBuffer.toString('base64'),
        appendHtmlToDocument: mode === 'import-into-doc' ? item.parsed.contentHtml : undefined,
      });
    }

    return NextResponse.json({
      mode,
      supportedExtensions: SUPPORTED_EXTENSIONS,
      document: updatedDoc,
    });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const message = err instanceof Error ? err.message : 'File upload failed';
    return NextResponse.json({ error: message }, { status });
  }
}
