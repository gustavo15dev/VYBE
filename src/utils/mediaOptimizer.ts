/**
 * Client-side media compression and optimization utility
 * Ensures base64 images stay well within Firestore's 1MB document limit
 */

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

/**
 * Resizes and compresses an image File or Data URL to a lightweight base64 string
 */
export async function optimizeImage(
  fileOrDataUrl: File | string,
  options: OptimizeImageOptions = {}
): Promise<string> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.8,
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    const processImage = () => {
      let { width, height } = img;

      // Calculate aspect ratio preserving bounds
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fill white background for transparent PNGs converted to JPEG
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Export compressed base64
      const compressedDataUrl = canvas.toDataURL(mimeType, quality);
      resolve(compressedDataUrl);
    };

    img.onload = processImage;
    img.onerror = (err) => reject(err);

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Optimizes a list of images ensuring the total collective size fits within Firestore document limit (< 750KB total)
 */
export async function optimizeImageList(
  files: (File | string)[],
  maxTotalSizeKb = 700
): Promise<string[]> {
  const count = files.length;
  if (count === 0) return [];

  // Adjust max dimensions and quality dynamically according to number of images
  const targetWidth = count > 3 ? 900 : 1200;
  const targetHeight = count > 3 ? 900 : 1200;
  const targetQuality = count > 3 ? 0.65 : count > 1 ? 0.75 : 0.82;

  const results: string[] = [];

  for (const item of files) {
    const compressed = await optimizeImage(item, {
      maxWidth: targetWidth,
      maxHeight: targetHeight,
      quality: targetQuality,
      mimeType: 'image/jpeg',
    });
    results.push(compressed);
  }

  return results;
}

/**
 * Calculates approximate size in bytes of a base64 string
 */
export function getBase64SizeBytes(base64String: string): number {
  const padding = base64String.endsWith('==') ? 2 : base64String.endsWith('=') ? 1 : 0;
  return (base64String.length * (3 / 4)) - padding;
}
