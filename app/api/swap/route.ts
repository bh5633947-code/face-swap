import { NextResponse } from 'next/server';
import { Client, handle_file } from '@gradio/client';
import { put, del } from '@vercel/blob';
import { getActiveUrl } from '../../../lib/registry';

export const runtime = 'nodejs';
export const maxDuration = 300; // segundos; confira o teto do seu plano no painel do Vercel

function isVercelBlobUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

// Procura a primeira URL de arquivo no retorno do Gradio (o formato muda entre versões)
function findFileUrl(data: unknown): string | null {
  if (typeof data === 'string') return data.startsWith('http') ? data : null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findFileUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.url === 'string') return obj.url;
    for (const value of Object.values(obj)) {
      const found = findFileUrl(value);
      if (found) return found;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const { videoUrl, photoUrl } = await req.json().catch(() => ({}));
  const token = process.env.GRADIO_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'GRADIO_TOKEN não definido.' }, { status: 500 });
  }
  if (!isVercelBlobUrl(videoUrl) || !isVercelBlobUrl(photoUrl)) {
    return NextResponse.json({ error: 'Arquivos inválidos.' }, { status: 400 });
  }

  // URL vem do Redis, preenchida automaticamente pelo Colab
  const gradioUrl = await getActiveUrl();
  if (!gradioUrl) {
    await Promise.allSettled([del(videoUrl), del(photoUrl)]);
    return NextResponse.json(
      { error: 'Servidor offline. Tente novamente quando o processamento estiver ativo.' },
      { status: 503 },
    );
  }

  try {
    const client = await Client.connect(gradioUrl);
    const result = await client.predict('/swap', [
      { video: handle_file(videoUrl) },
      handle_file(photoUrl),
      token,
    ]);

    const remote = findFileUrl(result.data);
    if (!remote) throw new Error('Resposta do Colab sem arquivo de vídeo.');

    const fileRes = await fetch(new URL(remote, gradioUrl));
    if (!fileRes.ok) throw new Error(`Falha ao baixar o resultado (${fileRes.status}).`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    const saved = await put('outputs/face-swap.mp4', buffer, {
      access: 'public',
      contentType: 'video/mp4',
      addRandomSuffix: true,
    });

    // Apaga as entradas (vídeo e foto da pessoa) assim que o resultado está salvo
    await Promise.allSettled([del(videoUrl), del(photoUrl)]);

    return NextResponse.json({ url: saved.url });
  } catch (err) {
    console.error('swap error:', err);
    await Promise.allSettled([del(videoUrl), del(photoUrl)]);
    return NextResponse.json(
      { error: 'Não foi possível processar. O Colab pode ter caído ou estar ocupado. Tente de novo.' },
      { status: 502 },
    );
  }
}
