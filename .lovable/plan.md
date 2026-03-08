

## Diagnóstico Real (confirmado via browser)

Naveguei até `/ai-video` no browser e confirmei a tela branca. O console revela a **causa raiz real**:

```
[network] Failed to load resource: the server responded with a status of 504 ()
(@xyflow_react.js?v=d0d64865)
```

O pacote `@xyflow/react` **não está sendo carregado** — retorna um erro 504 (timeout) do servidor de desenvolvimento Vite. Sem essa dependência, o componente `ReactFlow` não existe, e a página inteira fica em branco.

**O plano anterior (ajustar CSS do container) NÃO corrigiria o problema.** A causa não é CSS nem tipagem — é que a dependência simplesmente não carrega.

---

## Plano de Correção

### 1. Forçar pre-bundling do `@xyflow/react` no Vite

**Arquivo: `vite.config.ts`**

Adicionar `optimizeDeps.include` com `@xyflow/react` para que o Vite faça o pre-bundling explicitamente, evitando o timeout 504:

```ts
optimizeDeps: {
  include: ['@xyflow/react'],
},
```

### 2. Adicionar fallback de carregamento na página

**Arquivo: `src/pages/AIVideo.tsx`**

Usar `React.lazy` + `Suspense` para importar o ReactFlow, com um loading state visível caso a dependência demore. Isso evita a tela completamente branca mesmo se houver atraso no carregamento.

### Por que tenho certeza

- O erro 504 no console é **inequívoco** — a biblioteca não está carregando
- `optimizeDeps.include` é a solução documentada do Vite para dependências pesadas que falham no pre-bundling
- O fallback com Suspense é uma camada de segurança adicional, não a correção principal
- Nenhuma dessas mudanças afeta outros componentes ou páginas

