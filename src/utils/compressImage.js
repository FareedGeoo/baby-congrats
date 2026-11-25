/**
 * Compresses an image file client-side using canvas.
 * @param {File} file - The image file to compress.
 * @param {Object} options
 * @param {number} options.maxWidth - Max width in pixels (default 1200)
 * @param {number} options.maxHeight - Max height in pixels (default 1200)
 * @param {number} options.quality - JPEG/WebP quality 0-1 (default 0.8)
 * @param {string} options.type - Output mime type (default 'image/webp')
 * @returns {Promise<File>} Compressed file
 */
export async function compressImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.8, type = 'image/webp' } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
              type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          type,
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
  });
}

/**
 * Validates that a file is an allowed image type and under max size.
 * @param {File} file
 * @param {Object} options
 * @param {string[]} options.allowedTypes - Allowed mime types
 * @param {number} options.maxSizeMB - Max size in megabytes
 * @returns { { valid: boolean, errorCode?: string } }
 */
export function validateImageFile(file, { allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSizeMB = 5 } = {}) {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, errorCode: 'invalidType' };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, errorCode: 'tooLarge' };
  }
  return { valid: true };
}