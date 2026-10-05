import { describe, expect, it } from "vitest";
import { loginPath, safeNextPath } from "@/lib/auth/redirect";
import { canManageUsers, isPublisher, isRoleKey, isStaff } from "@/lib/auth/roles";

describe("safeNextPath", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeNextPath("/ta/admin", "/ta")).toBe("/ta/admin");
    expect(safeNextPath("/en/bible?b=GEN#v3", "/en")).toBe("/en/bible?b=GEN#v3");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/ta\n/admin",
    "relative/path",
    "",
    "/" + "a".repeat(3000),
  ])("rejects %j", (input) => {
    expect(safeNextPath(input, "/ta")).toBe("/ta");
  });

  it("rejects non-strings", () => {
    expect(safeNextPath(undefined, "/ta")).toBe("/ta");
    expect(safeNextPath(["/ta/admin"], "/ta")).toBe("/ta");
  });
});

describe("loginPath", () => {
  it("encodes the return path", () => {
    expect(loginPath("ta")).toBe("/ta/login");
    expect(loginPath("en", "/en/admin?x=1")).toBe("/en/login?next=%2Fen%2Fadmin%3Fx%3D1");
  });
});

describe("roles", () => {
  it("recognises role keys", () => {
    expect(isRoleKey("editor")).toBe(true);
    expect(isRoleKey("root")).toBe(false);
  });

  it("applies the permission matrix", () => {
    expect(isStaff(["user"])).toBe(false);
    expect(isStaff(["editor"])).toBe(true);
    expect(isPublisher(["editor"])).toBe(false);
    expect(isPublisher(["content_admin"])).toBe(true);
    expect(canManageUsers(["content_admin"])).toBe(false);
    expect(canManageUsers(["super_admin"])).toBe(true);
  });
});
