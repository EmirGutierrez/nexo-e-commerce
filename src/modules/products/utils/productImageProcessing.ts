export const PRODUCT_IMAGE_MIN_SIDE = 1140;
export const PRODUCT_IMAGE_MAX_DATA_URL_LENGTH = 180_000;

export function productImageCompressionDimensions(width: number, height: number): { width: number; height: number }[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < PRODUCT_IMAGE_MIN_SIDE || height < PRODUCT_IMAGE_MIN_SIDE) return [];
  const candidates = [1800, 1600, 1440, 1280, PRODUCT_IMAGE_MIN_SIDE].flatMap((maxDimension) => {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    if (Math.min(width, height) * scale < PRODUCT_IMAGE_MIN_SIDE) return [];
    const dimensions = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    if (dimensions.width < PRODUCT_IMAGE_MIN_SIDE || dimensions.height < PRODUCT_IMAGE_MIN_SIDE) return [];
    return [dimensions];
  });
  if (!candidates.length && Math.max(width, height) <= 3000) candidates.push({ width, height });
  return candidates.filter((dimensions, index, all) => all.findIndex((other) => other.width === dimensions.width && other.height === dimensions.height) === index);
}
