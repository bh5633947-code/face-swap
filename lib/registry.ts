import { Redis } from '@upstash/redis';

const KEY = 'colab:current';
const MAX_AGE_MS = 5 * 60 * 1000; // heartbeat a cada 2 min; 5 min sem sinal = offline

export type Registration = { url: string; lastSeen: number };

function redis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '',
  });
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

// Retorna a URL só se o último heartbeat for recente
export async function getActiveUrl(): Promise<string | null> {
  const reg = await redis().get<Registration>(KEY);
  if (!reg) return null;
  if (Date.now() - reg.lastSeen > MAX_AGE_MS) return null;
  return reg.url;
}
