'use client';

import { useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';

const MAX_VIDEO_SECONDS = 15;
const MAX_VIDEO_MB = 100;
const MAX_PHOTO_MB = 10;

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';
type Server = 'checking' | 'online' | 'offline';

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

// Lê a duração do vídeo para bloquear vídeos longos antes do envio
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const src = URL.createObjectURL(file);
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      resolve(v.duration);
      URL.revokeObjectURL(src);
    };
    v.onerror = () => {
      reject(new Error('Não consegui ler esse vídeo.'));
      URL.revokeObjectURL(src);
    };
    v.src = src;
  });
}

export default function Home() {
  const [server, setServer] = useState<Server>('checking');
  const [video, setVideo] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoPreview = useObjectUrl(video);
  const photoPreview = useObjectUrl(photo);
  const [reason, setReason] = useState('');

  // silent = true não mostra "Verificando..." (usado no polling)
  async function checkServer(silent = false) {
    if (!silent) setServer('checking');
    try {
      const r = await fetch('/api/status', { cache: 'no-store' });
      const d = await r.json();
      setServer(d.online ? 'online' : 'offline');
      setReason(d.reason ? d.reason + (d.detail ? ': ' + d.detail : '') : '');
    } catch {
      setServer('offline');
      setReason('falha ao consultar /api/status');
    }
  }

  useEffect(() => {
    checkServer();
  }, []);

  // Enquanto offline, verifica a cada 30 s e libera o formulário sozinho
  useEffect(() => {
    if (server !== 'offline') return;
    const id = setInterval(() => checkServer(true), 30000);
    return () => clearInterval(id);
  }, [server]);

  async function pickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResultUrl(null);
    if (!f.type.startsWith('video/')) {
      setError('Envie um arquivo de vídeo.');
      return;
    }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`O vídeo passa de ${MAX_VIDEO_MB} MB.`);
      return;
    }
    try {
      const dur = await readDuration(f);
      if (dur > MAX_VIDEO_SECONDS) {
        setError(`Use um vídeo de até ${MAX_VIDEO_SECONDS} s (o seu tem ${Math.round(dur)} s).`);
        return;
      }
      setVideo(f);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResultUrl(null);
    if (!f.type.startsWith('image/')) {
      setError('Envie uma imagem (JPG, PNG ou WEBP).');
      return;
    }
    if (f.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`A foto passa de ${MAX_PHOTO_MB} MB.`);
      return;
    }
    setPhoto(f);
  }

  async function run() {
    if (!video || !photo || !consent) return;
    setError(null);
    setResultUrl(null);
    try {
      setPhase('uploading');
      const opts = {
        access: 'public' as const,
        handleUploadUrl: '/api/blob-upload',
        addRandomSuffix: true,
      };
      const [v, p] = await Promise.all([
        upload(`inputs/${video.name}`, video, opts),
        upload(`inputs/${photo.name}`, photo, opts),
      ]);

      setPhase('processing');
      const r = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: v.url, photoUrl: p.url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Falha ao processar.');

      setResultUrl(d.url);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
      setPhase('error');
    }
  }

  const busy = phase === 'uploading' || phase === 'processing';
  const canRun = !!video && !!photo && consent && !busy;

  return (
    <main className="wrap">
      <h1>Face swap em vídeo</h1>
      <p className="muted">Vídeo curto (até {MAX_VIDEO_SECONDS} s) e uma foto de rosto.</p>

      {server === 'checking' && <p>Verificando o servidor…</p>}

      {server === 'offline' && (
        <div className="card offline">
          <h2>⚠️ Servidor de processamento offline</h2>
          <p>O processamento roda num Google Colab que está fechado ou reiniciou.</p>
          <p>
            Para reativar, abra o notebook no Colab e clique em <b>Ambiente de execução → Executar tudo</b>.
            Quando ele estiver rodando, este site se conecta sozinho em alguns minutos. Esta tela se atualiza
            automaticamente.
          </p>
          <button className="btn" onClick={() => checkServer()}>Verificar agora</button>
          {reason && <small className="muted">Diagnóstico: {reason}</small>}
        </div>
      )}

      {server === 'online' && (
        <>
          <div className="grid">
            <div className="card">
              <strong>1. Vídeo</strong>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={pickVideo}
                disabled={busy}
              />
              {videoPreview && <video src={videoPreview} controls playsInline />}
            </div>

            <div className="card">
              <strong>2. Foto do rosto</strong>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={pickPhoto}
                disabled={busy}
              />
              {photoPreview && <img className="preview" src={photoPreview} alt="Foto enviada" />}
            </div>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Tenho permissão de todas as pessoas que aparecem no vídeo e da pessoa da foto, e não
              vou usar o resultado para enganar, difamar ou criar conteúdo sexual ou íntimo.
            </span>
          </label>

          <button className="btn" onClick={run} disabled={!canRun}>
            Gerar face swap
          </button>

          {phase === 'uploading' && <p>Enviando arquivos…</p>}
          {phase === 'processing' && (
            <p>Processando no servidor. Pode levar vários minutos. Mantenha esta aba aberta.</p>
          )}
          {error && <div className="error">{error}</div>}

          {resultUrl && (
            <div className="card">
              <strong>Pronto!</strong>
              <video src={resultUrl} controls playsInline />
              <a className="btn" href={resultUrl} download="face-swap.mp4" target="_blank" rel="noreferrer">
                Baixar vídeo
              </a>
              <small className="muted">
                Se o download não iniciar, segure o vídeo e escolha "Salvar". Alguns navegadores abrem em nova aba.
              </small>
            </div>
          )}
        </>
      )}
    </main>
  );
}
