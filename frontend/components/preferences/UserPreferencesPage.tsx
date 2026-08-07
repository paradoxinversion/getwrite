"use client";

/**
 * @module UserPreferencesPage
 *
 * UI for editing persisted user preferences.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceLocationSettings from "./WorkspaceLocationSettings";
import useAppSelector from "../../src/store/hooks";
import {
  selectProject,
  selectSelectedProjectId,
  selectActiveProjectDirectoryId,
} from "../../src/store/projectsSlice";
import {
  type AppearancePreferences,
  type ColorMode,
  type ColorModePreference,
  type UiDensity,
  DEFAULT_APPEARANCE_PREFERENCES,
  getStoredGlobalAppearancePreferences,
  resolveColorModeFromAppearance,
  resolvePreferredColorMode,
  saveGlobalAppearancePreferences,
  saveGlobalColorMode,
} from "../../src/lib/user-preferences";
import type { MetadataValue } from "../../src/lib/models/types";
import { saveProjectPreferences } from "../../src/lib/api/preferences";
import Button from "../common/UI/Button/Button";
import { DialogTitle } from "../common/UI/Dialog/Dialog";
import TimelineViewToggle from "./TimelineViewToggle";
import OrganizerCardBodySettings from "./OrganizerCardBodySettings";

/**
 * Props accepted by {@link UserPreferencesPage}.
 */
interface UserPreferencesPageProps {
  /** Optional close handler used when rendered as a modal. */
  onClose?: () => void;
  /** Renders without page-level shell wrapper when true. */
  renderInModal?: boolean;
}

/**
 * User preferences page UI.
 *
 * @returns Preferences page element.
 */
