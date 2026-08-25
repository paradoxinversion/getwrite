import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { Provider } from "react-redux";
import MetadataSidebar from "../components/Sidebar/MetadataSidebar";
import {
  createTextResource,
  createImageResource,
  createAudioResource,
} from "../src/lib/models/resource";
import { makeStore } from "../src/store/store";
import {
  setResources,
  setSelectedResourceId,
  updateResource,
} from "../src/store/resourcesSlice";
import { setProject, setSelectedProjectId } from "../src/store/projectsSlice";
import { DEFAULT_METADATA_SCHEMA } from "../src/lib/models/default-metadata-schema";
import type {
  MetadataSchema,
  MetadataValue,
  ProjectFeatureFlags,
} from "../src/lib/models/types";

function setupMultiRefSidebar({
  fieldKey = "refs-field",
  fieldLabel = "Refs",
  refFolder,
  maxSelections,
  userMetadata = {},
  extraResources = [] as ReturnType<typeof createTextResource>[],
}: {
  fieldKey?: string;
  fieldLabel?: string;
  refFolder?: string;
  maxSelections?: number;
  userMetadata?: Record<string, MetadataValue>;
  extraResources?: ReturnType<typeof createTextResource>[];
} = {}) {
  const customSchema: MetadataSchema = {
    groups: [
      {
        id: "custom-group",
        label: "Custom Group",
        fields: [
          {
            key: fieldKey,
            label: fieldLabel,
            type: "multi-resource-ref",
            ...(refFolder !== undefined ? { refFolder } : {}),
            ...(maxSelections !== undefined ? { maxSelections } : {}),
          },
        ],
      },
    ],
  };
  const res = createTextResource({
    name: "Scene",
    plainText: "",
    userMetadata,
  });
  const testStore = makeStore();
  const projectId = "test-project-id";
  testStore.dispatch(
    setProject({
      id: projectId,
      rootPath: "/test",
      metadataSchema: customSchema,
    }),
  );
  testStore.dispatch(setSelectedProjectId(projectId));
  testStore.dispatch(setResources([res, ...extraResources]));
  testStore.dispatch(setSelectedResourceId(res.id));
  return { testStore, res, projectId };
}

