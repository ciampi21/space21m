export type AppRole = 'admin' | 'user';

export type WorkspaceRole = 'owner' | 'guest';

export type PostType = 'Feed' | 'Carrossel' | 'Reels' | 'Storys';

export type PostStatus = 'Rascunho' | 'Pendente' | 'Revisado' | 'Reprovado' | 'Aprovado' | 'Programado' | 'Postado' | 'Uploading' | 'Erro';

export type PlatformType = 'Instagram' | 'Facebook' | 'LinkedIn' | 'YT' | 'X' | 'Pinterest' | 'Reddit';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  username?: string;
  role: AppRole;
  language: string;
  date_format?: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  currency?: string;
  stripe_customer_id?: string;
  subscription_active: boolean;
  plan_tier?: string;
  is_early_adopter?: boolean;
  subscription_status?: string;
  billing_banner?: string;
  past_due_since?: string;
  grace_until?: string;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  owner_id: string;
  platforms: PlatformType[];
  metrics_visibility?: 'owner_only' | 'all' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  workspace_role: WorkspaceRole;
  invited_by?: string;
  invited_at?: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  caption?: string;
  post_type: PostType;
  platforms: PlatformType[];
  status: PostStatus;
  scheduled_for?: string;
  published_at?: string;
  expire_at?: string;
  media_urls?: string[];
  additional_comments?: string;
  thumbnail_urls?: string[];
  upload_progress?: {
    total: number;
    completed: number;
    files: Array<{
      name: string;
      percentage: number;
      status: 'pending' | 'uploading' | 'completed' | 'error';
      uploadSpeed?: number;
      estimatedTimeRemaining?: string;
    }>;
  };
  created_at: string;
  updated_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  workspace_id: string;
  email: string;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface ViewMode {
  type: 'grid' | 'calendar';
}

export interface FilterOptions {
  status?: PostStatus[];
  type?: PostType[];
  platform?: PlatformType[];
}

export const POST_STATUSES: Record<PostStatus, { label: string; color: string }> = {
  'Rascunho': { label: 'Draft', color: 'draft' },
  'Pendente': { label: 'Pending', color: 'pending' },
  'Revisado': { label: 'Reviewed', color: 'reviewed' },
  'Reprovado': { label: 'Rejected', color: 'rejected' },
  'Aprovado': { label: 'Approved', color: 'approved' },
  'Programado': { label: 'Scheduled', color: 'scheduled' },
  'Postado': { label: 'Posted', color: 'posted' },
  'Uploading': { label: 'Processing', color: 'pending' },
  'Erro': { label: 'Error', color: 'rejected' }
};

export const POST_TYPES: Record<PostType, { label: string; initial: string }> = {
  'Feed': { label: 'Feed', initial: 'F' },
  'Carrossel': { label: 'Carousel', initial: 'C' },
  'Reels': { label: 'Reels', initial: 'R' },
  'Storys': { label: 'Stories', initial: 'S' }
};

export const PLATFORMS: Record<PlatformType, { label: string; color: string; icon: string }> = {
  'Instagram': { label: 'Instagram', color: 'instagram', icon: '📷' },
  'Facebook': { label: 'Facebook', color: 'facebook', icon: '📘' },
  'LinkedIn': { label: 'LinkedIn', color: 'linkedin', icon: '💼' },
  'YT': { label: 'YouTube', color: 'youtube', icon: '📹' },
  'X': { label: 'X (Twitter)', color: 'twitter', icon: '🐦' },
  'Pinterest': { label: 'Pinterest', color: 'pinterest', icon: '📌' },
  'Reddit': { label: 'Reddit', color: 'reddit', icon: '🔴' }
};

export const LANGUAGES = {
  en: { label: 'English', flag: '🇺🇸' },
  pt: { label: 'Português', flag: '🇧🇷' },
  es: { label: 'Español', flag: '🇪🇸' }
} as const;

export type Language = keyof typeof LANGUAGES;