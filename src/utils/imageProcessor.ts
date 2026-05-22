/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Browser-only image-processing helpers used by the composer's image
 * uploader. Two responsibilities:
 *
 *   1. Auto-downsize: scale a large image so its longest edge falls
 *      under `maxDimension` (default 2048px). Big phone photos —
 *      4032×3024 from a modern phone, often 8+ MB — frequently break
 *      Ecency / Hive image uploads ("only half the photo arrives").
 *      Scaling on the client both fixes the upload and keeps feed
 *      pages fast.
 *
 *   2. Cropping: given a source image and a normalised crop rect
 *      (0..1 in both axes), render just that rectangle to a fresh
 *      canvas and return a new Blob.
 *
 * The helpers always re-encode through `<canvas>.toBlob`. Files that
 * are already small (under `softSizeLimit` *and* within the dimension
 * budget) skip processing entirely so a hand-prepared image isn't
 * silently re-compressed.
 */

export interface PrepareImageOptions {
  /** Hard cap on the longest edge of the output image. */
  maxDimension?: number;
  /** JPEG quality when the source is re-encoded as JPEG (0..1). */
  jpegQuality?: number;
  /** Files smaller than this are returned untouched if they also fit
   *  within `maxDimension`. */
  softSizeLimit?: number;
}

// Full HD on the longest edge. Phones routinely shoot 4K (3840px) and
// pro cameras hit 8K (7680px); anything beyond 1080p is wasted bytes
// in a feed/blog context, and the upstream Ecency / hive.blog hosts
// truncate big payloads. 1920 keeps photos crisp on desktop without
// breaking the upload pipeline.
const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_JPEG_QUALITY = 0.85;
const DEFAULT_SOFT_SIZE_LIMIT = 1.5 * 1024 * 1024; // 1.5 MB

/** Wrap a Blob in a File so the upload pipeline keeps a sensible name. */
function blobToFile(blob: Blob, fallbackName: string): File {
  // `File` constructor isn't available in some non-browser test envs;
  // fall back to tagging the blob with a `name` property.
  try {
    return new File([blob], fallbackName, { type: blob.type, lastModified: Date.now() });
  } catch {
    (blob as any).name = fallbackName;
    return blob as File;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
      mime,
      quality,
    );
  });
}

/** Pick the output MIME. Preserve PNG (transparency-bearing) when the
 *  source was PNG; everything else gets squeezed through JPEG. */
function pickOutputMime(sourceType: string): { mime: string; ext: string } {
  if (sourceType === 'image/png') return { mime: 'image/png', ext: 'png' };
  if (sourceType === 'image/webp') return { mime: 'image/webp', ext: 'webp' };
  if (sourceType === 'image/gif') return { mime: 'image/gif', ext: 'gif' };
  return { mime: 'image/jpeg', ext: 'jpg' };
}

/**
 * Downsize a file if its longest edge exceeds `maxDimension`. Files
 * that are already small are returned as-is so we don't burn CPU on a
 * thumbnail-sized image. Animated GIFs are passed through untouched
 * since canvas re-encoding would freeze them on the first frame.
 */
export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {},
): Promise<File> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY;
  const softSizeLimit = options.softSizeLimit ?? DEFAULT_SOFT_SIZE_LIMIT;

  if (file.type === 'image/gif') return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    // Already small enough — skip the round-trip through canvas.
    if (longest <= maxDimension && file.size <= softSizeLimit) {
      return file;
    }

    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const targetW = Math.round(img.naturalWidth * scale);
    const targetH = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const { mime, ext } = pickOutputMime(file.type);
    const blob = await canvasToBlob(canvas, mime, jpegQuality);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return blobToFile(blob, `${baseName}.${ext}`);
  } catch {
    // If anything goes wrong (corrupt file, OOM on a huge image, etc.)
    // fall back to the original so the user still gets to attempt the
    // upload — the upstream Ecency/hive.blog endpoints can still reject.
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface CropRect {
  /** All values are 0..1 of the source image's natural dimensions. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop `file` to the normalised `rect` and downsize the result the
 * same way `prepareImageForUpload` does. The crop is applied at the
 * source's native resolution, *then* the downsize step runs — so
 * cropping a tiny region from a huge image still gives you a sharp
 * output without blowing up file size.
 */
export async function cropImage(
  file: File,
  rect: CropRect,
  options: PrepareImageOptions = {},
): Promise<File> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const sx = Math.max(0, Math.round(rect.x * img.naturalWidth));
    const sy = Math.max(0, Math.round(rect.y * img.naturalHeight));
    const sw = Math.max(1, Math.round(rect.width * img.naturalWidth));
    const sh = Math.max(1, Math.round(rect.height * img.naturalHeight));

    // Apply max-dimension to the *cropped* output so an extreme crop
    // doesn't yield a microscopic image when the source was a fat
    // panorama.
    const longest = Math.max(sw, sh);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const targetW = Math.round(sw * scale);
    const targetH = Math.round(sh * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    const { mime, ext } = pickOutputMime(file.type);
    const blob = await canvasToBlob(canvas, mime, jpegQuality);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return blobToFile(blob, `${baseName}-crop.${ext}`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
