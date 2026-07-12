/**
 * Compress an image file using the browser's Canvas API.
 * Converts to WebP format to save space while maintaining quality.
 * No external dependencies or Web Workers, 100% native and synchronous.
 * 
 * @param {File} file The original image file
 * @param {Object} options Compression options
 * @param {number} [options.maxWidth=1920] Maximum width
 * @param {number} [options.maxHeight=1080] Maximum height
 * @param {number} [options.quality=0.85] Quality (0 to 1)
 * @returns {Promise<File>} The compressed WebP file (or original file if not an image)
 */
export async function compressImage(file, options = {}) {
  // Only compress images (skip gifs, videos, audio, etc)
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const { maxWidth = 1920, maxHeight = 1080, quality = 0.85 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP blob
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error("Canvas toBlob failed, returning original file");
            resolve(file);
            return;
          }
          
          // If the compressed size is somehow larger, return original
          if (blob.size >= file.size) {
             resolve(file);
             return;
          }

          // Create a new File object with the original name but changed extension
          const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
          const compressedFile = new File([blob], newName, {
            type: 'image/webp',
            lastModified: Date.now()
          });
          
          resolve(compressedFile);
        }, 'image/webp', quality);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}
