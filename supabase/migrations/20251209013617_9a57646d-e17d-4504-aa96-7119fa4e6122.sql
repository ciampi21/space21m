-- Add new columns to instagram_accounts for Graph API publishing support
ALTER TABLE public.instagram_accounts 
ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS page_id TEXT,
ADD COLUMN IF NOT EXISTS page_access_token TEXT,
ADD COLUMN IF NOT EXISTS can_publish BOOLEAN DEFAULT false;

-- Add comment explaining the fields
COMMENT ON COLUMN public.instagram_accounts.instagram_business_account_id IS 'Instagram Business/Creator Account ID from Graph API';
COMMENT ON COLUMN public.instagram_accounts.page_id IS 'Facebook Page ID connected to the Instagram account';
COMMENT ON COLUMN public.instagram_accounts.page_access_token IS 'Long-lived Page Access Token for publishing';
COMMENT ON COLUMN public.instagram_accounts.can_publish IS 'Whether this account has publishing permissions';