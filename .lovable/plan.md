

## Problema Identificado

O botão "Melhorar" na aba "Gerar" (para geração de **imagens**) está chamando a função `enhance-video-prompt`, que é otimizada para prompts de **vídeo** (menciona movimento de câmera, dolly, pan, etc).

## Solução

Criar uma nova edge function `enhance-image-prompt` específica para geração de imagens e atualizar o `AssetSidebar.tsx` para usá-la.

### Alterações:

1. **Nova Edge Function: `enhance-image-prompt`**
   - System prompt focado em: composição visual, iluminação, estilo artístico, detalhes de textura, cores
   - Sem referências a movimento de câmera ou transições

2. **Atualizar `AssetSidebar.tsx`**
   - Mudar a chamada de `enhance-video-prompt` para `enhance-image-prompt` na função `enhancePrompt()`

3. **Registrar no `supabase/config.toml`**

