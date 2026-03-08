-- Recreate the missing trigger for post media cleanup
DROP TRIGGER IF EXISTS trigger_cleanup_post_media ON public.posts;

CREATE TRIGGER trigger_cleanup_post_media
  AFTER DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_post_media_assets();