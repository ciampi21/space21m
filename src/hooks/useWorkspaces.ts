import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Workspace, Post, PlatformType } from '@/types';
import { toast } from 'sonner';

// Query keys
export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  detail: (id: string) => [...workspaceKeys.all, 'detail', id] as const,
  posts: (id: string) => [...workspaceKeys.all, id, 'posts'] as const,
  allPosts: () => [...workspaceKeys.all, 'allPosts'] as const,
};

// Hook to list user's workspaces
export const useWorkspaces = (userId: string | undefined) => {
  return useQuery({
    queryKey: workspaceKeys.lists(),
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');

      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Workspace[];
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook to fetch posts from a specific workspace
export const useWorkspacePosts = (workspaceId: string | undefined) => {
  return useQuery({
    queryKey: workspaceKeys.posts(workspaceId || ''),
    queryFn: async () => {
      if (!workspaceId) throw new Error('No workspace ID');

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📦 useWorkspacePosts: Fetched posts', { 
        count: data.length,
        samplePost: data[0] ? {
          id: data[0].id,
          hasThumbnailUrls: !!data[0].thumbnail_urls,
          hasMediaUrls: !!data[0].media_urls
        } : null
      });
      
      return data.map(post => ({
        ...post,
        upload_progress: post.upload_progress ? post.upload_progress as any : undefined
      })) as Post[];
    },
    enabled: !!workspaceId,
    staleTime: 1000, // 1 second for faster updates during uploads
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: (query) => {
      // Auto-refresh every 2 seconds if there are posts in "Uploading" status
      const hasUploading = query.state.data?.some(p => p.status === 'Uploading');
      return hasUploading ? 2000 : false;
    }
  });
};

// Hook to fetch all posts from all user's workspaces
export const useAllPosts = (userId: string | undefined, workspaceIds: string[]) => {
  return useQuery({
    queryKey: workspaceKeys.allPosts(),
    queryFn: async () => {
      if (!userId || workspaceIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('workspace_id', workspaceIds)
        .order('created_at', { ascending: false });

      return data.map(post => ({
        ...post,
        upload_progress: post.upload_progress ? post.upload_progress as any : undefined
      })) as Post[];
    },
    enabled: !!userId && workspaceIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to create post with automatic invalidation
export const useCreatePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postData: Partial<Post> & { workspace_id: string; title: string; platforms: PlatformType[]; created_by: string }) => {
      console.log('📝 useCreatePost: Starting with data', postData);

      const dataToInsert = {
        workspace_id: postData.workspace_id,
        created_by: postData.created_by,
        title: postData.title,
        caption: postData.caption || '',
        post_type: postData.post_type || 'Feed',
        platforms: postData.platforms,
        status: (postData.status || 'Pendente') as any,
        scheduled_for: postData.scheduled_for,
        media_urls: postData.media_urls,
        thumbnail_urls: postData.thumbnail_urls,
        additional_comments: postData.additional_comments || ''
      };

      console.log('💾 useCreatePost: Inserting to database', dataToInsert);

      const { data, error } = await supabase
        .from('posts')
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        console.error('❌ useCreatePost: Database error', error);
        throw error;
      }

      console.log('✅ useCreatePost: Success', data);
      return {
        ...data,
        upload_progress: data.upload_progress ? data.upload_progress as any : undefined
      } as Post;
    },
    onSuccess: (newPost) => {
      // Invalidate posts from the affected workspace
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.posts(newPost.workspace_id) 
      });
      // Invalidate all posts list
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.allPosts() 
      });
    },
    onError: (error) => {
      toast.error('Failed to create post');
      console.error('❌ useCreatePost: Error', error);
    },
  });
};

// Hook to update post
export const useUpdatePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Post> }) => {
      const { data: post, error } = await supabase
        .from('posts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...post,
        upload_progress: post.upload_progress ? post.upload_progress as any : undefined
      } as Post;
    },
    onSuccess: (updatedPost) => {
      // Invalidate posts from the affected workspace
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.posts(updatedPost.workspace_id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.allPosts() 
      });
    },
    onError: (error) => {
      toast.error('Failed to update post');
      console.error(error);
    },
  });
};

// Hook to delete post
export const useDeletePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const { error } = await supabase.functions.invoke('delete-post-safe', {
        body: { postId: id }
      });

      if (error) throw error;
      return { id, workspaceId };
    },
    onSuccess: ({ workspaceId }) => {
      // Invalidate posts from the affected workspace
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.posts(workspaceId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.allPosts() 
      });
    },
    onError: (error) => {
      toast.error('Failed to delete post');
      console.error(error);
    },
  });
};

// Hook to create workspace
export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Workspace> & { name: string; collaborators?: string[] }) => {
      const { data: workspace, error } = await supabase.functions.invoke('create-workspace', {
        body: {
          name: data.name,
          description: data.description,
          image_url: data.image_url,
          platforms: data.platforms || ['Instagram', 'Facebook', 'LinkedIn'],
          collaborators: data.collaborators || []
        }
      });

      if (error) throw error;
      return workspace.data as Workspace;
    },
    onSuccess: () => {
      // Invalidate workspaces list
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.lists() 
      });
    },
    onError: (error) => {
      toast.error('Failed to create workspace');
      console.error(error);
    },
  });
};

// Hook to update workspace
export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Workspace> }) => {
      const { error } = await supabase
        .from('workspaces')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      return { id, data };
    },
    onSuccess: () => {
      // Invalidate workspaces list
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.lists() 
      });
    },
    onError: (error) => {
      toast.error('Failed to update workspace');
      console.error(error);
    },
  });
};

// Hook to delete workspace
export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      console.log('🔥 useDeleteWorkspace: Starting deletion for:', id);
      
      const { data, error } = await supabase.functions.invoke('delete-workspace-complete', {
        body: { workspaceId: id }
      });

      console.log('🔥 useDeleteWorkspace: Response:', { data, error });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.message || 'Failed to delete workspace');
      }

      return id;
    },
    onSuccess: () => {
      // Invalidate workspaces list and all posts
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.lists() 
      });
      queryClient.invalidateQueries({ 
        queryKey: workspaceKeys.allPosts() 
      });
      console.log('🔥 useDeleteWorkspace: Deletion successful');
    },
    onError: (error) => {
      toast.error('Failed to delete workspace');
      console.error('🔥 useDeleteWorkspace: Error', error);
    },
  });
};
