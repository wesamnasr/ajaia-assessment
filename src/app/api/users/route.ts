import { NextRequest, NextResponse } from 'next/server';
import { createOrGetUser, listUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; email?: string; roleTitle?: string };
    const user = await createOrGetUser({
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
      roleTitle: body.roleTitle,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 500;
    const message = err instanceof Error ? err.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status });
  }
}
