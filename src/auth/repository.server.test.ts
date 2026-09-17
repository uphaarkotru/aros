import { afterEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalForce = process.env.AROS_FORCE_POSTGRES_IDENTITY_FOR_TESTS;

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalForce === undefined)
    delete process.env.AROS_FORCE_POSTGRES_IDENTITY_FOR_TESTS;
  else process.env.AROS_FORCE_POSTGRES_IDENTITY_FOR_TESTS = originalForce;
});

describe("lazy identity repository initialization", () => {
  it("can be imported without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    process.env.AROS_FORCE_POSTGRES_IDENTITY_FOR_TESTS = "true";
    await expect(import("./repository.server")).resolves.toBeDefined();
  });

  it("fails closed at runtime without exposing a connection string", async () => {
    delete process.env.DATABASE_URL;
    process.env.AROS_FORCE_POSTGRES_IDENTITY_FOR_TESTS = "true";
    const { getIdentityRepository } = await import("./repository.server");
    await expect(getIdentityRepository()).rejects.toThrow(
      "Identity storage is not configured",
    );
  });

  it("initializes a configured PostgreSQL repository once under concurrency", async () => {
    process.env.DATABASE_URL = "postgresql://pilot:secret@localhost/aros_test";
    process.env.AROS_FORCE_POSTGRES_IDENTITY_FOR_TESTS = "true";
    const repository = { read: vi.fn() };
    const connect = vi.fn(async () => repository);
    vi.doMock("@/db/postgres-identity-repository", () => ({
      PostgresIdentityRepository: { connect },
    }));
    vi.doMock("@/db/identity-commands", () => ({
      IdentityCommandRepository: class {},
    }));
    const { getIdentityRepository } = await import("./repository.server");
    const results = await Promise.all(
      Array.from({ length: 12 }, () => getIdentityRepository()),
    );
    expect(connect).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result === (repository as unknown))).toBe(
      true,
    );
  });
});
