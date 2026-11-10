import { NextRequest, NextResponse } from 'next/server';
import {
  deleteDocument,
  getDocumentDetailForUser,
  updateDocument,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId =
      req.nextUrl.searchParams.get('userId') ||
      req.headers.get('x-user-id') ||
      'user-wesam';
    const document = await getDocumentDetailForUser(params.id, userId);
    return NextResponse.json({ document });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Failed to load document';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      title?: string;
      contentHtml?: string;
      createVersionSnapshot?: boolean;
      versionSummary?: string;
    };
    const userId = String(
      body.userId || req.headers.get('x-user-id') || 'user-wesam'
    ).trim();

    const document = await updateDocument({
      documentId: params.id,
      userId,
      title: body.title,
      contentHtml: body.contentHtml,
      createVersionSnapshot: body.createVersionSnapshot,
      versionSummary: body.versionSummary,
    });
    return NextResponse.json({ document });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Failed to update document';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } }
) {
  return PATCH(req, context);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId =
      req.nextUrl.searchParams.get('userId') ||
      req.headers.get('x-user-id') ||
      'user-wesam';
    const result = await deleteDocument(params.id, userId);
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Failed to delete document';
    return NextResponse.json({ error: message }, { status });
  }
}
