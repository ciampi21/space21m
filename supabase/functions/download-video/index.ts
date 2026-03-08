import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Download request for URL:', url);

    // Check if it's a YouTube URL
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    
    if (!isYouTube) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Apenas YouTube é suportado no momento. TikTok e Instagram em breve!' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract video ID
    const videoId = extractYouTubeVideoId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Não foi possível extrair o ID do vídeo. Verifique a URL.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted video ID:', videoId);

    // Get RapidAPI key
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'API não configurada. Contate o administrador.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call RapidAPI YouTube MP3 converter
    const apiUrl = `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`;
    
    console.log('Calling RapidAPI:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.error('RapidAPI error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Erro na API: ${response.status}. Tente novamente mais tarde.` 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('RapidAPI response:', JSON.stringify(data));

    // Check if conversion was successful
    if (data.status === 'ok' && data.link) {
      return new Response(
        JSON.stringify({
          success: true,
          downloadUrl: data.link,
          filename: `${data.title || 'audio'}.mp3`,
          info: {
            title: data.title,
            duration: data.duration,
            filesize: data.filesize
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (data.status === 'processing') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Conversão em andamento. Tente novamente em alguns segundos.',
          retry: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('Conversion failed:', data);
      return new Response(
        JSON.stringify({
          success: false,
          error: data.msg || 'Erro ao converter o vídeo. Verifique se o vídeo está disponível.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in download-video:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro ao processar requisição' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
