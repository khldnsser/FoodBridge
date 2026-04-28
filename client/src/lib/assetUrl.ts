const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  if (typeof window === 'undefined') return url;

  try {
    const parsed = new URL(url, window.location.origin);
    const isRemoteClient = !LOOPBACK_HOSTS.has(window.location.hostname);
    const pointsToLoopback = LOOPBACK_HOSTS.has(parsed.hostname);

    // Old records often store localhost/127 URLs which are unreachable from phones.
    if (isRemoteClient && pointsToLoopback) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
