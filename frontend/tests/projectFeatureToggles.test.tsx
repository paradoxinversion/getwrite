/**
 * Component tests for the project feature-toggle section (Task 5).
 *
 * Covers: the four toggles reflect `config.features` (absent flag = off),
 * toggling a feature dispatches `updateProjectFeatures` with the full merged
 * map and updates the store, and the section renders nothing when no project is
 * selected.
 */
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import ProjectFeatureToggles from "../components/preferences/ProjectFeatureToggles";
import { makeStore } from "../src/store/store";
import { setProject, setSelectedProjectId } from "../src/store/projectsSlice";
import type { ProjectFeatureFlags } from "../src/lib/models/types";

vi.mock("../src/lib/toast-service", () => {
  const toastService = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  };
  return { toastService, default: toastService };
});
import { toastService } from "../src/lib/toast-service";

function setup(features?: ProjectFeatureFlags) {
  const store = makeStore();
  const projectId = "test-project-id";
  store.dispatch(
    setProject({
      id: projectId,
      rootPath: "/test",
      ...(features ? { features } : {}),
    }),
  );
  store.dispatch(setSelectedProjectId(projectId));
  const utils = render(
    <Provider store={store}>
      <ProjectFeatureToggles />
    </Provider>,
  );
  return { store, projectId, ...utils };
}

function mockFeatureRoute(features: ProjectFeatureFlags) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ features, organizerCardBody: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
}

describe("ProjectFeatureToggles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("renders a checkbox for each of the five features", () => {
    setup();
    expect(
      screen.getByRole("checkbox", { name: /timeline/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /point of view/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /synopsis/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /notes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /entities/i }),
    ).toBeInTheDocument();
  });

  it("treats an absent features block as all-off", () => {
    setup();
    for (const name of [
      /timeline/i,
      /point of view/i,
      /synopsis/i,
      /notes/i,
      /entities/i,
    ]) {
      expect(screen.getByRole("checkbox", { name })).not.toBeChecked();
    }
  });

  it("reflects the current enabled features", () => {
    setup({ timeline: true, notes: true });
    expect(screen.getByRole("checkbox", { name: /timeline/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /notes/i })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /point of view/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /synopsis/i }),
    ).not.toBeChecked();
  });

  it("dispatches the full merged feature map and updates the store when enabling a feature", async () => {
    const { store } = setup({ timeline: true });
    const fetchSpy = mockFeatureRoute({ timeline: true, synopsis: true });

    fireEvent.click(screen.getByRole("checkbox", { name: /synopsis/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/project/features");
    expect(JSON.parse(init.body as string)).toEqual({
      projectId: "test",
      features: { timeline: true, synopsis: true },
    });

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /synopsis/i })).toBeChecked(),
    );
    expect(
      store.getState().projects.projects["test-project-id"].features,
    ).toEqual({ timeline: true, synopsis: true });
  });

  it("sends false for a feature being disabled", async () => {
    setup({ timeline: true, pov: true });
    const fetchSpy = mockFeatureRoute({ pov: true });

    fireEvent.click(screen.getByRole("checkbox", { name: /timeline/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      projectId: "test",
      features: { timeline: false, pov: true },
    });
  });

  it("preserves the separate timelineView flag when toggling a metadata feature", async () => {
    // The metadata toggles must not clobber the view flag, since the route
    // replaces the features block wholesale.
    setup({ timelineView: true });
    const fetchSpy = mockFeatureRoute({ timelineView: true, notes: true });

    fireEvent.click(screen.getByRole("checkbox", { name: /notes/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).features).toEqual({
      timelineView: true,
      notes: true,
    });
  });

  it("also turns the Timeline view off when disabling the timeline fields", async () => {
    setup({ timeline: true, timelineView: true });
    const fetchSpy = mockFeatureRoute({ timeline: false, timelineView: false });

    fireEvent.click(screen.getByRole("checkbox", { name: /timeline/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).features).toEqual({
      timeline: false,
      timelineView: false,
    });
  });

  it("does not touch timelineView when disabling the fields with the view already off", async () => {
    setup({ timeline: true });
    const fetchSpy = mockFeatureRoute({ timeline: false });

    fireEvent.click(screen.getByRole("checkbox", { name: /timeline/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).features).toEqual({
      timeline: false,
    });
  });

  it("warns via tooltip only when disabling the fields would also disable the view", () => {
    const { unmount } = setup({ timeline: true, timelineView: true });
    const warned = screen
      .getByRole("checkbox", { name: /timeline/i })
      .closest("[data-tooltip-content]");
    expect(warned).not.toBeNull();
    expect(warned?.getAttribute("data-tooltip-content")).toMatch(/view/i);
    unmount();

    // View off → disabling the fields harms nothing → no warning.
    setup({ timeline: true });
    expect(
      screen
        .getByRole("checkbox", { name: /timeline/i })
        .closest("[data-tooltip-content]"),
    ).toBeNull();
  });

  it("shows a success toast confirming the toggle", async () => {
    setup();
    mockFeatureRoute({ synopsis: true });

    fireEvent.click(screen.getByRole("checkbox", { name: /synopsis/i }));

    await waitFor(() =>
      expect(toastService.success).toHaveBeenCalledWith(
        "Synopsis enabled",
        undefined,
      ),
    );
  });

  it("notes the cascaded view in the toast when disabling the timeline fields", async () => {
    setup({ timeline: true, timelineView: true });
    mockFeatureRoute({ timeline: false, timelineView: false });

    fireEvent.click(screen.getByRole("checkbox", { name: /timeline/i }));

    await waitFor(() =>
      expect(toastService.success).toHaveBeenCalledWith(
        "Timeline disabled",
        "Timeline view turned off too.",
      ),
    );
  });

  it("shows an error toast when the update fails", async () => {
    setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /notes/i }));

    await waitFor(() => expect(toastService.error).toHaveBeenCalled());
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it("persists the entities flag when toggled on", async () => {
    const { store } = setup();
    const fetchSpy = mockFeatureRoute({ entities: true });

    fireEvent.click(screen.getByRole("checkbox", { name: /entities/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/project/features");
    expect(JSON.parse(init.body as string)).toEqual({
      projectId: "test",
      features: { entities: true },
    });

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /entities/i })).toBeChecked(),
    );
    expect(
      store.getState().projects.projects["test-project-id"].features,
    ).toEqual({ entities: true });
  });

  it("renders nothing when no project is selected", () => {
    const store = makeStore();
    const { container } = render(
      <Provider store={store}>
        <ProjectFeatureToggles />
      </Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
