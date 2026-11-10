import { NextRequest, NextResponse } from 'next/server';
import { addDocumentComment, toggleCommentResolved } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as { userId?: string; content?: string };
    const userId = String(
      body.userId || req.headers.get('x-user-id') || 'user-wesam'
    ).trim();
    const document = await addDocumentComment({
      documentId: params.id,
      userId,
      content: String(body.content ?? ''),
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const message = err instanceof Error ? err.message : 'Failed to add comment';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as { userId?: string; commentId?: string };
    const userId = String(
      body.userId || req.headers.get('x-user-id') || 'user-wesam'
    ).trim();
    const document = await toggleCommentResolved({
      documentId: params.id,
      userId,
      commentId: String(body.commentId ?? ''),
    });
    return NextResponse.json({ document });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const message = err instanceof Error ? err.message : 'Failed to update comment';
    return NextResponse.json({ error: message }, { status });
  }
}
