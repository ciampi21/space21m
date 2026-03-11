

# Diagnóstico: Erro na geração de vídeo

## Causa raiz

O erro **não é um bug de código**. Os logs da edge function `generate-ai-video` mostram claramente:

```
FAL.ai error: 403 {"detail": "User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."}
```

**Seu saldo na FAL.ai acabou.** A API está retornando 403 e bloqueando novas gerações.

## Ação necessária

1. Acesse [fal.ai/dashboard/billing](https://fal.ai/dashboard/billing) e adicione créditos à sua conta.

## Melhoria recomendada (código)

Atualmente, o erro exibido no node é genérico ("Edge Function returned a non-2xx status code"). Podemos melhorar o tratamento de erro para mostrar mensagens mais claras ao usuário:

- Na `startGeneration` em `AIVideo.tsx`, o erro da FAL.ai já é retornado como `data.error`, mas quando o status HTTP é 403, o Supabase client lança um erro genérico antes de chegar ao `data`.
- **Solução**: Na edge function `generate-ai-video/index.ts`, quando a FAL.ai retorna 403 com "Exhausted balance", retornar **status 200** com um campo `error` amigável em português, para que o frontend consiga ler a mensagem corretamente em vez de receber um erro genérico do Supabase client.

### Mudança na edge function (`generate-ai-video/index.ts`):

Na seção que trata o erro da FAL.ai (quando `!response.ok`), alterar para sempre retornar status 200 com o erro no body, em vez de repassar o status HTTP da FAL.ai. Isso permite que o `supabase.functions.invoke()` no frontend receba o `data.error` corretamente.

Também traduzir a mensagem "Exhausted balance" para algo amigável como "Saldo FAL.ai esgotado. Recarregue em fal.ai/dashboard/billing."

