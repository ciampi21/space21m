-- Update media_assets table to add missing columns for R2 integration
ALTER TABLE public.media_assets 
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS file_key TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Copy size_bytes to file_size for consistency
UPDATE public.media_assets SET file_size = size_bytes WHERE file_size IS NULL;

-- Copy r2_key to file_key for consistency  
UPDATE public.media_assets SET file_key = r2_key WHERE file_key IS NULL;

-- Copy owner_user_id to uploaded_by for consistency
UPDATE public.media_assets SET uploaded_by = owner_user_id WHERE uploaded_by IS NULL;