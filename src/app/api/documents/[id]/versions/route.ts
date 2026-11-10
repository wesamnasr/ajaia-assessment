import { NextRequest, NextResponse } from 'next/server';
import { restoreDocumentVersion } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as { userId?: string; versionId?: string };
    const userId = String(
      body.userId || req.headers.get('x-user-id') || 'user-wesam'
    ).trim();
    const document = await restoreDocumentVersion({
      documentId: params.id,
      userId,
      versionId: String(body.versionId ?? ''),
    });
    return NextResponse.json({ document });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const message = err instanceof Error ? err.message : 'Failed to restore version';
    return NextResponse.json({ error: message }, { status });
  }
}
