import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { isGradioShareUrl, saveRegistration } from '../../../../lib/registry';

export const dynamic = 'force-dynamic';

function authorized(header: string | null): boolean {
  const secret = process.env.REGISTER_SECRET;
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === 'string' ? body.url.replace(/\/$/, '') : '';
  if (!isGradioShareUrl(url)) {
    return NextResponse.json({ error: 'URL inválida.' }, { status: 400 });
  }

  await saveRegistration(url);
  return NextResponse.json({ ok: true });
}
