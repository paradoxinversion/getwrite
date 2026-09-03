"use client";

/**
 * @module ProjectFeatureToggles
 *
 * Section shown at the top of the Metadata Fields menu that turns the
 * previously-locked built-in metadata features (Timeline, Point of View,
 * Synopsis, Notes, Entities) on or off, co-located with the field definitions
 * they govern. Each toggle reflects the active project's `config.features` state and
 * persists changes via the {@link updateProjectFeatures} thunk. Toggling is
 * available at any time after project creation (FR10); turning a feature off
 * only hides its field — stored values are preserved.
 */

import { useAppDispatch } from "../../src/store/hooks";
import useAppSelector from "../../src/store/hooks";
import {
  selectSelectedProjectId,
  selectActiveProjectFeatures,
  updateProjectFeatures,
} from "../../src/store/projectsSlice";
import type { ProjectFeatureFlags } from "../../src/lib/models/types";
import { hoverTipProps, HoverTipSurface } from "../common/UI/HoverTip";
import { toastService } from "../../src/lib/toast-service";

/** react-tooltip anchor id for the "view depends on these fields" hint. */
const FEATURE_TOOLTIP_ID = "feature-toggle-tip";

/** Display definition for a single feature toggle. */
interface FeatureToggleDef {
  /** Feature flag key in `config.features`. */
  key: keyof ProjectFeatureFlags;
  /** Human-readable label rendered as the control's accessible name. */
  label: string;
  /** Short explanation of what enabling the feature does. */
  description: string;
}

const FEATURE_TOGGLES: readonly FeatureToggleDef[] = [
  {
    key: "timeline",
    label: "Timeline",
    description:
      "Story date, duration, and end-date fields in the sidebar. (The Timeline view itself is toggled in User Preferences.)",
  },
  {
    key: "pov",
    label: "Point of View",
    description: "The point-of-view metadata field and its timeline coloring.",
  },
  {
    key: "synopsis",
    label: "Synopsis",
    description: "The synopsis metadata field in the sidebar.",
  },
  {
    key: "notes",
    label: "Notes",
    description: "The notes metadata field in the sidebar.",
  },
  {
    key: "entities",
    label: "Entities",
    description:
      "The Entity, Entities Mentioned, and Entity Mentions sections in the sidebar.",
  },
];

/**
 * Renders the per-project feature toggles. Returns `null` when no project is
 * selected so the section is omitted entirely rather than rendered empty.
 *
 * @returns The feature-toggle section, or `null` when no project is active.
 */
export default function ProjectFeatureToggles(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const selectedProjectId = useAppSelector(selectSelectedProjectId);
  // Merge changes onto the full current map so unrelated flags (e.g. the
  // separate `timelineView`) are preserved — the route replaces the `features`
  // block wholesale.
  const features = useAppSelector(selectActiveProjectFeatures);

  if (!selectedProjectId) {
    return null;
  }

  // Turning the timeline date fields off would strand the Timeline view (which
  // reads them), so it cascades the view off too. Warn while that would happen.
  const timelineWarning =
    features.timeline === true && features.timelineView === true
      ? "The Timeline view reads these fields — turning them off also turns the view off."
      : undefined;

  /**
   * Persists a single feature change by sending the full, merged feature map
   * (the route replaces the `features` block wholesale), then confirms with a
   * toast (or reports failure).
   *
   * @param key - Feature flag being changed.
   * @param label - Human-readable feature name, used in the toast.
   * @param next - Desired enabled state.
   */
  const handleToggle = async (
    key: keyof ProjectFeatureFlags,
    label: string,
    next: boolean,
  ): Promise<void> => {
    const updated: ProjectFeatureFlags = { ...features, [key]: next };
    // The Timeline view depends on the date fields; disabling the fields takes
    // the view with them (no-op when the view is already off).
    const isCascadesViewOff =
      key === "timeline" && !next && features.timelineView === true;
    if (isCascadesViewOff) {
      updated.timelineView = false;
    }
    try {
      await dispatch(
        updateProjectFeatures({
          projectId: selectedProjectId,
          features: updated,
        }),
      ).unwrap();
      toastService.success(
        `${label} ${next ? "enabled" : "disabled"}`,
        isCascadesViewOff ? "Timeline view turned off too." : undefined,
      );
    } catch (error) {
      toastService.error(
        `Couldn't update ${label}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  };

  return (
    <section className="rounded-lg border-[0.5px] border-gw-border bg-gw-chrome p-5">
      <h2 className="text-sm font-semibold text-gw-primary">
        Built-in features
      </h2>
      <p className="mt-1 text-sm text-gw-secondary">
        Turn the optional built-in fields on or off for this project. Disabling
        one hides its field below and in the sidebar, but keeps any values
        you&rsquo;ve already saved.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {FEATURE_TOGGLES.map(({ key, label, description }) => {
          const tooltip = key === "timeline" ? timelineWarning : undefined;
          return (
            <div key={key}>
              <label
                className="inline-flex items-center gap-2"
                {...hoverTipProps(FEATURE_TOOLTIP_ID, tooltip)}
              >
                <input
                  type="checkbox"
                  checked={features[key] === true}
                  onChange={(event) =>
                    void handleToggle(key, label, event.target.checked)
                  }
                  className="h-4 w-4 rounded border-gw-border"
                />
                <span className="text-sm font-medium text-gw-primary">
                  {label}
                </span>
              </label>
              <p className="ml-6 mt-0.5 text-xs text-gw-secondary">
                {description}
              </p>
            </div>
          );
        })}
      </div>

      {features.entities === true && (
        <div className="mt-4 border-t-[0.5px] border-gw-border pt-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={features.entityHighlighting === true}
              onChange={(event) =>
                void handleToggle(
                  "entityHighlighting",
                  "Entity highlighting",
                  event.target.checked,
                )
              }
              className="h-4 w-4 rounded border-gw-border"
            />
            <span className="text-sm font-medium text-gw-primary">
              Entity highlighting
            </span>
          </label>
          <p className="ml-6 mt-0.5 text-xs text-gw-secondary">
            Highlights entity names and aliases inline in the editor.
          </p>
        </div>
      )}

      {timelineWarning && <HoverTipSurface id={FEATURE_TOOLTIP_ID} />}
    </section>
  );
}
