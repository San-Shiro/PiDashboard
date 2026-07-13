import { describe, it, expect } from "bun:test";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";
import { uploadMedia, getMediaList, deleteMedia } from "./media";

describe("Media Upload Manager API Core", () => {
  it("should successfully process and save safe file types", async () => {
    const mockFile = new File(["test-content-data"], "test_sample_image.png", {
      type: "image/png"
    });

    const res = await uploadMedia(mockFile);
    expect(res.success).toBe(true);

    const list = getMediaList();
    expect(list.some((f) => f.filename === "test_sample_image.png")).toBe(true);

    // Clean up
    deleteMedia("test_sample_image.png");
  });

  it("should block and reject unsafe file extensions", async () => {
    const mockExecutable = new File(["echo 'hello'"], "malicious_script.sh", {
      type: "application/x-sh"
    });

    const res = await uploadMedia(mockExecutable);
    expect(res.success).toBe(false);
    expect(res.error).toContain("rejected");

    const mockJs = new File(["alert(1)"], "script.js", {
      type: "application/javascript"
    });

    const res2 = await uploadMedia(mockJs);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("rejected");
  });
});
