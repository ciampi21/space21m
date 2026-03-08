

## Diagnóstico: Página `/ai-video` em branco

### Causa provável

O ReactFlow exige que seu container pai tenha **dimensões explícitas definidas** (width/height). O wrapper atual usa `flex-1 relative` que pode não estar propagando a altura corretamente em todos os navegadores. Além disso, em `@xyflow/react` v12, a tipagem de `NodeProps` mudou - os custom nodes podem estar falhando silenciosamente ao acessar `data`.

### Correções

1. **Container do ReactFlow** (`AIVideo.tsx`): Adicionar `width: 100%` e `height: 100%` explícitos no wrapper do ReactFlow, e garantir que o CSS do xyflow está sendo carregado corretamente.

2. **Tipagem dos Custom Nodes** (`ImageNode.tsx`, `PromptNode.tsx`, `VideoNode.tsx`): Em `@xyflow/react` v12, `NodeProps` não aceita `& { data: T }` diretamente. Precisa usar o genérico correto ou acessar `data` via `props` sem type intersection.

3. **Mover `initialNodes`/`initialEdges` para fora do render** ou envolver em `useMemo` para evitar recriação desnecessária a cada render.

### Arquivos a editar

- `src/pages/AIVideo.tsx` - Corrigir container e estabilizar inicialização dos nodes
- `src/components/ai-video/canvas/ImageNode.tsx` - Corrigir tipagem de props
- `src/components/ai-video/canvas/PromptNode.tsx` - Corrigir tipagem de props
- `src/components/ai-video/canvas/VideoNode.tsx` - Corrigir tipagem de props

