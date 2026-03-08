-- Migration: add_upload_progress_to_posts
-- Add column to track real-time upload progress for posts

ALTER TABLE posts 
ADD COLUMN upload_progress JSONB DEFAULT NULL;

COMMENT ON COLUMN posts.upload_progress IS 
'Stores real-time upload progress in format:
{
  "total": 5,
  "completed": 2,
  "files": [
    {"name": "video.mp4", "percentage": 75, "status": "uploading", "uploadSpeed": 1024},
    {"name": "thumbnail.jpg", "percentage": 100, "status": "completed"}
  ]
}
This field is populated during uploads and cleared when upload completes.';