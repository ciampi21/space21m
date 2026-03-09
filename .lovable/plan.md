
Vou implementar um sistema de persistência para os vídeos gerados na página AI Video com as seguintes características:

## Análise do Estado Atual
- Atualmente os vídeos gerados são armazenados apenas em memória (React state)
- As imagens são File objects com URL.createObjectURL previews
- URLs de vídeo vêm da fal.ai API mas não são persistidas
- Não há sistema de histórico ou salvamento

## Solução Proposta

### 1. Estrutura do Banco de Dados
Criar tabela `ai_video_generations` com:
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key para profiles)
- `workspace_id` (UUID, foreign key para workspaces)
- `prompt` (text)
- `duration` (text - "5", "10", etc)
- `aspect_ratio` (text - "16:9", "9:16", etc)
- `video_url` (text - URL do R2)
- `thumbnail_url` (text - URL da thumbnail no R2)
- `source_images` (jsonb - array de URLs das imagens usadas)
- `fal_request_id` (text - para tracking)
- `status` (enum: generating, completed, error)
- `is_permanent` (boolean, default false)
- `expires_at` (timestamp - now() + 180 days, NULL se permanent)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 2. Sistema de Armazenamento R2
- Salvar vídeos gerados no R2 bucket existente (21m-media)
- Salvar imagens de origem no R2
- Gerar thumbnails dos vídeos para preview
- Estrutura de pastas: `workspaces/{workspace_id}/ai-video/{generation_id}/`

### 3. Edge Functions Necessárias
- `save-ai-video-generation` - salvar geração no banco + R2
- `get-ai-video-generations` - listar gerações do usuário
- `make-ai-video-permanent` - marcar como permanente
- `cleanup-expired-ai-videos` - cron job para limpeza

### 4. Modificações na Interface

#### Componentes Novos:
- `VideoHistorySidebar` - histórico de gerações
- `VideoGenerationCard` - card com preview, data, ações
- `PermanentSaveButton` - botão discreto para salvar permanente

#### Modificações Existentes:
- `AIVideo.tsx` - integrar com persistência
- `VideoNode.tsx` - adicionar opções de salvamento
- `AssetSidebar.tsx` - incluir histórico de vídeos

### 5. Fluxo de Uso
1. **Geração**: Quando vídeo é gerado com sucesso, automaticamente salvo por 180 dias
2. **Visualização**: Sidebar mostra histórico com previews e datas de expiração
3. **Salvamento Permanente**: Botão discreto "🔒 Salvar para sempre" 
4. **Organização**: Filtros por data, status, workspace
5. **Limpeza**: Cron job diário remove vídeos expirados

### 6. Integração com Limites de Plano
- Usuários free: máximo 10 gerações salvas simultaneamente
- Usuários premium: máximo 100 gerações salvas
- Contagem apenas para não-permanentes (permanentes não contam no limite)

### 7. Interface de Histórico
```
┌─ Sidebar ─────────────────────┐
│ 📽️ Vídeos Gerados            │
│                               │
│ ┌───────────────────────────┐ │
│ │ [Thumbnail] [05s] 16:9    │ │
│ │ "Gato dançando..."        │ │
│ │ 2 dias • Expira em 178d   │ │
│ │ [▶️] [⬇️] [🔒]              │ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ [Thumbnail] [10s] 9:16    │ │
│ │ "Paisagem montanhas..."   │ │
│ │ 5 dias • Permanente 🔒    │ │
│ │ [▶️] [⬇️] [🗑️]              │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

### 8. Recursos de UX
- **Auto-save**: Gerações salvas automaticamente após completar
- **Preview em hover**: Thumbnail animado no histórico
- **Indicador de expiração**: Countdown visual para TTL
- **Confirmação de permanente**: Modal simples "Salvar permanentemente?"
- **Toast notifications**: Feedback para ações de salvamento

### 9. Segurança e Performance
- RLS policies para acesso apenas aos próprios vídeos
- Lazy loading do histórico (paginado)
- Compression automática dos vídeos no R2
- Cleanup job para arquivos órfãos

### 10. Implementação Faseada
1. **Fase 1**: Tabela + edge functions básicas
2. **Fase 2**: Integração com interface de geração
3. **Fase 3**: Sidebar de histórico + salvamento permanente
4. **Fase 4**: Cron jobs + otimizações

Essa solução oferece persistência automática por 180 dias com opção de salvamento permanente através de um botão discreto, mantendo a experiência atual mas adicionando valor significativo ao produto.
