

# Investigação Profunda - Suporte a Múltiplas Imagens

## Análise do Estado Atual

### 1. Edge Function `generate-ai-video`
O edge function atual usa:
- **Endpoint**: `kling-video/v2/master/image-to-video` (uma única imagem)
- **Payload**: `{ image_url: string }` (não array)
- **Lógica**: Aceita apenas `imageUrl` singular

### 2. Frontend `AIVideo.tsx` 
Linha ~229-237: O código coleta múltiplas conexões mas pega apenas `[0]`:
```typescript
const connectedImageEdges = edges.filter(...)
const firstImageNodeId = connectedImageEdges[0].source;
```

### 3. Problemas Identificados

**CRÍTICO 1**: A API FAL.ai Kling v2/master não suporta arrays de imagem
- Endpoint atual: `/image-to-video` = UMA imagem apenas
- Para múltiplas imagens precisaríamos do modelo "Elements" ou "ControlNet"

**CRÍTICO 2**: Estrutura de dados incompatível
- Edge function espera `imageUrl: string`
- Para múltiplas imagens precisaria `imageUrls: string[]`

**CRÍTICO 3**: Polling de status pode quebrar
- URL de status é gerada baseada no endpoint usado
- Mudar o endpoint pode quebrar o `check-video-status`

## Investigação Necessária

### ✅ O que PRECISO confirmar antes de garantir sucesso:

1. **Verificar documentação FAL.ai**: 
   - Qual endpoint suporta múltiplas imagens?
   - Qual o formato exato do payload?
   - As URLs de status são compatíveis?

2. **Testar compatibilidade**: 
   - O modelo Elements mantém mesma qualidade?
   - Suporta mesmos parâmetros (duration, aspectRatio)?
   - Tempo de processamento é similar?

3. **Validar impacto no sistema**:
   - O `check-video-status` funciona com novo endpoint?
   - Database pode armazenar novos campos?
   - Frontend pode processar arrays de imagem?

## ⚠️ RISCOS IDENTIFICADOS

### Alto Risco:
- **API Breaking Change**: Mudar endpoint pode quebrar polling
- **Qualidade**: Modelo diferente pode ter resultados piores  
- **Custos**: Endpoint diferente pode ter preços diferentes

### Médio Risco:
- **Performance**: Múltiplas imagens podem ser mais lentas
- **Limites**: FAL.ai pode ter limite no número de imagens

### Baixo Risco:
- **UI/UX**: Usuários podem ficar confusos com mudança

## CONCLUSÃO ATUAL

**🚨 NÃO POSSO GARANTIR SUCESSO sem investigação adicional**

Preciso:
1. Acessar documentação FAL.ai para confirmar endpoints disponíveis
2. Testar o novo endpoint em ambiente de desenvolvimento  
3. Validar que não há breaking changes no sistema existente

**Recomendação**: Fazer POC (Proof of Concept) primeiro antes de implementação completa.

