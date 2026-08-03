// Last Updated: 2026-08-03

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as io from "../../src/lib/models/io";
import type { StorageAdapter } from "../../src/lib/models/io";
import { createMemoryAdapter } from "../../src/lib/models/memoryAdapter";
import { runInStorageContext } from "../../src/lib/models/storage-context";
import { __resetWriteBarriersForTests } from "../../src/lib/models/write-barrier";
import { isEnvelope } from "../../src/lib/models/crypto/envelope";
import { runInProjectContext } from "../../src/lib/models/crypto/adapter-selection";
import {
  __resetKeyringSessionForTests,
  requireSessionKeyring,
} from "../../src/lib/models/crypto/keyring-session";
import { enableProjectEncryption } from "../../src/lib/models/crypto/enable-encryption";
import {
  getTemplateChanges,
  recordTemplateChange,
} from "../../src/lib/models/resource-templates";
import type { ResourceTemplate } from "../../src/lib/models/resource-templates";

const WORKSPACE = "/ws";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ROOT = `${WORKSPACE}/${PROJECT_ID}`;
const TEMPLATE_ID = "chapter-template";
const LOG = `${ROOT}/meta/templates/${TEMPLATE_ID}.changes.jsonl`;

let adapter: StorageAdapter;
const previousAdapter = io.getStorageAdapter();

function template(name: string): ResourceTemplate {
  return { id: TEMPLATE_ID, name, type: "text" } as unknown as ResourceTemplate;
}

/** Runs template work inside the project's own storage context. */
function inProject<T>(fn: () => Promise<T>): Promise<T> {
  return runInProjectContext(ROOT, requireSessionKeyring(), fn, adapter);
}

beforeEach(async () => {
  adapter = createMemoryAdapter();
  io.setStorageAdapter(adapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
  await adapter.mkdir(`${ROOT}/meta/templates`, { recursive: true });
  await adapter.writeFile(
    `${ROOT}/project.json`,
    '{"id":"abc","name":"The Whistleblower","createdAt":"2026-01-01T00:00:00.000Z"}',
  );
  await runInStorageContext({ tenantRoot: WORKSPACE, adapter }, () =>
    enableProjectEncryption({
      projectId: PROJECT_ID,
      projectName: "The Whistleblower",
      passphrase: "correct horse battery staple",
      workspaceRoot: WORKSPACE,
      adapter,
    }),
  );
});

afterEach(() => {
  io.setStorageAdapter(previousAdapter);
  __resetKeyringSessionForTests();
  __resetWriteBarriersForTests();
});

describe("template change log on an encrypted project", () => {
  it("appends across calls and reads every entry back", async () => {
    // The one real appendFile caller in the model layer.
    await inProject(() =>
      recordTemplateChange(ROOT, TEMPLATE_ID, null, template("Chapter")),
    );
    await inProject(() =>
      recordTemplateChange(
        ROOT,
        TEMPLATE_ID,
        template("Chapter"),
        template("Chapter Two"),
      ),
    );

    const entries = await inProject(() =>
      getTemplateChanges(ROOT, TEMPLATE_ID),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("create");
    expect(entries[1].action).toBe("edit");
  });

  it("leaves the log sealed, never appending plaintext", async () => {
    await inProject(() =>
      recordTemplateChange(ROOT, TEMPLATE_ID, null, template("Chapter")),
    );
    await inProject(() =>
      recordTemplateChange(
        ROOT,
        TEMPLATE_ID,
        template("Chapter"),
        template("Chapter Two"),
      ),
    );

    const raw = Buffer.from(await adapter.readFileBuffer(LOG));
    expect(isEnvelope(raw)).toBe(true);
    // A second append must re-seal the whole file, not tack plaintext on.
    expect(raw.includes(Buffer.from("action"))).toBe(false);
    expect(raw.includes(Buffer.from("edit"))).toBe(false);
  });
});
