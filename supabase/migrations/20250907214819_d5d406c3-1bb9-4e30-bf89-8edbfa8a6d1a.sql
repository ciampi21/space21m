-- Add new post status for upload processing
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'Uploading';
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'Erro';