-- Remove obsolete/duplicated columns from media_assets table
-- Keeping only the essential columns and removing duplicates

-- Remove file_key (duplicate of r2_key)
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS file_key;

-- Remove file_size (duplicate of size_bytes)  
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS file_size;

-- Remove file_url (can be constructed from r2_key)
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS file_url;

-- Remove file_name (can be extracted from r2_key)
ALTER TABLE public.media_assets DROP COLUMN IF EXISTS file_name;

-- Note: Keeping owner_user_id and file_hash as requested by user