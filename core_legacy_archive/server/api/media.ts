import { existsSync, readdirSync, statSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "media", "uploads");

// Ensure upload directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Strictly allow only safe media/visual mime extensions
const ALLOWED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp4", ".webm",
  ".woff", ".woff2", ".ttf"
];

function isSafeFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  // Reject scripts or executable extensions
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext)) && !lower.includes("..");
}

export function getMediaList(): any[] {
  try {
    const files = readdirSync(UPLOADS_DIR);
    return files
      .filter((f) => statSync(join(UPLOADS_DIR, f)).isFile())
      .map((f) => {
        const stat = statSync(join(UPLOADS_DIR, f));
        return {
          filename: f,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          url: `/media/${f}`
        };
      });
  } catch (e) {
    console.error(`[media] Failed to read uploads list: ${(e as Error).message}`);
    return [];
  }
}

export async function uploadMedia(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    if (!file || !file.name) {
      return { success: false, error: "No file provided" };
    }

    if (!isSafeFilename(file.name)) {
      return { success: false, error: "Unsafe or unsupported file type extension rejected" };
    }

    const savePath = join(UPLOADS_DIR, file.name);
    await Bun.write(savePath, file);
    return { success: true };
  } catch (e) {
    console.error(`[media] Upload process failed: ${(e as Error).message}`);
    return { success: false, error: (e as Error).message };
  }
}

export function deleteMedia(filename: string): boolean {
  try {
    if (!isSafeFilename(filename)) return false;
    
    const filePath = join(UPLOADS_DIR, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
  } catch (e) {
    console.error(`[media] File delete failed: ${(e as Error).message}`);
  }
  return false;
}
