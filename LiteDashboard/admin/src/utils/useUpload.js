import * as React from 'react';
import { compressImage as nativeCompress } from './ImageCompressor';

export const compressImage = async (file) => {
  try {
    return await nativeCompress(file);
  } catch (error) {
    console.warn("Compression failed, using original file", error);
    return file;
  }
};

function useUpload() {
  const [loading, setLoading] = React.useState(false);
  const upload = React.useCallback(async (input) => {
    try {
      setLoading(true);
      let response;
      if ("file" in input && input.file) {
        // Compress image before upload
        const optimizedFile = await compressImage(input.file);
        
        const formData = new FormData();
        formData.append("file", optimizedFile);
        
        response = await fetch("/api/media/upload", {
          method: "POST",
          body: formData
        });
      } else {
        throw new Error("Unsupported upload input");
      }
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Upload failed");
      }
      
      // The backend returns the final filename which might be sanitized
      return { success: true, url: data.url || `/media/${input.file.name}` };
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      return { error: "Upload failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }];
}

export { useUpload };
export default useUpload;
