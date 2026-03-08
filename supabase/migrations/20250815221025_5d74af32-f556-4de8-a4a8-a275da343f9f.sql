-- Update existing posts with old R2 URLs to use the working URL format
UPDATE posts 
SET media_urls = array(
  SELECT REPLACE(url, 'https://pub-post-media.r2.dev/', 'https://post-media.r2.cloudflarestorage.com/')
  FROM unnest(media_urls) AS url
)
WHERE media_urls IS NOT NULL 
  AND array_to_string(media_urls, '') LIKE '%pub-post-media.r2.dev%';