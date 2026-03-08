-- Criar trigger para adicionar automaticamente o owner como membro admin do workspace

CREATE OR REPLACE FUNCTION public.add_owner_as_workspace_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, invited_at)
  VALUES (NEW.id, NEW.owner_id, 'admin', NEW.owner_id, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Criar o trigger na tabela workspaces
CREATE TRIGGER add_owner_as_member_trigger
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_workspace_member();