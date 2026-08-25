import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import EntitySection from "../../components/Sidebar/EntitySection";
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

const PROJECT_PATH = "/tmp/test-project";

function makeFetchStub() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return { ok: true, json: async () => ({}) } as Response;
  });
}

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
  const res = createTextResource({ name: "My Character" });
  (res as unknown as { id: string }).id = resourceId;
  Object.assign(res, overrides);
  store.dispatch(setResources([res]));
  store.dispatch(setSelectedResourceId(resourceId));
  return store;
}

function getLastSidecarBody(fetchStub: ReturnType<typeof makeFetchStub>) {
  const call = fetchStub.mock.calls
    .filter(([url]) => url.toString().includes("/sidecar"))
    .pop();
  if (!call) return null;
  return JSON.parse(call[1]?.body as string) as {
    projectId: string;
    updatedResource: AnyResource;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EntitySection", () => {
  it("persists a free-text entityKind outside the suggested list unmodified", async () => {
    const fetchStub = makeFetchStub();
    const store = setupStore("res-1");

    render(
      <Provider store={store}>
        <EntitySection />
      </Provider>,
    );

    const kindInput = screen.getByLabelText(
      "entity-kind-input",
    ) as HTMLInputElement;
    fireEvent.change(kindInput, { target: { value: "faction" } });

    await waitFor(() => {
      const body = getLastSidecarBody(fetchStub);
      expect(body).not.toBeNull();
      expect(body!.updatedResource.entityKind).toBe("faction");
    });
  });

  it("adding an alias under three characters shows the warning and still adds it", async () => {
    const fetchStub = makeFetchStub();
    const store = setupStore("res-2", { entityKind: "character" });

    render(
      <Provider store={store}>
        <EntitySection />
      </Provider>,
    );

    const aliasInput = screen.getByLabelText(
      "new-alias-input",
    ) as HTMLInputElement;
    fireEvent.change(aliasInput, { target: { value: "Jo" } });

    expect(
      await screen.findByText(/very short and will match frequently/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "add-alias" }));

    expect(await screen.findByText("Jo")).toBeInTheDocument();

    await waitFor(() => {
      const body = getLastSidecarBody(fetchStub);
      expect(body).not.toBeNull();
      expect(body!.updatedResource.aliases).toEqual(["Jo"]);
    });
  });

  it("shows no warning while the alias draft field is empty", async () => {
    const store = setupStore("res-2b", { entityKind: "character" });

    render(
      <Provider store={store}>
        <EntitySection />
      </Provider>,
    );

    const aliasInput = screen.getByLabelText(
      "new-alias-input",
    ) as HTMLInputElement;
    expect(aliasInput.value).toBe("");

    // An untouched draft field is not an alias, so it must not be flagged as
    // "very short" — otherwise every entity opens showing a spurious warning.
    expect(
      screen.queryByText(/very short and will match frequently/i),
    ).not.toBeInTheDocument();

    // Whitespace alone is still an empty draft.
    fireEvent.change(aliasInput, { target: { value: "   " } });
    expect(
      screen.queryByText(/very short and will match frequently/i),
    ).not.toBeInTheDocument();

    // A genuinely short alias still warns, so the guard has not disabled FR-15.
    fireEvent.change(aliasInput, { target: { value: "Jo" } });
    expect(
      await screen.findByText(/very short and will match frequently/i),
    ).toBeInTheDocument();

    // Clearing the field retracts the warning.
    fireEvent.change(aliasInput, { target: { value: "" } });
    await waitFor(() => {
      expect(
        screen.queryByText(/very short and will match frequently/i),
      ).not.toBeInTheDocument();
    });
  });

  it("reordering aliases preserves order in the persisted value", async () => {
    const fetchStub = makeFetchStub();
    const store = setupStore("res-3", {
      entityKind: "character",
      aliases: ["Alpha", "Bravo", "Charlie"],
    });

    render(
      <Provider store={store}>
        <EntitySection />
      </Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Bravo up" }));

    await waitFor(() => {
      const body = getLastSidecarBody(fetchStub);
      expect(body).not.toBeNull();
      expect(body!.updatedResource.aliases).toEqual([
        "Bravo",
        "Alpha",
        "Charlie",
      ]);
    });
  });

  it("clearing entityKind hides the alias editor without deleting stored aliases", async () => {
    const fetchStub = makeFetchStub();
    const store = setupStore("res-4", {
      entityKind: "character",
      aliases: ["Alpha", "Bravo"],
    });

    render(
      <Provider store={store}>
        <EntitySection />
      </Provider>,
    );

    expect(screen.getByLabelText("new-alias-input")).toBeInTheDocument();

    const kindInput = screen.getByLabelText(
      "entity-kind-input",
    ) as HTMLInputElement;
    fireEvent.change(kindInput, { target: { value: "" } });

    await waitFor(() => {
      expect(
        screen.queryByLabelText("new-alias-input"),
      ).not.toBeInTheDocument();
    });

    const body = getLastSidecarBody(fetchStub);
    expect(body).not.toBeNull();
    expect(body!.updatedResource.entityKind).toBeUndefined();
    expect(body!.updatedResource.aliases).toEqual(["Alpha", "Bravo"]);
  });
});
