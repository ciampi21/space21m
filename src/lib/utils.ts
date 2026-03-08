import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a URL by adding https:// protocol if missing
 * @param url - The URL to normalize
 * @returns The normalized URL with protocol
 */
export function normalizeMediaUrl(url: string): string {
  if (!url) return url;
  
  // If URL already has a protocol, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Add https:// protocol for relative URLs
  return `https://${url}`;
}

/**
 * Extracts R2 key from various URL patterns
 * @param url - The URL to extract key from
 * @returns The R2 key or null if not found
 */
export function extractR2KeyFromUrl(url: string): string | null {
  if (!url) return null;
  
  const normalizedUrl = normalizeMediaUrl(url);
  
  // Handle custom domain URLs (media.21m.space)
  if (normalizedUrl.includes('media.21m.space/')) {
    const keyMatch = normalizedUrl.match(/media\.21m\.space\/(.+)$/);
    return keyMatch ? keyMatch[1] : null;
  }
  
  // Handle R2.dev URLs
  if (normalizedUrl.includes('.r2.dev/')) {
    const keyMatch = normalizedUrl.match(/\.r2\.dev\/(.+)$/);
    return keyMatch ? keyMatch[1] : null;
  }
  
  return null;
}
