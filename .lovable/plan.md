

## Trocar paleta roxa por azul na página /ai-video

A imagem de referência usa tons de azul (`blue-600` / `#3B82F6` / `hsl(217, 91%, 60%)`). Atualmente, vários elementos usam `violet/fuchsia`. A correção é substituir todos por variações de azul.

### Arquivos e mudanças

**1. `src/pages/AIVideo.tsx`**
- Header icon: `from-violet-500 to-fuchsia-500` → `from-blue-600 to-blue-500`
- Edge strokes `hsl(262, 83%, 58%)` → `hsl(217, 91%, 60%)` (mesmo azul já usado nas edges de imagem)
- MiniMap promptNode color: `hsl(262, 83%, 58%)` → `hsl(217, 71%, 50%)`

**2. `src/components/ai-video/AssetSidebar.tsx`**
- Botão "Gerar Imagem": `from-violet-500 to-fuchsia-500` → `from-blue-600 to-blue-500` (e hover states)

**3. `src/components/ai-video/canvas/PromptNode.tsx`**
- Header gradient: `from-violet-500/10 to-fuchsia-500/10` → `from-blue-500/10 to-blue-400/10`
- Icon gradient: `from-violet-500 to-fuchsia-500` → `from-blue-600 to-blue-500`

**4. `src/components/ai-video/canvas/VideoNode.tsx`**
- Status "generating": `violet-500` → `blue-500` (border, badge, spinner, icon)
- Botão gerar: `from-violet-600 to-fuchsia-600` → `from-blue-600 to-blue-500` (e hover)

**5. `src/components/ai-video/VideoSlot.tsx`**
- Status "generating": `violet-500` → `blue-500` (border, bg, spinner, icon)
- Botão gerar: `from-violet-600 to-fuchsia-600` → `from-blue-600 to-blue-500` (e hover)

Todas as mudanças são puramente cosméticas, limitadas à rota `/ai-video` e seus componentes.

