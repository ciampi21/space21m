-- Fix inconsistent expire_at values for workspaces with Auto Cleanup disabled
-- This sets expire_at to NULL for all posts in workspaces where autodelete_days is NULL

UPDATE posts 
SET expire_at = NULL, updated_at = NOW()
WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE autodelete_days IS NULL
) 
AND expire_at IS NOT NULL;