-- Fix RLS policies for post_comments table to allow proper comment creation

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view comments on posts in their workspaces" ON post_comments;
DROP POLICY IF EXISTS "Users can create comments on posts in their workspaces" ON post_comments;

-- Create corrected policies that work with the profiles table
CREATE POLICY "Users can view comments on posts in their workspaces" 
ON post_comments 
FOR SELECT 
USING (
  post_id IN (
    SELECT posts.id
    FROM posts
    WHERE posts.workspace_id IN (
      SELECT workspaces.id
      FROM workspaces
      WHERE (
        workspaces.owner_id = auth.uid() 
        OR workspaces.id IN (
          SELECT workspace_members.workspace_id
          FROM workspace_members
          WHERE workspace_members.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Users can create comments on posts in their workspaces" 
ON post_comments 
FOR INSERT 
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  AND
  -- The user_id in the comment must match the user's profile ID
  user_id IN (
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
  AND
  -- The post must be in a workspace the user has access to
  post_id IN (
    SELECT posts.id
    FROM posts
    WHERE posts.workspace_id IN (
      SELECT workspaces.id
      FROM workspaces
      WHERE (
        workspaces.owner_id = auth.uid() 
        OR workspaces.id IN (
          SELECT workspace_members.workspace_id
          FROM workspace_members
          WHERE workspace_members.user_id = auth.uid()
        )
      )
    )
  )
);