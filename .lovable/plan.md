

# Otimização de Custos: Vídeo e Imagem AI

## Resumo dos custos atuais vs propostos

### Vídeo (FAL.ai)

| Modelo | 5s | 10s | Status |
|--------|-----|------|--------|
| Kling v2.1 **Master** (atual) | **$1.40** (~R$8,40) | **$2.80** (~R$16,80) | Muito caro |
| Kling v2.1 **Standard** | **$0.28** (~R$1,68) | **$0.56** (~R$3,36) | 5x mais barato |
| Kling v2.5 Turbo **Pro** | **$0.35** (~R$2,10) | **$0.70** (~R$4,20) | Mais novo, boa qualidade |

Nenhum modelo da FAL.ai atinge menos de R$1,00 por vídeo de 5s. O **Kling v2.1 Standard a $0.28 (≈R$1,68)** é o mais barato com suporte a image-to-video + tail_image_url.

Sobre Veo 3.1: na FAL.ai custa $0.50-$1.00 por 5s (sem suporte a image-to-video com duas imagens), e "Nano Banana" é um modelo de **imagem**, não de vídeo.

### Imagem

| Provedor | Custo | Notas |
|----------|-------|-------|
| Lovable AI Gateway (atual) | ~$0.04-0.07/img | Consome créditos Lovable |
| **Google Gemini API direto** | **GRÁTIS** (500 req/dia free tier) | Modelo: `gemini-2.0-flash-exp` com image generation |
| Google Gemini API (pago) | ~$0.04-0.07/img | Após free tier |

Usar a API do Google diretamente elimina o custo de imagens e remove dependência do Lovable AI Gateway.

## Funções afetadas

1. **`generate-ai-video/index.ts`** — trocar de `v2.1/master` para `v2.1/standard`
2. **`generate-ai-image/index.ts`** — trocar de Lovable AI Gateway para Google Gemini API direta (Imagen 3 ou Gemini Flash com image generation)
3. **`enhance-image-prompt/index.ts`** — trocar de Lovable AI Gateway para Google Gemini API direta (text-only, free tier)
4. **`enhance-video-prompt/index.ts`** — trocar de Lovable AI Gateway para Google Gemini API direta (text-only, free tier)

## Plano de implementação

### 1. Adicionar secret `GOOGLE_GEMINI_API_KEY`
Será necessário criar uma API key no Google AI Studio (aistudio.google.com) e adicioná-la como secret no Supabase.

### 2. Vídeo: trocar modelo para Standard
No `generate-ai-video/index.ts`, alterar os endpoints:
- Image-to-video: `v2.1/master/image-to-video` → `v2.1/standard/image-to-video`
- Text-to-video: `v2/master/text-to-video` → `v2.1/standard/text-to-video`

Economia: **80% de redução** ($1.40 → $0.28 por 5s).

### 3. Imagem: migrar para Google Gemini API
No `generate-ai-image/index.ts`, trocar a chamada do Lovable Gateway para a API do Google Gemini diretamente:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent
```
Com `responseModalities: ["TEXT", "IMAGE"]` para gerar imagens.

### 4. Prompt enhancement: migrar para Google Gemini API
Nos `enhance-image-prompt/index.ts` e `enhance-video-prompt/index.ts`, trocar para:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
```
Usando apenas text generation (free tier: 1500 req/dia).

## Custos estimados após otimização

| Recurso | Antes | Depois | Economia |
|---------|-------|--------|----------|
| Vídeo 5s | $1.40 | $0.28 | **-80%** |
| Vídeo 10s | $2.80 | $0.56 | **-80%** |
| Imagem | ~$0.05 (Lovable) | $0.00 (free tier) | **-100%** |
| Enhance prompt | ~$0.01 (Lovable) | $0.00 (free tier) | **-100%** |

