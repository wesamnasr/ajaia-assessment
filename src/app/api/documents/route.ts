import { NextRequest, NextResponse } from 'next/server';
import { createDocument, listDocumentsForUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId =
      req.nextUrl.searchParams.get('userId') ||
      req.headers.get('x-user-id') ||
      'user-wesam';
    const docs = await listDocumentsForUser(userId);
    return NextResponse.json({
      activeUserId: userId,
      owned: docs.owned,
      shared: docs.shared,
    });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Failed to list documents';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title?: string;
      contentHtml?: string;
      ownerId?: string;
      ownerName?: string;
      ownerEmail?: string;
      versionSummary?: string;
    };
    const ownerId =
      String(body.ownerId || req.headers.get('x-user-id') || 'user-wesam').trim();
    const doc = await createDocument({
      title: String(body.title ?? ''),
      contentHtml: body.contentHtml,
      ownerId,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      versionSummary: body.versionSummary,
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Failed to create document';
    return NextResponse.json({ error: message }, { status });
  }
}
