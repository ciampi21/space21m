-- Tabela: social_integrations
-- Armazena tokens OAuth e informações dos perfis conectados
CREATE TABLE public.social_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT NOT NULL,
  platform_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  profile_picture_url TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(workspace_id, platform, platform_user_id)
);

CREATE INDEX idx_social_integrations_workspace ON public.social_integrations(workspace_id);
CREATE INDEX idx_social_integrations_active ON public.social_integrations(workspace_id, is_active);

-- Tabela: social_publishing_logs
-- Histórico de publicações automáticas
CREATE TABLE public.social_publishing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.social_integrations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  platform_permalink TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  error_message TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_publishing_logs_post ON public.social_publishing_logs(post_id);
CREATE INDEX idx_publishing_logs_integration ON public.social_publishing_logs(integration_id);
CREATE INDEX idx_publishing_logs_status ON public.social_publishing_logs(status);

-- Tabela: instagram_insights
-- Armazena insights/métricas automáticas do Instagram
CREATE TABLE public.instagram_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.social_integrations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  follower_count INTEGER,
  following_count INTEGER,
  media_count INTEGER,
  impressions INTEGER,
  reach INTEGER,
  profile_views INTEGER,
  website_clicks INTEGER,
  avg_likes NUMERIC(10,2),
  avg_comments NUMERIC(10,2),
  avg_engagement_rate NUMERIC(5,2),
  top_posts JSONB DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_instagram_insights_integration ON public.instagram_insights(integration_id);
CREATE INDEX idx_instagram_insights_workspace ON public.instagram_insights(workspace_id);
CREATE INDEX idx_instagram_insights_fetched ON public.instagram_insights(fetched_at DESC);

-- RLS Policies para social_integrations
ALTER TABLE public.social_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace integrations"
ON public.social_integrations FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can create integrations"
ON public.social_integrations FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage own integrations"
ON public.social_integrations FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Service role can manage integrations"
ON public.social_integrations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policies para social_publishing_logs
ALTER TABLE public.social_publishing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view publishing logs"
ON public.social_publishing_logs FOR SELECT
TO authenticated
USING (
  post_id IN (
    SELECT p.id FROM posts p
    INNER JOIN workspaces w ON p.workspace_id = w.id
    WHERE w.owner_id = auth.uid() OR w.id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Service role can manage logs"
ON public.social_publishing_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policies para instagram_insights
ALTER TABLE public.instagram_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace insights"
ON public.instagram_insights FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
    UNION
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage insights"
ON public.instagram_insights FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_social_integrations_updated_at
BEFORE UPDATE ON public.social_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();