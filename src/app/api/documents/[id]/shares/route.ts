import { NextRequest, NextResponse } from 'next/server';
import { removeDocumentShare, shareDocumentWithUser } from '@/lib/db';
import { ShareRole } from '@/types/docs';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      actorUserId?: string;
      targetEmailOrUserId?: string;
      targetName?: string;
      role?: ShareRole;
    };
    const actorUserId = String(
      body.actorUserId || req.headers.get('x-user-id') || 'user-wesam'
    ).trim();

    const document = await shareDocumentWithUser({
      documentId: params.id,
      actorUserId,
      targetEmailOrUserId: String(body.targetEmailOrUserId ?? ''),
      targetName: body.targetName,
      role: (body.role || 'viewer') as ShareRole,
    });
    return NextResponse.json({ document });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const message = err instanceof Error ? err.message : 'Failed to share document';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let actorUserId =
      req.nextUrl.searchParams.get('actorUserId') ||
      req.headers.get('x-user-id') ||
      'user-wesam';
    let shareIdOrUserId =
      req.nextUrl.searchParams.get('shareId') ||
      req.nextUrl.searchParams.get('targetUserId') ||
      '';

    if (!shareIdOrUserId) {
      const body = (await req.json().catch(() => ({}))) as {
        actorUserId?: string;
        shareIdOrUserId?: string;
      };
      if (body.actorUserId) actorUserId = body.actorUserId;
      if (body.shareIdOrUserId) shareIdOrUserId = body.shareIdOrUserId;
    }

    const document = await removeDocumentShare({
      documentId: params.id,
      actorUserId,
      shareIdOrUserId,
    });
    return NextResponse.json({ document });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const message = err instanceof Error ? err.message : 'Failed to remove share';
    return NextResponse.json({ error: message }, { status });
  }
}
