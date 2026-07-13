import { describe, it, expect } from "bun:test";
import { login, logout, isValidSession, parseCookies, serializeCookie } from "./auth";

describe("Authentication Services Gate", () => {
  it("should successfully authenticate correct credentials using Argon2", async () => {
    // Default hashed password is "admin"
    const token = await login("admin");
    expect(token).not.toBeNull();
    expect(typeof token).toBe("string");
    expect(isValidSession(token!)).toBe(true);

    // Clean up session
    if (token) logout(token);
  });

  it("should reject incorrect password inputs", async () => {
    const token = await login("wrong-credentials-password");
    expect(token).toBeNull();
  });

  it("should invalidate sessions upon logout requests", async () => {
    const token = await login("admin");
    expect(token).not.toBeNull();
    expect(isValidSession(token!)).toBe(true);

    logout(token!);
    expect(isValidSession(token!)).toBe(false);
  });

  it("should parse multiple browser cookies correctly", () => {
    const parsed = parseCookies("session_token=test-session-uuid-1234; other_cookie=val;");
    expect(parsed["session_token"]).toBe("test-session-uuid-1234");
    expect(parsed["other_cookie"]).toBe("val");
  });

  it("should serialize httpOnly session cookies", () => {
    const cookie = serializeCookie("session_token", "sample-token", 3600);
    expect(cookie).toContain("session_token=sample-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=3600");
  });
});
