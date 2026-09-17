import { createDemoIdentityStore } from "./seed";
import { MemoryIdentityRepository } from "./repository";
import { PostgresIdentityRepository } from "@/db/postgres-identity-repository";
import { IdentityCommandRepository } from "@/db/identity-commands";

export type RuntimeIdentityRepository = MemoryIdentityRepository & {
  flush?: () => Promise<void>;
  refresh?: () => Promise<void>;
};

const unavailable = () => {
  throw new Error(
    "The identity repository is unavailable until request-time initialization completes.",
  );
};

const unavailableRepository = new Proxy({} as RuntimeIdentityRepository, {
  get: unavailable,
});

export let identityRepository: RuntimeIdentityRepository =
  unavailableRepository;
export let identityCommands: IdentityCommandRepository | null = null;

let initialization: Promise<RuntimeIdentityRepository> | null = null;

async function createRuntimeRepository(): Promise<RuntimeIdentityRepository> {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.AROS_FORCE_POSTGRES_IDENTITY_FOR_TESTS !== "true"
  )
    return new MemoryIdentityRepository(createDemoIdentityStore());
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "Identity storage is not configured. Contact the service administrator.",
    );
  const repository = await PostgresIdentityRepository.connect(connectionString);
  identityCommands = new IdentityCommandRepository(connectionString);
  return repository;
}

/** Initializes identity persistence on first request and reuses one in-flight result. */
export function getIdentityRepository(): Promise<RuntimeIdentityRepository> {
  if (identityRepository !== unavailableRepository)
    return Promise.resolve(identityRepository);
  if (!initialization) {
    initialization = createRuntimeRepository()
      .then((repository) => {
        identityRepository = repository;
        return repository;
      })
      .catch((error: unknown) => {
        initialization = null;
        throw error;
      });
  }
  return initialization;
}

export async function getIdentityCommands() {
  await getIdentityRepository();
  return identityCommands;
}

export async function flushIdentityRepository() {
  const repository = await getIdentityRepository();
  await repository.flush?.();
}

export async function closeIdentityRepository() {
  if (identityRepository === unavailableRepository) {
    initialization = null;
    identityCommands = null;
    return;
  }
  const repository = identityRepository as RuntimeIdentityRepository & {
    close?: () => Promise<void>;
  };
  await repository.close?.();
  await identityCommands?.close();
  identityRepository = unavailableRepository;
  identityCommands = null;
  initialization = null;
}
