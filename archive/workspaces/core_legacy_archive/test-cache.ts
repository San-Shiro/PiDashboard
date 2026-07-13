import { existsSync, readFileSync, readdirSync, lstatSync } from "fs";
import { join } from "path";

const fragmentCache = new Map<string, string>();
const widgetsDir = join(process.cwd(), "widgets");
if (!existsSync(widgetsDir)) console.log("No widgets dir:", widgetsDir);

try {
  const folders = readdirSync(widgetsDir);
  folders.forEach((folder) => {
    if (folder.startsWith("_") || folder.startsWith(".")) return;
    const widgetPath = join(widgetsDir, folder);
    if (!lstatSync(widgetPath).isDirectory()) return;

    const manifestPath = join(widgetPath, "manifest.json");
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        const fragmentRelativePath = manifest.entrypoints?.fragment;
        console.log("Found manifest for", folder, "fragment:", fragmentRelativePath);
        if (fragmentRelativePath) {
          const fullFragmentPath = join(widgetPath, fragmentRelativePath);
          console.log("Checking path:", fullFragmentPath);
          if (existsSync(fullFragmentPath)) {
            const content = readFileSync(fullFragmentPath, "utf8");
            fragmentCache.set(folder, content);
            console.log("Cached from manifest:", folder);
            return;
          } else {
            console.log("File does not exist:", fullFragmentPath);
          }
        }
      } catch (e) {
        console.warn(`[compositor] Manifest parse error for ${folder}: ${(e as Error).message}`);
      }
    }

    const fragmentDir = join(widgetPath, "fragment");
    if (existsSync(fragmentDir)) {
      const files = readdirSync(fragmentDir);
      const htmlFile = files.find((f) => f.endsWith(".html"));
      if (htmlFile) {
        const content = readFileSync(join(fragmentDir, htmlFile), "utf8");
        fragmentCache.set(folder, content);
        console.log("Cached from fallback:", folder);
      }
    }
  });
  console.log(`[compositor] Cached ${fragmentCache.size} widget fragments in RAM:`, Array.from(fragmentCache.keys()));
} catch (e) {
  console.error(`[compositor] Fragment caching failed: ${(e as Error).message}`);
}
