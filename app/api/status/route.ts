import { NextResponse } from 'next/server';
import { getActiveUrl } from '../../../lib/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = await getActiveUrl();
  if (!url) return NextResponse.json({ online: false, reason: 'sem heartbeat recente' });

  try {
    // Confere também se o túnel responde de verdade
    const r = await fetch(`${url}/config`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    const isJson = (r.headers.get('content-type') ?? '').includes('application/json');
    return NextResponse.json({ online: r.ok && isJson });
  } catch {
    return NextResponse.json({ online: false });
  }
}
