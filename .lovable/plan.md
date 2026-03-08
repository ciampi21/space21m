

## Feature: Sidebar de Assets com Geração de Imagens por IA

### Visão geral

Adicionar uma sidebar colapsável à esquerda da página `/ai-video` que funciona como uma **biblioteca de assets**. O usuário pode:
1. **Gerar imagens com IA** (via prompt de texto) diretamente na sidebar
2. **Fazer upload de imagens** do computador
3. **Arrastar imagens da sidebar para o canvas** como novos ImageNodes

### Componentes a criar/modificar

**1. Novo componente: `src/components/ai-video/AssetSidebar.tsx`**
- Sidebar fixa à esquerda (~280px) com toggle para colapsar
- Duas abas: "Gerar" e "Uploads"
- **Aba Gerar**: campo de prompt + botão "Gerar Imagem" → chama edge function → mostra resultado como thumbnail na galeria
- **Aba Uploads**: área de drag-and-drop para upload local, mostra thumbnails
- Cada thumbnail na galeria é **draggable** (HTML5 drag) com dados `{ type: 'sidebar-image', url, file }`
- Estado local: lista de `GeneratedImage[]` com `{ id, prompt, url, isGenerating }`

**2. Nova edge function: `supabase/functions/generate-ai-image/index.ts`**
- Recebe `{ prompt }` do frontend
- Usa a Lovable AI Gateway (`google/gemini-2.5-flash-image`) com `modalities: ["image", "text"]`
- Retorna a imagem base64 gerada
- Usa `LOVABLE_API_KEY` (já configurada no projeto, usada pelo enhance-video-prompt)

**3. Modificar: `src/pages/AIVideo.tsx`**
- Adicionar `AssetSidebar` ao layout, à esquerda do canvas
- Adicionar handler `onDrop` no container do ReactFlow para receber drops da sidebar
- Quando uma imagem é dropada no canvas: cria um novo ImageNode na posição do drop com a imagem já preenchida
- Layout: `flex flex-row` → sidebar (w-72 colapsável) + canvas (flex-1)

### Fluxo do drop (sidebar → canvas)

1. Usuário arrasta thumbnail da sidebar
2. `dataTransfer` contém `{ type, imageUrl }` (base64 ou object URL)
3. O ReactFlow wrapper tem `onDragOver` (preventDefault) e `onDrop`
4. No `onDrop`: calcula posição no canvas via `reactFlowInstance.screenToFlowPosition()`, cria novo ImageNode com a imagem, conecta ao prompt-1

### Detalhes técnicos

- Usar `useReactFlow()` hook para `screenToFlowPosition` no drop handler
- A sidebar **não** é um componente do ReactFlow, é HTML normal ao lado
- Imagens geradas ficam apenas em memória (base64) — não persiste em banco
- Toggle da sidebar via botão no header ou ícone lateral
- O `ReactFlowProvider` precisa envolver o componente para `useReactFlow()` funcionar — mover o `<ReactFlow>` para um sub-componente ou adicionar o provider

