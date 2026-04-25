/**
 * Get the base URL for the application
 * In production on Vercel, uses VERCEL_URL
 * In development, uses localhost:3000
 * Can be overridden with NEXT_PUBLIC_APP_URL env var
 */
export function getBaseUrl(): string {
  // Use explicit env var if set
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      // Vercel automatically provides VERCEL_URL without protocol
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'http://localhost:3000';
    }
  }
  
  // Ensure baseUrl has protocol
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  return baseUrl;
}
