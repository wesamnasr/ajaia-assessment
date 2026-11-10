import { NextResponse } from 'next/server';
import { getStorageHealth } from '@/lib/db';
import { loadEnv } from '@/lib/llm-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  loadEnv();
  const storage = await getStorageHealth();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    storageMode: storage.mode,
    userCount: storage.userCount,
    documentCount: storage.documentCount,
    aiProviderReady: Boolean(
      process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    ),
  });
}