describe("MetadataSidebar", () => {
  it("renders story date/duration controls and invokes onChangeField", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { storyDate: "2024-06-01", storyDuration: 90 },
    });
    const onChangeField = vi.fn();

    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { timeline: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar onChangeField={onChangeField} />
      </Provider>,
    );

    const dateInput = screen.getByLabelText(
      "story-date-input",
    ) as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(dateInput.value).toBe("2024-06-01");

    const durationQty = screen.getByLabelText(
      "story-duration-quantity",
    ) as HTMLInputElement;
    expect(durationQty).toBeInTheDocument();
    expect(durationQty.value).toBe("90");

    fireEvent.change(dateInput, { target: { value: "2024-07-15" } });
    expect(onChangeField).toHaveBeenCalledWith("storyDate", "2024-07-15");

    fireEvent.change(durationQty, { target: { value: "120" } });
    expect(onChangeField).toHaveBeenCalledWith("storyDuration", 120);
  });

  it("shows computed end date when storyDate and storyDuration are set", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { storyDate: "2024-06-01", storyDuration: 120 },
    });

    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { timeline: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    expect(
      screen.getByLabelText("end-date-override-toggle"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("story-end-date-input"),
    ).not.toBeInTheDocument();
  });

  it("calls onChangeField for storyEndDate when user overrides the end date", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { storyDate: "2024-06-01", storyDuration: 120 },
    });
    const onChangeField = vi.fn();

    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { timeline: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar onChangeField={onChangeField} />
      </Provider>,
    );

    fireEvent.click(screen.getByLabelText("end-date-override-toggle"));
    fireEvent.change(screen.getByLabelText("story-end-date-input"), {
      target: { value: "2024-06-01T06:00" },
    });
    expect(onChangeField).toHaveBeenCalledWith(
      "storyEndDate",
      "2024-06-01T06:00",
    );
  });

  it("shows editable end date input when storyEndDate override is already set", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: {
        storyDate: "2024-06-01",
        storyDuration: 120,
        storyEndDate: "2024-06-01T04:00",
      },
    });

    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { timeline: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    const input = screen.getByLabelText(
      "story-end-date-input",
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("2024-06-01T04:00");
  });

  it("renders synopsis input with initial value from userMetadata", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { synopsis: "A duel at dawn." },
    });

    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { synopsis: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    const synopsis = screen.getByLabelText("synopsis") as HTMLTextAreaElement;
    expect(synopsis).toBeInTheDocument();
    expect(synopsis.value).toBe("A duel at dawn.");
  });

  it("calls onChangeField with key 'synopsis' when synopsis changes", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { synopsis: "" },
    });
    const onChangeField = vi.fn();

    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { synopsis: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar onChangeField={onChangeField} />
      </Provider>,
    );

    const synopsis = screen.getByLabelText("synopsis") as HTMLTextAreaElement;
    fireEvent.change(synopsis, { target: { value: "A new synopsis." } });
    expect(onChangeField).toHaveBeenCalledWith("synopsis", "A new synopsis.");
  });

  it("renders schema group sections as collapsible headings", () => {
    const res = createTextResource({ name: "Scene", plainText: "" });
    const testStore = makeStore();
    testStore.dispatch(
      setProject({
        id: "p",
        rootPath: "/test",
        features: { timeline: true, synopsis: true, notes: true, pov: true },
      }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    expect(
      screen.getByRole("button", { name: /document/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /timeline/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tags/i })).toBeInTheDocument();
  });

  it("collapses the Document section and hides synopsis and notes", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { synopsis: "A duel at dawn." },
    });
    const testStore = makeStore();
    testStore.dispatch(
      setProject({
        id: "p",
        rootPath: "/test",
        features: { synopsis: true, notes: true },
      }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    expect(screen.getByLabelText("synopsis")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /document/i }));
    expect(screen.queryByLabelText("synopsis")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("notes")).not.toBeInTheDocument();
  });

  it("expands the Document section again when its header is clicked twice", () => {
    const res = createTextResource({ name: "Scene", plainText: "" });
    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { notes: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    const docBtn = screen.getByRole("button", { name: /document/i });
    fireEvent.click(docBtn);
    expect(screen.queryByLabelText("notes")).not.toBeInTheDocument();
    fireEvent.click(docBtn);
    expect(screen.getByLabelText("notes")).toBeInTheDocument();
  });

  it("collapses the Timeline section and hides all three inputs", () => {
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { storyDate: "2024-06-01", storyDuration: 90 },
    });
    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { timeline: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    expect(screen.getByLabelText("story-date-input")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /timeline/i }));
    expect(screen.queryByLabelText("story-date-input")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("story-duration-quantity"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("end-date-override-toggle"),
    ).not.toBeInTheDocument();
  });

  it("calls onChangeField for notes and status", () => {
    const res = createTextResource({
      name: "Notes",
      plainText: "",
      userMetadata: { notes: "", status: "draft" },
    });
    const onChangeField = vi.fn();

    const testStore = makeStore();
    const projectId = "test-project-id";
    testStore.dispatch(
      setProject({
        id: projectId,
        rootPath: "/test",
        statuses: ["draft", "review", "published"],
        features: { notes: true },
      }),
    );
    testStore.dispatch(setSelectedProjectId(projectId));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar onChangeField={onChangeField} />
      </Provider>,
    );

    const notes = screen.getByLabelText("notes") as HTMLTextAreaElement;
    expect(notes).toBeInTheDocument();

    const status = screen.getByLabelText("status") as HTMLSelectElement;
    expect(status).toBeInTheDocument();

    fireEvent.change(notes, { target: { value: "Updated notes" } });
    expect(onChangeField).toHaveBeenCalledWith("notes", "Updated notes");

    fireEvent.change(status, { target: { value: "review" } });
    expect(onChangeField).toHaveBeenCalledWith("status", "review");
  });

  it("renders a custom text field when present in schema", () => {
    const customSchema: MetadataSchema = {
      groups: [
        {
          id: "custom-group",
          label: "Custom Group",
          fields: [{ key: "my-field", label: "My Custom Field", type: "text" }],
        },
      ],
    };
    const res = createTextResource({ name: "Scene", plainText: "" });
    const testStore = makeStore();
    const projectId = "test-project-id";
    testStore.dispatch(
      setProject({
        id: projectId,
        rootPath: "/test",
        metadataSchema: customSchema,
      }),
    );
    testStore.dispatch(setSelectedProjectId(projectId));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    expect(
      screen.getByRole("button", { name: /custom group/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("my-field")).toBeInTheDocument();
  });

  it("calls onChangeField with custom field key for a custom text field", () => {
    const customSchema: MetadataSchema = {
      groups: [
        {
          id: "custom-group",
          label: "Custom Group",
          fields: [{ key: "my-field", label: "My Custom Field", type: "text" }],
        },
      ],
    };
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: { "my-field": "" },
    });
    const onChangeField = vi.fn();

    const testStore = makeStore();
    const projectId = "test-project-id";
    testStore.dispatch(
      setProject({
        id: projectId,
        rootPath: "/test",
        metadataSchema: customSchema,
      }),
    );
    testStore.dispatch(setSelectedProjectId(projectId));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar onChangeField={onChangeField} />
      </Provider>,
    );

    const input = screen.getByLabelText("my-field");
    fireEvent.change(input, { target: { value: "custom value" } });
    expect(onChangeField).toHaveBeenCalledWith("my-field", "custom value");
  });

  it("does not render a folder-scoped group when resource folderId does not match", () => {
    const customSchema: MetadataSchema = {
      groups: [
        {
          id: "folder-group",
          label: "Folder Group",
          folderId: "folder-abc",
          fields: [
            { key: "folder-field", label: "Folder Field", type: "text" },
          ],
        },
      ],
    };
    const res = createTextResource({ name: "Scene", plainText: "" });
    // Resource has no folderId (root-level), so group should be skipped
    const testStore = makeStore();
    const projectId = "test-project-id";
    testStore.dispatch(
      setProject({
        id: projectId,
        rootPath: "/test",
        metadataSchema: customSchema,
      }),
    );
    testStore.dispatch(setSelectedProjectId(projectId));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    expect(
      screen.queryByRole("button", { name: /folder group/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a folder-scoped group when resource folderId matches", () => {
    const customSchema: MetadataSchema = {
      groups: [
        {
          id: "folder-group",
          label: "Folder Group",
          folderId: "folder-abc",
          fields: [
            { key: "folder-field", label: "Folder Field", type: "text" },
          ],
        },
      ],
    };
    const res = createTextResource({ name: "Scene", plainText: "" });
    const resWithFolder = { ...res, folderId: "folder-abc" };

    const testStore = makeStore();
    const projectId = "test-project-id";
    testStore.dispatch(
      setProject({
        id: projectId,
        rootPath: "/test",
        metadataSchema: customSchema,
      }),
    );
    testStore.dispatch(setSelectedProjectId(projectId));
    testStore.dispatch(setResources([resWithFolder as any]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    expect(
      screen.getByRole("button", { name: /folder group/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("folder-field")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Add field footer button (Task 11)
// ---------------------------------------------------------------------------

describe("MetadataSidebar — Add field footer button (Task 11)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupWithProject(schema?: MetadataSchema) {
    const testStore = makeStore();
    const projectId = "proj-add-field";
    testStore.dispatch(
      setProject({
        id: projectId,
        rootPath: "/projects/proj-add-field",
        metadataSchema: schema ?? DEFAULT_METADATA_SCHEMA,
      }),
    );
    testStore.dispatch(setSelectedProjectId(projectId));
    const res = createTextResource({ name: "Scene", plainText: "" });
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    return { testStore, projectId, res };
  }

  it("renders the 'Add field' button when a text resource is selected", () => {
    const { testStore } = setupWithProject();
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByLabelText("add-metadata-field")).toBeInTheDocument();
  });

  it("dispatches addMetadataField with first group id and a generated key on click", async () => {
    const { testStore, projectId } = setupWithProject();

    const returnedSchema: MetadataSchema = {
      groups: [
        {
          id: DEFAULT_METADATA_SCHEMA.groups[0].id,
          label: DEFAULT_METADATA_SCHEMA.groups[0].label,
          fields: [
            ...DEFAULT_METADATA_SCHEMA.groups[0].fields,
            { key: "field-12345", label: "New Field", type: "text" },
          ],
        },
        DEFAULT_METADATA_SCHEMA.groups[1],
      ],
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        try {
          const body = JSON.parse((init as RequestInit).body as string);
          if (body.action === "add-field") {
            return new Response(JSON.stringify({ schema: returnedSchema }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch {
          // not a JSON body — fall through
        }
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );

    // Click opens the AddFieldForm inline mini-form (Task 20)
    fireEvent.click(screen.getByLabelText("add-metadata-field"));

    // Fill in a name and submit the form
    const nameInput = screen.getByLabelText("field-name");
    fireEvent.change(nameInput, { target: { value: "new field" } });
    fireEvent.submit(nameInput.closest("form")!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/project/metadata-schema",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"action":"add-field"'),
        }),
      );
    });

    const addFieldCall = fetchSpy.mock.calls.find(([, init]) => {
      try {
        const b = JSON.parse((init as RequestInit).body as string);
        return b.action === "add-field";
      } catch {
        return false;
      }
    });
    expect(addFieldCall).toBeDefined();
    const body = JSON.parse((addFieldCall![1] as RequestInit).body as string);
    expect(body.action).toBe("add-field");
    expect(body.projectId).toBe("proj-add-field");
    expect(body.groupId).toBe(DEFAULT_METADATA_SCHEMA.groups[0].id);
    expect(body.field.type).toBe("text");
    expect(body.field.label).toBe("New Field");
    expect(body.field.key).toBe("new-field");
    expect(body.field.locked).toBeUndefined();

    // After API resolves the new field should appear in the sidebar
    await waitFor(() => {
      expect(screen.getByLabelText("field-12345")).toBeInTheDocument();
    });

    void projectId;
  });

  it("is disabled when no project is selected", () => {
    const testStore = makeStore();
    const res = createTextResource({ name: "Scene", plainText: "" });
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    const btn = screen.getByLabelText(
      "add-metadata-field",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// multi-resource-ref field wiring (Task 7)
// ---------------------------------------------------------------------------

describe("MetadataSidebar — multi-resource-ref field", () => {
  it("renders MultiResourceRefInput for a multi-resource-ref field", () => {
    const { testStore } = setupMultiRefSidebar();
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(
      screen.getByLabelText("multi-resource-ref-input"),
    ).toBeInTheDocument();
  });

  it("loads an existing ResourceRef[] sidecar value as chips", () => {
    const optionRes = createTextResource({ name: "Alice", plainText: "" });
    const { testStore } = setupMultiRefSidebar({
      userMetadata: { "refs-field": [{ id: optionRes.id, name: "Alice" }] },
      extraResources: [optionRes],
    });
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByRole("button", { name: "Alice" })).toBeInTheDocument();
  });

  it("calls onChangeField with ResourceRef[] when a ref is added via Enter", () => {
    const optionRes = createTextResource({ name: "Alice", plainText: "" });
    const onChangeField = vi.fn();
    const { testStore } = setupMultiRefSidebar({ extraResources: [optionRes] });
    render(
      <Provider store={testStore}>
        <MetadataSidebar onChangeField={onChangeField} />
      </Provider>,
    );

    const input = screen.getByLabelText("multi-resource-ref-input");
    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChangeField).toHaveBeenCalledWith("refs-field", [
      { id: optionRes.id, name: "Alice" },
    ]);
  });

  it("renders without crashing when sidecar contains a ResourceRef missing the name field", () => {
    // Malformed sidecar data: a ref object with no `name` property.
    // Previously this was silently tolerated by ResourceRefInput (via string join),
    // but MultiResourceRefInput calls r.name.toLowerCase() which would crash.
    // createTextResource validates via Zod, so we inject bad data via updateResource
    // after store setup to bypass schema validation — simulating a corrupt sidecar.
    const { testStore, res } = setupMultiRefSidebar();
    testStore.dispatch(
      updateResource({
        id: res.id,
        userMetadata: {
          "refs-field": [{ id: "uuid-bad" }] as unknown as MetadataValue,
        },
      }),
    );
    expect(() =>
      render(
        <Provider store={testStore}>
          <MetadataSidebar />
        </Provider>,
      ),
    ).not.toThrow();
    // Malformed ref is filtered out — input is present but no chip buttons
    expect(
      screen.getByLabelText("multi-resource-ref-input"),
    ).toBeInTheDocument();
    // Chips render as buttons with visible label text; none should be present
    expect(screen.queryByRole("button", { name: /uuid-bad/i })).toBeNull();
  });
});

describe("MetadataSidebar — media resource display", () => {
  it("shows image dimensions for an image resource with width and height", () => {
    const res = createImageResource({
      name: "Cover Photo",
      width: 1920,
      height: 1080,
    });
    const testStore = makeStore();
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByText(/1920/)).toBeInTheDocument();
    expect(screen.getByText(/1080/)).toBeInTheDocument();
  });

  it("shows EXIF fields when an image resource has exif data", () => {
    const res = createImageResource({
      name: "Sunset",
      width: 800,
      height: 600,
      exif: { Make: "Canon", Model: "EOS R5" },
    });
    const testStore = makeStore();
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByText("Canon")).toBeInTheDocument();
    expect(screen.getByText("EOS R5")).toBeInTheDocument();
  });

  it("shows duration and format for an audio resource", () => {
    const res = createAudioResource({
      name: "Intro Music",
      durationSeconds: 83,
      format: "mp3",
    });
    const testStore = makeStore();
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByText("MP3")).toBeInTheDocument();
    expect(screen.getByText("1m 23s")).toBeInTheDocument();
  });

  it("shows only format when audio has no duration", () => {
    const res = createAudioResource({ name: "Track", format: "wav" });
    const testStore = makeStore();
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByText("WAV")).toBeInTheDocument();
  });

  it("shows the editable schema metadata editor for image resources", () => {
    const res = createImageResource({ name: "Banner", width: 100, height: 50 });
    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { synopsis: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    // Editable schema fields + add-field affordance are available, like text
    expect(screen.getByLabelText("synopsis")).toBeInTheDocument();
    expect(screen.getByLabelText("add-metadata-field")).toBeInTheDocument();
    // The read-only image section still renders alongside the editor
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it("invokes onChangeField when editing a custom field on an image resource", () => {
    const res = createImageResource({ name: "Banner" });
    const onChangeField = vi.fn();
    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { synopsis: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar onChangeField={onChangeField} />
      </Provider>,
    );
    const synopsis = screen.getByLabelText("synopsis") as HTMLTextAreaElement;
    fireEvent.change(synopsis, { target: { value: "A striking banner." } });
    expect(onChangeField).toHaveBeenCalledWith(
      "synopsis",
      "A striking banner.",
    );
  });

  it("shows the editable schema metadata editor for audio resources", () => {
    const res = createAudioResource({ name: "Theme", format: "mp3" });
    const testStore = makeStore();
    testStore.dispatch(
      setProject({ id: "p", rootPath: "/test", features: { synopsis: true } }),
    );
    testStore.dispatch(setSelectedProjectId("p"));
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByLabelText("synopsis")).toBeInTheDocument();
    expect(screen.getByLabelText("add-metadata-field")).toBeInTheDocument();
    expect(screen.getByText("MP3")).toBeInTheDocument();
  });

  it("formats hours correctly for long audio tracks", () => {
    const res = createAudioResource({
      name: "Audiobook",
      durationSeconds: 3723,
      format: "m4a",
    });
    const testStore = makeStore();
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    expect(screen.getByText("1h 2m 3s")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Feature gating (Task 7)
// ---------------------------------------------------------------------------

describe("MetadataSidebar — feature gating (Task 7)", () => {
  function renderSidebar(options: {
    features?: ProjectFeatureFlags;
    userMetadata?: Record<string, MetadataValue>;
  }) {
    const testStore = makeStore();
    const projectId = "gating-project";
    testStore.dispatch(
      setProject({
        id: projectId,
        rootPath: "/test",
        ...(options.features ? { features: options.features } : {}),
      }),
    );
    testStore.dispatch(setSelectedProjectId(projectId));
    const res = createTextResource({
      name: "Scene",
      plainText: "",
      userMetadata: options.userMetadata ?? {},
    });
    testStore.dispatch(setResources([res]));
    testStore.dispatch(setSelectedResourceId(res.id));
    const utils = render(
      <Provider store={testStore}>
        <MetadataSidebar />
      </Provider>,
    );
    return { testStore, res, projectId, ...utils };
  }

  it("hides synopsis, notes, and pov controls when their features are disabled", () => {
    renderSidebar({
      features: {},
      userMetadata: { synopsis: "kept", notes: "kept", pov: "kept" },
    });
    expect(screen.queryByLabelText("synopsis")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("notes")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("pov-input")).not.toBeInTheDocument();
    // status is not feature-gated and remains in the Document group.
    expect(screen.getByLabelText("status")).toBeInTheDocument();
  });

  it("renders synopsis, notes, and pov controls when their features are enabled", () => {
    renderSidebar({
      features: { synopsis: true, notes: true, pov: true },
      userMetadata: { synopsis: "A duel at dawn." },
    });
    expect(screen.getByLabelText("synopsis")).toBeInTheDocument();
    expect(screen.getByLabelText("notes")).toBeInTheDocument();
    expect(screen.getByLabelText("pov-input")).toBeInTheDocument();
  });

  it("hides the entire Timeline group when timeline is disabled", () => {
    renderSidebar({
      features: {},
      userMetadata: { storyDate: "2024-06-01", storyDuration: 90 },
    });
    expect(screen.queryByLabelText("story-date-input")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("story-duration-quantity"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /timeline/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the Timeline group when timeline is enabled", () => {
    renderSidebar({
      features: { timeline: true },
      userMetadata: { storyDate: "2024-06-01", storyDuration: 90 },
    });
    expect(
      screen.getByRole("button", { name: /timeline/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("story-date-input")).toBeInTheDocument();
  });

  it("gates each feature independently", () => {
    renderSidebar({
      features: { synopsis: true, notes: false },
      userMetadata: { synopsis: "shown", notes: "hidden" },
    });
    expect(screen.getByLabelText("synopsis")).toBeInTheDocument();
    expect(screen.queryByLabelText("notes")).not.toBeInTheDocument();
  });

  it("preserves a stored value across a disable -> enable cycle", () => {
    const { testStore, projectId } = renderSidebar({
      features: {},
      userMetadata: { synopsis: "Stored synopsis." },
    });
    // Disabled: control absent, but the value lives untouched in the sidecar.
    expect(screen.queryByLabelText("synopsis")).not.toBeInTheDocument();

    // Re-enable the feature without mutating the resource.
    act(() => {
      testStore.dispatch(
        setProject({
          id: projectId,
          rootPath: "/test",
          features: { synopsis: true },
        }),
      );
    });

    const synopsis = screen.getByLabelText("synopsis") as HTMLTextAreaElement;
    expect(synopsis).toBeInTheDocument();
    expect(synopsis.value).toBe("Stored synopsis.");
  });

  it("hides the Entity, Entities Mentioned, and Entity Mentions sections by default", () => {
    renderSidebar({ features: {} });
    expect(
      screen.queryByRole("button", { name: /^entity$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /entities mentioned/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /entity mentions/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the Entity, Entities Mentioned, and Entity Mentions sections when the entities feature is enabled", () => {
    renderSidebar({ features: { entities: true } });
    expect(
      screen.getByRole("button", { name: /^entity$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /entities mentioned/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /entity mentions/i }),
    ).toBeInTheDocument();
  });
});
