import { describe, expect, it, vi } from "vitest";
import {
  canAdministerDemo,
  isProductionDemoFeatureEnabled,
} from "./demo-access";

describe("demo route access", () => {
  it("rejects wrong-tenant environment and insufficient authority", () => {
    expect(
      canAdministerDemo(
        { id: "demo", environment: "DEMO" },
        { adminRole: "ORG_ADMIN" },
        { platformRole: null },
      ),
    ).toBe(true);
    expect(
      canAdministerDemo(
        { id: "sandbox", environment: "SANDBOX" },
        { adminRole: "ORG_ADMIN" },
        { platformRole: null },
      ),
    ).toBe(false);
    expect(
      canAdministerDemo(
        { id: "production", environment: "PRODUCTION" },
        { adminRole: "ORG_OWNER" },
        { platformRole: null },
      ),
    ).toBe(false);
    expect(
      canAdministerDemo(
        { id: "demo", environment: "DEMO" },
        { adminRole: "MEMBER" },
        { platformRole: null },
      ),
    ).toBe(false);
  });

  it("defaults production demo feature flags to disabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProductionDemoFeatureEnabled(undefined)).toBe(false);
    expect(isProductionDemoFeatureEnabled("false")).toBe(false);
    expect(isProductionDemoFeatureEnabled("true")).toBe(true);
    vi.unstubAllEnvs();
  });
});
