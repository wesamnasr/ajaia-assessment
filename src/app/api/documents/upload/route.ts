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

    let fileName = '';
    let mimeType = 'text/plain';
    let fileBuffer: Buffer = Buffer.alloc(0);
    let mode = 'new-document';
    let userId = req.headers.get('x-user-id') || 'user-wesam';
    let documentId = '';
    let customTitle = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const fileEntry = formData.get('file');
      if (!fileEntry || typeof fileEntry === 'string') {
        return NextResponse.json({ error: 'A valid file upload is required' }, { status: 400 });
      }
      fileName = fileEntry.name || 'uploaded.txt';
      mimeType = fileEntry.type || 'text/plain';
      const arrayBuf = await fileEntry.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
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
      fileName = String(body.fileName || '').trim();
      if (!fileName) {
        return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
      }
      mimeType = String(body.mimeType || 'text/plain');
      if (body.contentBase64) {
        fileBuffer = Buffer.from(String(body.contentBase64), 'base64');
      } else {
        fileBuffer = Buffer.from(String(body.contentText ?? ''), 'utf8');
      }
      mode = String(body.mode || 'new-document');
      userId = String(body.userId || userId);
      documentId = String(body.documentId || '');
      customTitle = String(body.title || '').trim();
    }

    if (fileBuffer.length === 0) {
      return NextResponse.json({ error: 'Uploaded file cannot be empty' }, { status: 400 });
    }

    if (fileBuffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds maximum allowed size of 2 MB' },
        { status: 413 }
      );
    }

    const parsed = parseUploadedFileToRichContent(fileName, fileBuffer);

    if (mode === 'new-document') {
      const created = await createDocument({
        title: customTitle || parsed.suggestedTitle,
        contentHtml: parsed.contentHtml,
        ownerId: userId,
        versionSummary: `Created from uploaded file "${fileName}"`,
      });
      const updatedWithAtt = await addAttachmentToDocument({
        documentId: created.id,
        userId,
        fileName,
        mimeType,
        sizeBytes: fileBuffer.length,
        extractedText: parsed.plainText.slice(0, 5000),
        base64Data: fileBuffer.toString('base64'),
      });
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

    const updatedDoc = await addAttachmentToDocument({
      documentId,
      userId,
      fileName,
      mimeType,
      sizeBytes: fileBuffer.length,
      extractedText: parsed.plainText.slice(0, 5000),
      base64Data: fileBuffer.toString('base64'),
      appendHtmlToDocument: mode === 'import-into-doc' ? parsed.contentHtml : undefined,
    });

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
