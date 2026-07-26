// ADR-021 Phase 1 (Task 1): unit tests for the generalized transport-collapse
// helper. Proves the two guarantees every transport built on top of it relies
// on:
//   1. Dispatch-by-runtime: web/unset resolves to the HTTP impl and never
//      touches the native loader; native resolves to the native loader's
//      result.
//   2. Laziness: under web runtime, the native thunk is never invoked/called
//      at all — not even to start resolving it — proven with a `vi.fn()`
//      wrapper rather than by inspecting real dynamic-import side effects.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTransport } from "../../src/store/transport/create-transport";

const RUNTIME_ENV = "NEXT_PUBLIC_GETWRITE_RUNTIME";
const originalRuntime = process.env[RUNTIME_ENV];

afterEach(() => {
  if (originalRuntime === undefined) delete process.env[RUNTIME_ENV];
  else process.env[RUNTIME_ENV] = originalRuntime;
});

interface FakeTransport {
  who: string;
}

describe("createTransport — dispatch by runtime", () => {
  beforeEach(() => {
    delete process.env[RUNTIME_ENV];
  });

  it("resolves to the HTTP impl and never calls loadNative when runtime is unset (web default)", async () => {
    const httpImpl: FakeTransport = { who: "http" };
    const loadNative = vi.fn(
      async (): Promise<FakeTransport> => ({ who: "native" }),
    );

    const resolve = createTransport(httpImpl, loadNative);
    const result = await resolve();

    expect(result).toBe(httpImpl);
    expect(loadNative).not.toHaveBeenCalled();
  });

  it("resolves to the HTTP impl and never calls loadNative when runtime is explicitly web", async () => {
    process.env[RUNTIME_ENV] = "web";
    const httpImpl: FakeTransport = { who: "http" };
    const loadNative = vi.fn(
      async (): Promise<FakeTransport> => ({ who: "native" }),
    );

    const resolve = createTransport(httpImpl, loadNative);
    const result = await resolve();

    expect(result).toBe(httpImpl);
    expect(loadNative).not.toHaveBeenCalled();
  });

  it("calls loadNative and resolves to its result when runtime is native", async () => {
    process.env[RUNTIME_ENV] = "native";
    const httpImpl: FakeTransport = { who: "http" };
    const nativeImpl: FakeTransport = { who: "native" };
    const loadNative = vi.fn(async (): Promise<FakeTransport> => nativeImpl);

    const resolve = createTransport(httpImpl, loadNative);
    const result = await resolve();

    expect(loadNative).toHaveBeenCalledTimes(1);
    expect(result).toBe(nativeImpl);
  });
});

describe("createTransport — laziness", () => {
  it("never invokes the native thunk under web runtime, even across repeated calls", async () => {
    delete process.env[RUNTIME_ENV];
    const httpImpl: FakeTransport = { who: "http" };
    const loadNative = vi.fn(
      async (): Promise<FakeTransport> => ({ who: "native" }),
    );

    const resolve = createTransport(httpImpl, loadNative);
    await resolve();
    await resolve();
    await resolve();

    expect(loadNative).not.toHaveBeenCalled();
  });
});

describe("createTransport — error propagation", () => {
  it("does not swallow errors thrown by the HTTP impl's own consumers (impl returned as-is)", async () => {
    delete process.env[RUNTIME_ENV];
    const httpImpl: FakeTransport = { who: "http" };
    const loadNative = vi.fn(async (): Promise<FakeTransport> => {
      throw new Error("must not be reached on web runtime");
    });

    const resolve = createTransport(httpImpl, loadNative);
    await expect(resolve()).resolves.toBe(httpImpl);
  });

  it("propagates a rejection from loadNative under native runtime instead of swallowing it", async () => {
    process.env[RUNTIME_ENV] = "native";
    const httpImpl: FakeTransport = { who: "http" };
    const loadNative = vi.fn(async (): Promise<FakeTransport> => {
      throw new Error("native load failed");
    });

    const resolve = createTransport(httpImpl, loadNative);
    await expect(resolve()).rejects.toThrow("native load failed");
  });
});
