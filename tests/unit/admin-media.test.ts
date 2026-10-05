import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, imagePath, imageProblem, mediaRecordSchema } from "@/lib/admin/media";

const ID = "00000000-0000-4000-8000-000000000001";

describe("media rules", () => {
  it("builds storage paths by year with the file type's extension", () => {
    expect(imagePath("image/webp", ID, new Date(Date.UTC(2026, 9, 5)))).toBe(`images/2026/${ID}.webp`);
  });

  it("accepts common image types up to 15 MB", () => {
    expect(imageProblem({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(imageProblem({ type: "image/gif", size: 1000 })).toBe("type");
    expect(imageProblem({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toBe("size");
    expect(imageProblem({ type: "image/png", size: 0 })).toBe("size");
  });

  it("validates the record of an uploaded file", () => {
    const ok = {
      storagePath: `images/2026/${ID}.png`,
      mimeType: "image/png",
      bytes: "2048",
      width: "800",
      height: "600",
    };
    expect(mediaRecordSchema.safeParse(ok).success).toBe(true);
    expect(mediaRecordSchema.safeParse({ ...ok, mimeType: "image/jpeg" }).success).toBe(false);
    expect(mediaRecordSchema.safeParse({ ...ok, storagePath: "../../etc/passwd" }).success).toBe(false);
    expect(mediaRecordSchema.safeParse({ ...ok, width: "0" }).success).toBe(false);
  });
});
