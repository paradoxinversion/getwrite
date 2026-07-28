import React from "react";
import { Pencil, LayoutList, BarChart3, GitCompare, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "../common/UI/Tabs/Tabs";
import { hoverTipProps, HoverTipSurface } from "../common/UI/HoverTip";
import { ViewName } from "../../src/lib/models/types";

/** Shared react-tooltip anchor id for disabled-view explanations. */
const VIEW_TOOLTIP_ID = "workarea-view-switcher-tip";

export interface ViewSwitcherProps {
  view: ViewName;
  onChange: (view: ViewName) => void;
  className?: string;
  disabledViews?: ViewName[] | (() => ViewName[]);
  /**
   * Optional hover-tooltip text per view, surfaced only while that view is
   * disabled — explains why the tab is off and how to enable it. A disabled
   * `<button>` swallows pointer events, so the trigger is wrapped in a hover
   * target that carries the tooltip.
   */
  disabledReasons?: Partial<Record<ViewName, string>>;
  /**
   * Overrides the label of the "edit" tab. Used to surface media resources as
   * a "Media" tab while reusing the edit view. Defaults to "Edit".
   */
  editLabel?: string;
}

interface ViewOption {
  key: ViewName;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
}

const VIEW_OPTIONS: ViewOption[] = [
  { key: "edit", label: "Edit", icon: Pencil },
  { key: "organizer", label: "Organizer", icon: LayoutList },
  { key: "data", label: "Data", icon: BarChart3 },
  { key: "diff", label: "Diff", icon: GitCompare },
  { key: "timeline", label: "Timeline", icon: Clock },
];

export default function ViewSwitcher({
  view,
  onChange,
  className = "",
  disabledViews = [],
  disabledReasons = {},
  editLabel = "Edit",
}: ViewSwitcherProps): JSX.Element {
  const resolvedDisabledViews =
    typeof disabledViews === "function" ? disabledViews() : disabledViews;
  const hasReason = resolvedDisabledViews.some((v) => disabledReasons[v]);

  return (
    <>
      <Tabs
        value={view}
        onValueChange={(v) => onChange(v as ViewName)}
        className="workarea-view-tabs-scroll"
      >
        <TabsList
          aria-label="Work area views"
          className={`workarea-view-tabs ${className}`}
        >
          {VIEW_OPTIONS.map((opt) => {
            const isDisabled = resolvedDisabledViews.includes(opt.key);
            const reason = isDisabled ? disabledReasons[opt.key] : undefined;
            const trigger = (
              <TabsTrigger
                value={opt.key}
                disabled={isDisabled}
                className="workarea-tab-button border-b-hairline"
              >
                <opt.icon size={14} aria-hidden="true" />
                {opt.key === "edit" ? editLabel : opt.label}
              </TabsTrigger>
            );
            // A disabled <button> swallows pointer events, so wrap it in a
            // hover target that carries the "why it's off" tooltip. The wrapper
            // must stay layout-neutral: `self-stretch` fills the row's cross
            // axis so the inner tab keeps the same height/position as the
            // unwrapped (enabled) tabs.
            return reason ? (
              <span
                key={opt.key}
                className="inline-flex self-stretch"
                {...hoverTipProps(VIEW_TOOLTIP_ID, reason)}
              >
                {trigger}
              </span>
            ) : (
              <React.Fragment key={opt.key}>{trigger}</React.Fragment>
            );
          })}
        </TabsList>
      </Tabs>
      {hasReason && <HoverTipSurface id={VIEW_TOOLTIP_ID} />}
    </>
  );
}
