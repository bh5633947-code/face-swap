import { Redis } from '@upstash/redis';

const KEY = 'colab:current';
export const MAX_AGE_MS = 5 * 60 * 1000;

export type Registration = { url: string; lastSeen: number };

export function redisConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
  };
}

function redis() {
  const { url, token } = redisConfig();
  if (!url || !token) {
    throw new Error('Upstash não conectado. Vercel → Storage → Upstash → Connect ao projeto, depois Redeploy.');
  }
  return new Redis({ url, token });
}

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
  await redis().set(KEY, reg);
}

export async function getRegistration(): Promise<Registration | null> {
  const raw = await redis().get<Registration | string>(KEY);
  if (!raw) return null;
  return typeof raw === 'string' ? (JSON.parse(raw) as Registration) : raw;
}

export async function getActiveUrl(): Promise<string | null> {
  const reg = await getRegistration();
  if (!reg || Date.now() - reg.lastSeen > MAX_AGE_MS) return null;
  return reg.url;
}
