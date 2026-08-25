import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import EntitiesMentionedSection from "../../components/Sidebar/EntitiesMentionedSection";
import { makeStore } from "../../src/store/store";
import {
  setProject,
  setSelectedProjectId,
} from "../../src/store/projectsSlice";
import {
  setResources,
  setSelectedResourceId,
} from "../../src/store/resourcesSlice";
import { createTextResource } from "../../src/lib/models/resource";
import type { AnyResource } from "../../src/lib/models/types";
import type { ResourceMention } from "../../src/lib/models/mentions-core";

const PROJECT_PATH = "/tmp/test-project";

function setupStore(resourceId: string, overrides: Partial<AnyResource> = {}) {
  const store = makeStore();
  store.dispatch(
    setProject({
      id: "proj-test-1",
      name: "Test Project",
      rootPath: PROJECT_PATH,
    }),
  );
  store.dispatch(setSelectedProjectId("proj-test-1"));
  const res = createTextResource({ name: "My Chapter" });
  (res as unknown as { id: string }).id = resourceId;
  Object.assign(res, overrides);
  store.dispatch(setResources([res]));
  store.dispatch(setSelectedResourceId(resourceId));
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EntitiesMentionedSection", () => {
  it("renders every detected entity as a navigable row and navigates on click", async () => {
    const mentions: ResourceMention[] = [
      { entityId: "entity-1", name: "Alice" },
      { entityId: "entity-2", name: "Bob" },
    ];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/mentions")) {
        return { ok: true, json: async () => ({ mentions }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    const store = setupStore("res-1");

    render(
      <Provider store={store}>
        <EntitiesMentionedSection />
      </Provider>,
    );

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Alice"));

    await waitFor(() => {
      expect(store.getState().resources.selectedResourceId).toBe("entity-1");
    });
  });

  it("renders nothing when there are no detected entities", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return { ok: true, json: async () => ({ mentions: [] }) } as Response;
    });

    const store = setupStore("res-2");

    const { container } = render(
      <Provider store={store}>
        <EntitiesMentionedSection />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a distinct loading state before mentions resolve", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const store = setupStore("res-3");

    render(
      <Provider store={store}>
        <EntitiesMentionedSection />
      </Provider>,
    );

    expect(await screen.findByRole("status")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ mentions: [] }),
    } as Response);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
