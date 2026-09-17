import { describe, expect, it } from "vitest";
import { isDemoOrganization } from "./application-mode";

describe("tenant-specific application behavior", () => {
  it("enables demo behavior only for the organization being evaluated", () => {
    expect(isDemoOrganization({ environment: "DEMO" })).toBe(true);
    expect(isDemoOrganization({ environment: "SANDBOX" })).toBe(false);
    expect(isDemoOrganization({ environment: "PRODUCTION" })).toBe(false);
  });

  it("does not let one tenant's environment affect another tenant", () => {
    const demoTenant = { environment: "DEMO" as const };
    const productionTenant = { environment: "PRODUCTION" as const };
    expect(isDemoOrganization(demoTenant)).toBe(true);
    expect(isDemoOrganization(productionTenant)).toBe(false);
  });
});
