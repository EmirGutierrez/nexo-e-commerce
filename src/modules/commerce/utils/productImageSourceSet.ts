export function productImageSourceSet(source: string): string | undefined {
  try {
    const url = new URL(source);
    if (url.hostname !== 'images.unsplash.com') return undefined;
    const width = Number(url.searchParams.get('w'));
    if (!Number.isInteger(width) || width < 900 || width >= 1800) return undefined;
    const highResolution = new URL(url);
    highResolution.searchParams.set('w', '1800');
    highResolution.searchParams.set('q', '90');
    return `${source} ${width}w, ${highResolution.toString()} 1800w`;
  } catch {
    return undefined;
  }
}
