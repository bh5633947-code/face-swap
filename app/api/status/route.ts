import { NextResponse } from 'next/server';
import { getRegistration, MAX_AGE_MS, type Registration } from '../../../lib/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  let reg: Registration | null;
  try {
    reg = await getRegistration();
  } catch (e) {
    return NextResponse.json({ online: false, reason: 'registro', detail: (e as Error).message });
  }
  if (!reg) return NextResponse.json({ online: false, reason: 'sem_registro' });

  const ageSeconds = Math.round((Date.now() - reg.lastSeen) / 1000);
  if (ageSeconds * 1000 > MAX_AGE_MS) {
    return NextResponse.json({ online: false, reason: 'heartbeat_antigo', ageSeconds });
  }

  try {
    const r = await fetch(`${reg.url}/config`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    const isJson = (r.headers.get('content-type') ?? '').includes('application/json');
    if (r.ok && isJson) return NextResponse.json({ online: true, ageSeconds });
    return NextResponse.json({ online: false, reason: 'tunel_sem_resposta_valida', status: r.status });
  } catch (e) {
    return NextResponse.json({ online: false, reason: 'tunel_inacessivel', detail: (e as Error).message });
  }
}
