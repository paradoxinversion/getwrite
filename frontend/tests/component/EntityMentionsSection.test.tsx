import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import EntityMentionsSection from "../../components/Sidebar/EntityMentionsSection";
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
import type { EntityMentionedIn } from "../../src/lib/models/mentions-core";

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
  const res = createTextResource({ name: "Aria" });
  (res as unknown as { id: string }).id = resourceId;
  Object.assign(res, { entityKind: "character" }, overrides);
  store.dispatch(setResources([res]));
  store.dispatch(setSelectedResourceId(resourceId));
  return store;
}

function mockMentionedIn(mentionedIn: EntityMentionedIn[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input.toString();
    if (url.includes("/mentioned-in")) {
      return { ok: true, json: async () => ({ mentionedIn }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EntityMentionsSection", () => {
  it("renders nothing when the selected resource has no entityKind", async () => {
    mockMentionedIn([]);
    const store = setupStore("res-plain", { entityKind: undefined });

    const { container } = render(
      <Provider store={store}>
        <EntityMentionsSection />
      </Provider>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows only a Linked badge for an explicit-only row", async () => {
    mockMentionedIn([
      {
        resourceId: "scene-1",
        name: "Chapter One",
        snippets: [],
        isLinked: true,
        isMentioned: false,
        ambiguousWith: [],
      },
    ]);
    const store = setupStore("entity-aria");

    render(
      <Provider store={store}>
        <EntityMentionsSection />
      </Provider>,
    );

    expect(await screen.findByText("Chapter One")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Chapter One-linked-badge"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Chapter One-mentioned-badge"),
    ).not.toBeInTheDocument();
  });

  it("shows only a Mentioned badge and its snippet for a detected-only row", async () => {
    mockMentionedIn([
      {
        resourceId: "scene-2",
        name: "Chapter Two",
        snippets: ["Aria drew her blade."],
        isLinked: false,
        isMentioned: true,
        ambiguousWith: [[]],
      },
    ]);
    const store = setupStore("entity-aria");

    render(
      <Provider store={store}>
        <EntityMentionsSection />
      </Provider>,
    );

    expect(await screen.findByText("Chapter Two")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Chapter Two-mentioned-badge"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Chapter Two-linked-badge"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Aria drew her blade.")).toBeInTheDocument();
  });

  it("shows a single row with both badges for a resource that is both linked and mentioned", async () => {
    mockMentionedIn([
      {
        resourceId: "scene-3",
        name: "Chapter Three",
        snippets: ["Aria nodded."],
        isLinked: true,
        isMentioned: true,
        ambiguousWith: [[]],
      },
    ]);
    const store = setupStore("entity-aria");

    render(
      <Provider store={store}>
        <EntityMentionsSection />
      </Provider>,
    );

    expect(await screen.findAllByText("Chapter Three")).toHaveLength(1);
    expect(
      screen.getByLabelText("Chapter Three-linked-badge"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Chapter Three-mentioned-badge"),
    ).toBeInTheDocument();
  });

  it("shows an ambiguity indicator naming the other claiming entities", async () => {
    mockMentionedIn([
      {
        resourceId: "scene-4",
        name: "Chapter Four",
        snippets: ["May arrived at dawn."],
        isLinked: false,
        isMentioned: true,
        ambiguousWith: [["Bob"]],
      },
    ]);
    const store = setupStore("entity-aria");

    render(
      <Provider store={store}>
        <EntityMentionsSection />
      </Provider>,
    );

    expect(await screen.findByText("May arrived at dawn.")).toBeInTheDocument();
    expect(screen.getByText(/Ambiguous/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("navigates to the mentioning resource on click", async () => {
    mockMentionedIn([
      {
        resourceId: "scene-5",
        name: "Chapter Five",
        snippets: ["Aria left."],
        isLinked: false,
        isMentioned: true,
        ambiguousWith: [[]],
      },
    ]);
    const store = setupStore("entity-aria");

    render(
      <Provider store={store}>
        <EntityMentionsSection />
      </Provider>,
    );

    fireEvent.click(await screen.findByText("Chapter Five"));

    await waitFor(() => {
      expect(store.getState().resources.selectedResourceId).toBe("scene-5");
    });
  });

  it("renders nothing when there are no associated resources", async () => {
    mockMentionedIn([]);
    const store = setupStore("entity-aria");

    const { container } = render(
      <Provider store={store}>
        <EntityMentionsSection />
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

    const store = setupStore("entity-aria");

    render(
      <Provider store={store}>
        <EntityMentionsSection />
      </Provider>,
    );

    expect(await screen.findByRole("status")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ mentionedIn: [] }),
    } as Response);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
