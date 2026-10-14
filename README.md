# Face swap em vídeo

Site Next.js (Vercel) que envia vídeo e foto para um FaceFusion rodando no Google Colab (GPU T4). O Colab se registra sozinho no site a cada 2 minutos via Upstash Redis.

## Estrutura

```
app/layout.tsx                    layout da página
app/page.tsx                      frontend (upload, preview, download, tela offline)
app/globals.css                   estilos
app/api/status/route.ts           diz se o Colab está online
app/api/blob-upload/route.ts      permissão para upload direto ao Vercel Blob
app/api/swap/route.ts             chama o Gradio e salva o resultado
app/api/colab/register/route.ts   recebe o heartbeat do Colab
lib/registry.ts                   guarda a URL do Colab no Redis
notebook/face_swap_colab.ipynb    notebook do Colab (importar em colab.research.google.com)
package.json, tsconfig.json, .gitignore
```

## Onde pegar cada chave

| Variável | Onde configurar | De onde vem |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel → Environment Variables | Automática: Vercel → projeto → **Storage → Create → Blob** → conectar ao projeto |
| `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (ou `KV_REST_API_URL` e `KV_REST_API_TOKEN`) | Vercel (automáticas) | Vercel → projeto → **Storage → Marketplace → Upstash (Redis) → Create** → conectar ao projeto |
| `GRADIO_TOKEN` | Vercel | Você cria. Gere um texto aleatório de 40+ caracteres. Tem que ser igual ao `API_TOKEN` |
| `REGISTER_SECRET` | Vercel **e** Colab (🔑 Secrets) | Você cria. Gere um texto aleatório de 40+ caracteres. Tem que ser igual nos dois lugares |
| `API_TOKEN` | Colab (🔑 Secrets) | Você cria. Mesmo valor de `GRADIO_TOKEN` |
| `SITE_URL` | Colab, célula 3 do notebook | O domínio do seu projeto, ex.: `https://face-swap-abc.vercel.app` (sem barra no final) |

**Como gerar os segredos:** use um gerador de senhas (Bitwarden, Google Password Manager) com 40+ caracteres, ou rode no Colab:

```python
import secrets
print(secrets.token_urlsafe(40))
```

Gere um valor para `API_TOKEN`/`GRADIO_TOKEN` e outro para `REGISTER_SECRET`. Não gere um valor novo a cada vez, senão os lados deixam de bater.

**Onde fica cada segredo no Colab:** barra lateral → ícone de chave 🔑 → **Add new secret**, com o nome exato (`API_TOKEN`, `REGISTER_SECRET`) e a opção **Notebook access** ligada.

**Não coloque segredos no código, no README nem no chat.** Mantenha o repositório privado.

## Passo a passo resumido

1. **GitHub:** crie um repositório privado `face-swap` e envie todos os arquivos deste projeto, mantendo as pastas (`app/`, `lib/`, `notebook/`).
2. **Vercel:** Add New → Project → importe o repositório → Deploy. A primeira build pode dar erro de runtime até as variáveis existirem; é normal.
3. **Vercel → Storage:** crie o Blob e o Upstash (Redis), conectando ambos ao projeto.
4. **Vercel → Settings → Environment Variables:** adicione `GRADIO_TOKEN` e `REGISTER_SECRET`. Marque **Production**.
5. **Vercel → Deployments → ⋯ → Redeploy.** Variáveis novas só valem depois de um redeploy.
6. **Colab:** importe `notebook/face_swap_colab.ipynb`, troque `SEU-PROJETO` na célula 3, crie os segredos `API_TOKEN` e `REGISTER_SECRET`, ative T4 GPU e rode as células em ordem.
7. Espere `[heartbeat] ... registro: ok` na célula 5 e abra o site.

## Limitações

- O Colab só roda enquanto alguém mantém o notebook aberto e executando. Se a sessão cair, o site fica offline após 5 minutos.
- Os termos do Google Colab não preveem servidor público 24/7. Use por sua conta e risco.
- O site é público. Antes de divulgar, adicione limite por IP ou uma senha de acesso.
- Fotos de rosto são dados biométricos pela LGPD. Você precisa de política de privacidade.
- O código não foi testado num ambiente real. Versões do FaceFusion, do Gradio e do `@gradio/client` mudam; se o processamento falhar, o log da célula 5 e a aba Logs do Vercel mostram o erro.
- Use `latest` nas dependências só para começar. Depois de funcionar, fixe as versões no `package.json`.
