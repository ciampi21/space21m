

## Plano: Página de Criação de Vídeos com IA

### Recomendação de API

Recomendo **FAL.ai** pelos seguintes motivos:
- Hospeda **Kling v2** (um dos melhores modelos de image-to-video atualmente)
- API simples e bem documentada
- Suporta image-to-video e text-to-video
- Preço acessível por geração (~$0.05-0.10 por vídeo)
- Resposta assíncrona com polling (ideal para gerações em paralelo)

Você precisará criar uma conta em **fal.ai** e obter uma API key.

### Arquitetura

```text
┌─────────────────────────────────┐
│  /ai-video (Nova Página)        │
│                                 │
│  ┌──────────┐  ┌──────────┐    │
│  │ Upload   │  │ Upload   │    │
│  │ Img 1    │  │ Img 2    │    │
│  └──────────┘  └──────────┘    │
│                                 │
│  ┌────────────────────────┐    │
│  │ Prompt + Botão "✨ AI" │    │
│  └────────────────────────┘    │
│                                 │
│  ┌─────────┐  ┌─────────┐     │
│  │ Vídeo 1 │  │ Vídeo 2 │     │
│  │ (slot)   │  │ (slot)  │     │
│  └─────────┘  └─────────┘     │
└─────────────────────────────────┘

Edge Functions:
- enhance-video-prompt → Lovable AI (melhora o prompt)
- generate-ai-video   → FAL.ai (gera o vídeo)
- check-video-status  → FAL.ai (polling do status)
```

### O que será construído

1. **Nova página `/ai-video`** com design visual inspirado na referência (cards com preview de imagens, interface limpa)
2. **Upload de 1-2 imagens** com preview, drag & drop
3. **Campo de prompt** com botão "Melhorar com IA" que usa Lovable AI para refinar o texto
4. **2 slots de geração paralela** - cada um com status independente (aguardando, gerando, concluído)
5. **Edge function `enhance-video-prompt`** - usa Lovable AI para melhorar prompts de vídeo
6. **Edge function `generate-ai-video`** - envia request para FAL.ai e retorna o request ID
7. **Edge function `check-video-status`** - faz polling do status no FAL.ai
8. **Download do vídeo** gerado
9. **Rota adicionada ao App.tsx** e link na página Tools

### Pré-requisito

Antes de implementar, será necessário:
- Criar conta no **fal.ai** (https://fal.ai)
- Obter a **FAL_KEY** (API key)
- Eu vou solicitar que você adicione como secret no Supabase

### Detalhes técnicos

- **Modelo**: `fal-ai/kling-video/v2/master/image-to-video` (Kling v2 image-to-video)
- **Melhoria de prompt**: Edge function usando Lovable AI com system prompt especializado em prompts de vídeo
- **Geração assíncrona**: FAL.ai retorna um `request_id`, fazemos polling a cada 5s até completar
- **Parallelismo**: Estado independente para cada slot, permitindo 2 gerações simultâneas
- **Tabela no banco**: `ai_video_generations` para histórico (opcional, pode ser adicionada depois)

