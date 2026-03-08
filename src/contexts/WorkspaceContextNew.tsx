import React, { createContext, useContext, useState, useEffect } from 'react';
import { Workspace, Post, FilterOptions, ViewMode, PlatformType } from '@/types';
import { useAuth } from './AuthContext';
import { 
  useWorkspaces, 
  useWorkspacePosts, 
  useAllPosts,
  useCreatePost,
  useUpdatePost,
  useDeletePost,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace
} from '@/hooks/useWorkspaces';

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  posts: Post[];
  allPosts: Post[]; // All posts from all workspaces the user belongs to
  viewMode: ViewMode['type'];
  filters: FilterOptions;
  loading: boolean;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setViewMode: (mode: ViewMode['type']) => void;
  setFilters: (filters: FilterOptions) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  refreshAllPosts: () => Promise<void>; // Refresh all posts from all workspaces
  createPost: (data: Partial<Post> & { workspace_id: string; title: string; platforms: PlatformType[]; status?: string }) => Promise<{ data: Post | null; error: any }>;
  createWorkspace: (data: Partial<Workspace> & { name: string; collaborators?: string[] }) => Promise<{ data: Workspace | null; error: any }>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<{ error: any }>;
  deleteWorkspace: (id: string) => Promise<{ error: any }>;
}

// Create the context with a default value to avoid undefined issues
const defaultContextValue: WorkspaceContextType = {
  currentWorkspace: null,
  workspaces: [],
  posts: [],
  allPosts: [],
  viewMode: 'grid',
  filters: {},
  loading: true,
  setCurrentWorkspace: () => {},
  setViewMode: () => {},
  setFilters: () => {},
  refreshWorkspaces: async () => {},
  refreshPosts: async () => {},
  refreshAllPosts: async () => {},
  createPost: async () => ({ data: null, error: null }),
  createWorkspace: async () => ({ data: null, error: null }),
  updateWorkspace: async () => ({ error: null }),
  deleteWorkspace: async () => ({ error: null }),
};

const WorkspaceContext = createContext<WorkspaceContextType>(defaultContextValue);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile, user, loading: authLoading } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode['type']>('grid');
  const [filters, setFilters] = useState<FilterOptions>({});

  // Use React Query hooks for data fetching
  const { data: workspaces = [], isLoading: workspacesLoading, refetch: refetchWorkspaces } = useWorkspaces(user?.id);
  const { data: posts = [], isLoading: postsLoading, refetch: refetchPosts } = useWorkspacePosts(currentWorkspace?.id);
  const workspaceIds = workspaces.map(w => w.id);
  const { data: allPosts = [], refetch: refetchAllPosts } = useAllPosts(user?.id, workspaceIds);

  // Use React Query mutations
  const createPostMutation = useCreatePost();
  const updatePostMutation = useUpdatePost();
  const deletePostMutation = useDeletePost();
  const createWorkspaceMutation = useCreateWorkspace();
  const updateWorkspaceMutation = useUpdateWorkspace();
  const deleteWorkspaceMutation = useDeleteWorkspace();

  const loading = authLoading || workspacesLoading || postsLoading;

  // Set first workspace as current if none selected
  useEffect(() => {
    if (!currentWorkspace && workspaces.length > 0) {
      setCurrentWorkspace(workspaces[0]);
    }
  }, [workspaces, currentWorkspace]);

  const refreshWorkspaces = async () => {
    await refetchWorkspaces();
  };

  const refreshPosts = async () => {
    await refetchPosts();
  };

  const refreshAllPosts = async () => {
    await refetchAllPosts();
  };

  const createPost = async (data: Partial<Post> & { workspace_id: string; title: string; platforms: PlatformType[]; status?: string }) => {
    if (!profile?.id) {
      console.error('❌ Context createPost: User not authenticated');
      return { data: null, error: { message: 'User not authenticated' } };
    }

    try {
      const postData = {
        ...data,
        created_by: profile.id,
      };

      const post = await createPostMutation.mutateAsync(postData as any);
      return { data: post, error: null };
    } catch (error) {
      console.error('❌ Context createPost: Exception caught', error);
      return { data: null, error };
    }
  };

  const createWorkspace = async (data: Partial<Workspace> & { name: string; collaborators?: string[] }) => {
    if (!user?.id) {
      return { data: null, error: { message: 'User not authenticated' } };
    }

    try {
      const workspace = await createWorkspaceMutation.mutateAsync(data);
      return { data: workspace, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const updateWorkspace = async (id: string, data: Partial<Workspace>) => {
    try {
      await updateWorkspaceMutation.mutateAsync({ id, data });
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteWorkspace = async (id: string) => {
    try {
      await deleteWorkspaceMutation.mutateAsync(id);
      
      if (currentWorkspace?.id === id) {
        setCurrentWorkspace(null);
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    posts,
    allPosts,
    viewMode,
    filters,
    loading,
    setCurrentWorkspace,
    setViewMode,
    setFilters,
    refreshWorkspaces,
    refreshPosts,
    refreshAllPosts,
    createPost,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  
  if (!context || context === defaultContextValue) {
    console.error('useWorkspace called outside of WorkspaceProvider or with default context');
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  
  return context;
}