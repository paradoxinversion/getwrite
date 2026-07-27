// Last Updated: 2026-07-25

/**
 * @module store/transport/native-metadata-schema-backend
 *
 * **ADR-021 Phase 1 (Task 4).** The in-process implementation of
 * {@link MetadataSchemaTransport} for a native (Capacitor) build: instead of
 * `fetch('/api/project/metadata-schema')`, it invokes the *same*
 * transport-agnostic metadata-schema core the HTTP route uses
 * (`lib/models/metadata-schema-dispatch-core.ts`). There is no server and no
 * HTTP — the exact same business logic runs directly in the WebView process.
 *
 * This module is imported *only* on the native path (see
 * `metadata-schema-transport-service.ts`'s dynamic import), because it pulls
 * in the server-side metadata-schema core and storage layer, which must
 * never enter the web client bundle.
 *
 * **Storage context binding.** Every operation runs through the shared
 * `createNativeRunner(deps)` helper (`native-runner.ts`): `deps.fs` (tests)
 * binds a one-off {@link runInStorageContext} scope over the injected fake;
 * in production it awaits the memoized native bootstrap
 * (`ensureNativeStorageContext()` — context bound + projects dir created) and
 * resolves against the ambient default {@link StorageContext}, with no
 * per-operation rebinding.
 */
import { createNativeRunner, type NativeBackendDeps } from "./native-runner";
import { resolveProjectRoot } from "../../lib/models/project-root-resolver";
import {
  dispatchMetadataSchemaAction,
  fetchFieldValues as fetchFieldValuesCore,
  type MetadataSchemaDispatchRequest,
} from "../../lib/models/metadata-schema-dispatch-core";
import type { MetadataSchemaTransport } from "../metadata-schema-transport-service";

/**
 * Resolves `projectId` to its on-disk project root via the shared plain
 * resolver, throwing (rather than returning a `Response`, which the HTTP
 * route does) when `projectId` is not a well-formed UUID.
 */
function resolveProjectRootOrThrow(projectId: string): string {
  const projectRoot = resolveProjectRoot(projectId);
  if (!projectRoot) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
  return projectRoot;
}

/**
 * Builds the in-process metadata-schema transport for a native build.
 *
 * @param deps - Test/injection seam; omit in production.
 */
export function createNativeMetadataSchemaTransport(
  deps: NativeBackendDeps = {},
): MetadataSchemaTransport {
  const run = createNativeRunner(deps);

  async function dispatch(
    context: { projectId: string },
    request: MetadataSchemaDispatchRequest,
  ) {
    return run(async () => {
      const projectRoot = resolveProjectRootOrThrow(context.projectId);
      return dispatchMetadataSchemaAction(projectRoot, request);
    });
  }

  return {
    addField(context, groupId, field) {
      return dispatch(context, { action: "add-field", groupId, field });
    },

    removeField(context, groupId, fieldKey) {
      return dispatch(context, { action: "remove-field", groupId, fieldKey });
    },

    deprecateField(context, groupId, fieldKey) {
      return dispatch(context, {
        action: "deprecate-field",
        groupId,
        fieldKey,
      });
    },

    clearField(context, groupId, fieldKey) {
      return dispatch(context, { action: "clear-field", groupId, fieldKey });
    },

    reorderFields(context, groupId, newKeyOrder) {
      return dispatch(context, {
        action: "reorder-fields",
        groupId,
        newKeyOrder,
      });
    },

    renameField(context, groupId, fieldKey, newLabel) {
      return dispatch(context, {
        action: "rename-field",
        groupId,
        fieldKey,
        newLabel,
      });
    },

    updateFieldOptions(context, groupId, fieldKey, options) {
      return dispatch(context, {
        action: "update-field-options",
        groupId,
        fieldKey,
        options,
      });
    },

    addGroup(context, group) {
      return dispatch(context, { action: "add-group", group });
    },

    removeGroup(context, groupId) {
      return dispatch(context, { action: "remove-group", groupId });
    },

    reorderGroups(context, newGroupIdOrder) {
      return dispatch(context, { action: "reorder-groups", newGroupIdOrder });
    },

    renameFieldKey(context, groupId, fieldKey, newKey) {
      return dispatch(context, {
        action: "rename-key",
        groupId,
        fieldKey,
        newKey,
      });
    },

    changeFieldType(context, groupId, fieldKey, newType) {
      return dispatch(context, {
        action: "change-field-type",
        groupId,
        fieldKey,
        newType,
      });
    },

    updateRefProperties(context, groupId, fieldKey, updates) {
      return dispatch(context, {
        action: "update-ref-properties",
        groupId,
        fieldKey,
        ...updates,
      });
    },

    changeFieldTypeWithMigration(
      context,
      groupId,
      fieldKey,
      newType,
      newOptions,
      migrations,
    ) {
      return dispatch(context, {
        action: "change-field-type-with-migration",
        groupId,
        fieldKey,
        newType,
        newOptions,
        migrations,
      });
    },

    updateFieldOptionsWithMigration(
      context,
      groupId,
      fieldKey,
      newOptions,
      migrations,
    ) {
      return dispatch(context, {
        action: "update-field-options-with-migration",
        groupId,
        fieldKey,
        newOptions,
        migrations,
      });
    },

    async fetchFieldValues(projectId, fieldKey) {
      return run(async () => {
        const projectRoot = resolveProjectRootOrThrow(projectId);
        const result = await fetchFieldValuesCore(projectRoot, fieldKey);
        return result.values;
      });
    },
  };
}
