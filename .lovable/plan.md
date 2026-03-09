

## Problema

O `ImageNode` só trata drops de **arquivos nativos** (`e.dataTransfer.files`), mas o sidebar envia dados via `application/json` com `{ type: "sidebar-image", url }`. Além disso, o ReactFlow intercepta eventos de drag nos nodes, impedindo que o drop chegue ao elemento interno.

## Solução

Atualizar o `onDrop` do `ImageNode` para também processar o payload JSON do sidebar (converter a URL em File via fetch/blob), além de arquivos nativos. Mover os handlers `onDragOver`/`onDrop` para o container raiz do node (não apenas a zona vazia) para funcionar mesmo quando já há imagem.

### Alterações em `ImageNode.tsx`:

1. **Expandir `onDrop`** para checar `application/json` primeiro — se tiver payload do sidebar, fazer fetch da URL, criar File e chamar `handleFile`
2. **Mover `onDragOver`/`onDrop`** para o `div` raiz do node, para funcionar tanto com imagem já carregada quanto sem
3. Adicionar estado visual de drag-over (highlight na borda)

