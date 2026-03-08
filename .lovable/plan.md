
## Mudar Fundo da Página /tools

### O que a imagem 2 mostra

A imagem 2 é o Dashboard, com o fundo azul-lavanda claro (`hsl(230, 100%, 94%)`) — já definido no design system como `--background-outer`. Não é um azul escuro, é o mesmo tom suave que aparece no fundo do dashboard.

### O que será alterado

Apenas o arquivo `src/pages/Tools.tsx`, linha 120.

**Fundo da página:**
- De: `bg-background` (branco)
- Para: `bg-background-outer` (azul-lavanda claro do dashboard, `hsl(230, 100%, 94%)`)

### Arquivo a modificar

- `src/pages/Tools.tsx` — somente a classe do `<div>` raiz na linha 120

### Resultado esperado

A página `/tools` ficará com o mesmo tom de fundo azul-lavanda claro do dashboard, mantendo toda a legibilidade e contraste dos cards brancos, sem precisar alterar nenhum texto ou ícone.