export default function UserPreferencesPage({
  onClose,
  renderInModal = false,
}: UserPreferencesPageProps): JSX.Element {
  const router = useRouter();
  const [appearance, setAppearance] = useState<AppearancePreferences>(
    DEFAULT_APPEARANCE_PREFERENCES,
  );
  const selectedProjectId = useAppSelector(selectSelectedProjectId);
  const selectedProject = useAppSelector((state) =>
    selectedProjectId ? selectProject(state, selectedProjectId) : null,
  );
  // Directory basename, not `project.id` (project.json's independently
  // generated internal id) — see `selectActiveProjectDirectoryId`'s doc
  // comment in `projectsSlice.ts`.
  const activeProjectDirectoryId = useAppSelector(
    selectActiveProjectDirectoryId,
  );

  useEffect(() => {
    const metadata = selectedProject?.metadata as
      | Record<string, MetadataValue>
      | undefined;
    const globalAppearance = getStoredGlobalAppearancePreferences();
    const projectMode = resolvePreferredColorMode(metadata);

    setAppearance({
      ...globalAppearance,
      colorModePreference:
        globalAppearance.colorModePreference === "system"
          ? "system"
          : projectMode,
    });
  }, [selectedProject?.id, selectedProject?.metadata]);

  const effectiveMode = resolveColorModeFromAppearance(appearance);
  const isDarkMode = effectiveMode === "dark";

  /**
   * Persists app-wide appearance preferences and synchronizes local state.
   *
   * @param nextAppearance - Next appearance preferences.
   */
  const persistAppearance = (nextAppearance: AppearancePreferences): void => {
    setAppearance(nextAppearance);
    saveGlobalAppearancePreferences(nextAppearance);
  };

  /**
   * Persists and updates color mode preference.
   *
   * @param nextMode - Selected color mode.
   */
  const handleColorModeChange = async (
    nextPreference: ColorModePreference,
  ): Promise<void> => {
    const nextAppearance: AppearancePreferences = {
      ...appearance,
      colorModePreference: nextPreference,
    };
    persistAppearance(nextAppearance);

    const nextMode: ColorMode = resolveColorModeFromAppearance(nextAppearance);
    saveGlobalColorMode(nextMode);

    if (!activeProjectDirectoryId) {
      return;
    }

    await saveProjectPreferences(activeProjectDirectoryId, {
      colorMode: nextMode,
    });
  };

  /**
   * Closes preferences and returns to previous page when possible.
   */
  const handleClose = (): void => {
    if (onClose) {
      onClose();
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  };

  const content = (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 lg:px-10">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {renderInModal ? (
            <DialogTitle asChild>
              <h1 className="text-2xl font-semibold text-gw-primary">
                User Preferences
              </h1>
            </DialogTitle>
          ) : (
            <h1 className="text-2xl font-semibold text-gw-primary">
              User Preferences
            </h1>
          )}
          <p className="text-sm text-gw-secondary">
            Personal settings stored in the selected project&apos;s metadata.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleClose}>
          Close
        </Button>
      </header>

      <WorkspaceLocationSettings />

      <section className="rounded-lg border-[0.5px] border-gw-border bg-gw-chrome p-5">
        <h2 className="text-sm font-semibold text-gw-primary">Theme</h2>
        <p className="mt-1 text-sm text-gw-secondary">
          Choose the default UI appearance mode.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => handleColorModeChange("light")}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              appearance.colorModePreference === "light"
                ? "border-gw-border-md bg-gw-chrome2 text-gw-primary"
                : "border-gw-border bg-transparent text-gw-secondary hover:bg-gw-chrome2"
            }`}
            aria-pressed={appearance.colorModePreference === "light"}
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => handleColorModeChange("dark")}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              appearance.colorModePreference === "dark"
                ? "border-gw-border-md bg-gw-chrome2 text-gw-primary"
                : "border-gw-border bg-transparent text-gw-secondary hover:bg-gw-chrome2"
            }`}
            aria-pressed={appearance.colorModePreference === "dark"}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => handleColorModeChange("system")}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              appearance.colorModePreference === "system"
                ? "border-gw-border-md bg-gw-chrome2 text-gw-primary"
                : "border-gw-border bg-transparent text-gw-secondary hover:bg-gw-chrome2"
            }`}
            aria-pressed={appearance.colorModePreference === "system"}
          >
            System
          </button>
        </div>

        <div className="mt-6 border-t border-gw-border pt-5">
          <h3 className="text-sm font-semibold text-gw-primary">Density</h3>
          <p className="mt-1 text-sm text-gw-secondary">
            Control spacing density across app layouts.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["comfortable", "Comfortable"],
                ["compact", "Compact"],
              ] as Array<[UiDensity, string]>
            ).map(([densityValue, densityLabel]) => (
              <button
                key={densityValue}
                type="button"
                onClick={() => {
                  persistAppearance({ ...appearance, density: densityValue });
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  appearance.density === densityValue
                    ? "border-gw-border-md bg-gw-chrome2 text-gw-primary"
                    : "border-gw-border bg-transparent text-gw-secondary hover:bg-gw-chrome2"
                }`}
                aria-pressed={appearance.density === densityValue}
              >
                {densityLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-gw-border pt-5">
          <h3 className="text-sm font-semibold text-gw-primary">Motion</h3>
          <p className="mt-1 text-sm text-gw-secondary">
            Reduce non-essential motion and transitions.
          </p>
          <label className="mt-4 inline-flex items-center gap-2 text-sm text-gw-secondary">
            <input
              type="checkbox"
              checked={appearance.reducedMotion}
              onChange={(event) => {
                persistAppearance({
                  ...appearance,
                  reducedMotion: event.target.checked,
                });
              }}
              className="h-4 w-4 rounded border-gw-border"
            />
            Enable reduced motion
          </label>
        </div>
      </section>

      <TimelineViewToggle />

      <OrganizerCardBodySettings />
    </main>
  );

  if (renderInModal) {
    return content;
  }

  return (
    <div
      className={`appshell-shell ${isDarkMode ? "appshell-theme-dark" : ""}`}
    >
      {content}
    </div>
  );
}
