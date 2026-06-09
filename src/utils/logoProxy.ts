export function proxyLogo(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/")) return url;
  return `/api/logo-proxy?url=${encodeURIComponent(url)}`;
}
