import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevelopmentRouteEnabled } from "./access";

afterEach(() => vi.unstubAllEnvs());

describe("development route guard", () => {
  it("is disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevelopmentRouteEnabled()).toBe(false);
  });
});
