// SPIKE (ADR-021): proves capacitorFsAdapter satisfies the same StorageAdapter
// contract as the fs, memory, and object-store adapters — driven through the
// io.ts wrappers by the shared conformance suite, with no device and no
// @capacitor/* dependency (an in-memory fake models the plugin's contract).
import { runStorageAdapterConformance } from "./storage-adapter-conformance";
import { capacitorFsAdapter } from "../../src/lib/models/capacitorFsAdapter";
import { createFakeCapacitorFilesystem } from "../../src/lib/models/capacitor-filesystem";

runStorageAdapterConformance(
  "capacitor filesystem plugin (in-memory fake)",
  async () => ({
    adapter: capacitorFsAdapter(createFakeCapacitorFilesystem()),
  }),
);
