import { put, list, get } from '@vercel/blob';

// Registro do Colab guardado no Vercel Blob PRIVADO (sem Redis).
// Um único arquivo JSON é sobrescrito a cada heartbeat.
const PATH = 'registry/colab.json';
export const MAX_AGE_MS = 5 * 60 * 1000;

export type Registration = { url: string; lastSeen: number };

// Aceita só https://algo.gradio.live (sem caminho)
export function isGradioShareUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.endsWith('.gradio.live') && u.pathname === '/';
  } catch {
    return false;
  }
}

export async function saveRegistration(url: string) {
  const reg: Registration = { url, lastSeen: Date.now() };
  await put(PATH, JSON.stringify(reg), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function getRegistration(): Promise<Registration | null> {
  const result = await get(PATH, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text) as Registration;
}

export async function getActiveUrl(): Promise<string | null> {
  const reg = await getRegistration();
  if (!reg || Date.now() - reg.lastSeen > MAX_AGE_MS) return null;
  return reg.url;
}
