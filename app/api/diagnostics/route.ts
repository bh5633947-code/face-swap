import { NextResponse } from 'next/server';
import { getRegistration, MAX_AGE_MS, type Registration } from '../../../lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!process.env.REGISTER_SECRET || key !== process.env.REGISTER_SECRET) {
    return NextResponse.json({ error: 'Use ?key= com o valor de REGISTER_SECRET.' }, { status: 401 });
  }

  const env = {
    REGISTER_SECRET: !!process.env.REGISTER_SECRET,
    GRADIO_TOKEN: !!process.env.GRADIO_TOKEN,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
  };

  let reg: Registration | null = null;
  let registryOk = false;
  let registryError: string | null = null;
  try {
    reg = await getRegistration();
    registryOk = true;
  } catch (e) {
    registryError = (e as Error).message;
  }

  let registration = null;
  let gradio: string | null = null;
  if (reg) {
    const ageSeconds = Math.round((Date.now() - reg.lastSeen) / 1000);
    registration = { url: reg.url, ageSeconds, stale: ageSeconds * 1000 > MAX_AGE_MS };
    try {
      const r = await fetch(`${reg.url}/config`, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
      gradio = `HTTP ${r.status}`;
    } catch (e) {
      gradio = `erro: ${(e as Error).message}`;
    }
  }

  return NextResponse.json({ env, registryOk, registryError, registration, gradio });
}
