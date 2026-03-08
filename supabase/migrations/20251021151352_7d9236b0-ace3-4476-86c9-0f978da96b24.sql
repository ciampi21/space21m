-- Limpar post travado do Teste 2
UPDATE posts 
SET 
  status = 'Erro',
  additional_comments = 'Upload falhou: Edge function não foi executada. Por favor, tente novamente.',
  updated_at = NOW()
WHERE id = '7d3a4092-db6f-4839-a5a4-113631eb8ff7';