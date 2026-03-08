

## Diagnóstico

Erro: `Cannot access 'enhancePrompt' before initialization` (linha 163 do AIVideo.tsx).

O `useMemo` (linha ~135) referencia `enhancePrompt` (linha 183) e `startGeneration` (linha 210), que são definidos **depois** do `useMemo`. Em JavaScript, `const` não permite acesso antes da declaração (temporal dead zone).

## Correção

**Arquivo: `src/pages/AIVideo.tsx`**

Mover as funções `enhancePrompt` e `startGeneration` (e `imageToBase64` e `pollStatus` que são dependências) para **antes** do `useMemo` `nodesWithData`. Ou seja, reordenar o código para que as declarações fiquem nesta ordem:

1. States (`useState`)
2. `handleImageChange` (já está antes)
3. `initialNodes` / `initialEdges`
4. `useNodesState` / `useEdgesState`
5. `onConnect`
6. **`enhancePrompt`** (mover para cima)
7. **`imageToBase64`** (mover para cima)
8. **`pollStatus`** (mover para cima)
9. **`startGeneration`** (mover para cima)
10. `nodesWithData` (`useMemo`) — agora pode referenciar tudo acima
11. `addImageNode`, `addVideoNode`, `handleBack`
12. `return`

Nenhuma lógica muda — apenas a **ordem** das declarações no componente.

