-- Create enum types for better data consistency
CREATE TYPE app_role AS ENUM ('admin', 'guest');
CREATE TYPE post_type AS ENUM ('Feed', 'Carrossel', 'Reels', 'Storys');
CREATE TYPE post_status AS ENUM ('Pendente', 'Revisado', 'Reprovado', 'Aprovado', 'Programado', 'Postado');
CREATE TYPE platform_type AS ENUM ('Instagram', 'Facebook', 'LinkedIn', 'YT', 'X', 'Pinterest', 'Reddit');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email TEXT NOT NULL,
  username TEXT,
  role app_role NOT NULL DEFAULT 'guest',
  language TEXT DEFAULT 'en',
  stripe_customer_id TEXT,
  subscription_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  platforms platform_type[] DEFAULT ARRAY['Instagram', 'Facebook', 'LinkedIn']::platform_type[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workspace_members table for managing workspace access
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'guest',
  invited_by UUID REFERENCES public.profiles(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Create posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  caption TEXT,
  post_type post_type NOT NULL,
  platforms platform_type[] NOT NULL,
  status post_status NOT NULL DEFAULT 'Pendente',
  scheduled_date TIMESTAMPTZ,
  media_urls TEXT[],
  additional_comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create comments table for post approval workflow
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invitations table for pending invites
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for workspaces
CREATE POLICY "Users can view workspaces they belong to" ON public.workspaces
  FOR SELECT USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "Workspace owners can update their workspaces" ON public.workspaces
  FOR UPDATE USING (owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create RLS policies for workspace_members
CREATE POLICY "Users can view workspace members for their workspaces" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE 
      owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
      id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Workspace admins can manage members" ON public.workspace_members
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- Create RLS policies for posts
CREATE POLICY "Users can view posts in their workspaces" ON public.posts
  FOR SELECT USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE 
      owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
      id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can create posts in their workspaces" ON public.posts
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE 
      owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
      id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can update posts in their workspaces" ON public.posts
  FOR UPDATE USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE 
      owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
      id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
    )
  );

-- Create RLS policies for post_comments
CREATE POLICY "Users can view comments on posts in their workspaces" ON public.post_comments
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM public.posts WHERE workspace_id IN (
        SELECT id FROM public.workspaces WHERE 
        owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
        id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
      )
    )
  );

CREATE POLICY "Users can create comments on posts in their workspaces" ON public.post_comments
  FOR INSERT WITH CHECK (
    post_id IN (
      SELECT id FROM public.posts WHERE workspace_id IN (
        SELECT id FROM public.workspaces WHERE 
        owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
        id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
      )
    )
  );

-- Create RLS policies for invitations
CREATE POLICY "Users can view invitations they sent" ON public.invitations
  FOR SELECT USING (invited_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create invitations for their workspaces" ON public.invitations
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::app_role
      ELSE 'guest'::app_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for post media
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true);

-- Create storage policies for post media
CREATE POLICY "Anyone can view post media" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-media');

CREATE POLICY "Authenticated users can upload post media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own post media" ON storage.objects
  FOR DELETE USING (bucket_id = 'post-media' AND auth.uid() IS NOT NULL);