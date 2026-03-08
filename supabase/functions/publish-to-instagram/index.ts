import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishRequest {
  post_id: string;
  workspace_id: string;
}

interface InstagramAccount {
  id: string;
  instagram_business_account_id: string;
  page_access_token: string;
  username: string;
  can_publish: boolean;
}

interface Post {
  id: string;
  title: string;
  caption: string | null;
  media_urls: string[] | null;
  post_type: string;
  platforms: string[];
}

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Poll for media container status
async function waitForMediaReady(containerId: string, accessToken: string, maxAttempts = 30): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusUrl = new URL(`${GRAPH_API_BASE}/${containerId}`);
    statusUrl.searchParams.append('fields', 'status_code');
    statusUrl.searchParams.append('access_token', accessToken);

    const response = await fetch(statusUrl);
    const data = await response.json();

    console.log(`Container ${containerId} status check ${attempt + 1}:`, data.status_code);

    if (data.status_code === 'FINISHED') {
      return true;
    }

    if (data.status_code === 'ERROR') {
      throw new Error(`Media container failed: ${JSON.stringify(data)}`);
    }

    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Media container processing timeout');
}

// Create a single image container
async function createImageContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption?: string,
  isCarouselItem = false
): Promise<string> {
  const containerUrl = new URL(`${GRAPH_API_BASE}/${igUserId}/media`);
  
  const params: Record<string, string> = {
    image_url: imageUrl,
    access_token: accessToken,
  };

  if (isCarouselItem) {
    params.is_carousel_item = 'true';
  } else if (caption) {
    params.caption = caption;
  }

  const response = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    console.error('Failed to create image container:', data);
    throw new Error(`Failed to create image container: ${data.error?.message || 'Unknown error'}`);
  }

  console.log('Image container created:', data.id);
  return data.id;
}

// Create a video/reel container
async function createVideoContainer(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption?: string,
  mediaType: 'REELS' | 'VIDEO' = 'REELS',
  isCarouselItem = false
): Promise<string> {
  const containerUrl = new URL(`${GRAPH_API_BASE}/${igUserId}/media`);
  
  const params: Record<string, string> = {
    video_url: videoUrl,
    media_type: mediaType,
    access_token: accessToken,
  };

  if (isCarouselItem) {
    params.is_carousel_item = 'true';
  } else if (caption) {
    params.caption = caption;
  }

  const response = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    console.error('Failed to create video container:', data);
    throw new Error(`Failed to create video container: ${data.error?.message || 'Unknown error'}`);
  }

  console.log('Video container created:', data.id);
  return data.id;
}

// Create a carousel container
async function createCarouselContainer(
  igUserId: string,
  accessToken: string,
  childContainerIds: string[],
  caption?: string
): Promise<string> {
  const containerUrl = new URL(`${GRAPH_API_BASE}/${igUserId}/media`);
  
  const params: Record<string, string> = {
    media_type: 'CAROUSEL',
    children: childContainerIds.join(','),
    access_token: accessToken,
  };

  if (caption) {
    params.caption = caption;
  }

  const response = await fetch(containerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    console.error('Failed to create carousel container:', data);
    throw new Error(`Failed to create carousel container: ${data.error?.message || 'Unknown error'}`);
  }

  console.log('Carousel container created:', data.id);
  return data.id;
}

// Publish a container
async function publishContainer(
  igUserId: string,
  accessToken: string,
  containerId: string
): Promise<string> {
  const publishUrl = new URL(`${GRAPH_API_BASE}/${igUserId}/media_publish`);
  
  const params = {
    creation_id: containerId,
    access_token: accessToken,
  };

  const response = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    console.error('Failed to publish container:', data);
    throw new Error(`Failed to publish: ${data.error?.message || 'Unknown error'}`);
  }

  console.log('Published successfully, media ID:', data.id);
  return data.id;
}

// Determine if URL is video or image
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.webm'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { post_id, workspace_id }: PublishRequest = await req.json();

    if (!post_id || !workspace_id) {
      throw new Error('post_id and workspace_id are required');
    }

    console.log(`Publishing post ${post_id} to Instagram for workspace ${workspace_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get Instagram account for workspace
    const { data: igAccount, error: igError } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_business_account_id, page_access_token, username, can_publish')
      .eq('workspace_id', workspace_id)
      .eq('can_publish', true)
      .single();

    if (igError || !igAccount) {
      console.error('Instagram account not found or cannot publish:', igError);
      throw new Error('No Instagram account with publishing permissions found');
    }

    const account = igAccount as InstagramAccount;

    if (!account.instagram_business_account_id || !account.page_access_token) {
      throw new Error('Instagram account missing required credentials for publishing');
    }

    console.log(`Using Instagram account: @${account.username}`);

    // Get post details
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, title, caption, media_urls, post_type, platforms')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      console.error('Post not found:', postError);
      throw new Error('Post not found');
    }

    const postData = post as Post;

    if (!postData.media_urls || postData.media_urls.length === 0) {
      throw new Error('Post has no media to publish');
    }

    const caption = postData.caption || postData.title;
    const igUserId = account.instagram_business_account_id;
    const accessToken = account.page_access_token;

    let publishedMediaId: string;

    // Handle different post types
    if (postData.post_type === 'Carrossel' && postData.media_urls.length > 1) {
      // Carousel post
      console.log(`Creating carousel with ${postData.media_urls.length} items`);

      const childContainerIds: string[] = [];

      for (const mediaUrl of postData.media_urls) {
        let containerId: string;

        if (isVideoUrl(mediaUrl)) {
          containerId = await createVideoContainer(igUserId, accessToken, mediaUrl, undefined, 'REELS', true);
          await waitForMediaReady(containerId, accessToken);
        } else {
          containerId = await createImageContainer(igUserId, accessToken, mediaUrl, undefined, true);
        }

        childContainerIds.push(containerId);
      }

      const carouselContainerId = await createCarouselContainer(igUserId, accessToken, childContainerIds, caption);
      publishedMediaId = await publishContainer(igUserId, accessToken, carouselContainerId);

    } else if (postData.post_type === 'Reels' || isVideoUrl(postData.media_urls[0])) {
      // Reels/Video post
      console.log('Creating Reels post');

      const containerId = await createVideoContainer(igUserId, accessToken, postData.media_urls[0], caption, 'REELS');
      await waitForMediaReady(containerId, accessToken);
      publishedMediaId = await publishContainer(igUserId, accessToken, containerId);

    } else {
      // Single image post (Feed)
      console.log('Creating single image post');

      const containerId = await createImageContainer(igUserId, accessToken, postData.media_urls[0], caption);
      publishedMediaId = await publishContainer(igUserId, accessToken, containerId);
    }

    // Update post status
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        status: 'Postado',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', post_id);

    if (updateError) {
      console.error('Failed to update post status:', updateError);
    }

    // Log the publishing event
    await supabase.from('social_publishing_logs').insert({
      post_id: post_id,
      integration_id: account.id,
      platform: 'instagram',
      status: 'success',
      platform_post_id: publishedMediaId,
      published_at: new Date().toISOString(),
      metadata: {
        username: account.username,
        post_type: postData.post_type,
        media_count: postData.media_urls.length,
      },
    });

    console.log(`Successfully published post ${post_id} to Instagram as ${publishedMediaId}`);

    return new Response(
      JSON.stringify({
        success: true,
        instagram_media_id: publishedMediaId,
        username: account.username,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error publishing to Instagram:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
