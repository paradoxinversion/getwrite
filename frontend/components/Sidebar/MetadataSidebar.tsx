import React from "react";
import type { Resource } from "../../lib/types";
import NotesInput from "./controls/NotesInput";
import StatusSelector from "./controls/StatusSelector";
import MultiSelectList from "./controls/MultiSelectList";
import POVAutocomplete from "./controls/POVAutocomplete";

export interface MetadataSidebarProps {
    resource?: Resource;
    onChangeNotes?: (text: string) => void;
    onChangeStatus?: (status: string) => void;
    onChangeCharacters?: (chars: string[]) => void;
    onChangeLocations?: (locs: string[]) => void;
    onChangeItems?: (items: string[]) => void;
    onChangePOV?: (pov: string) => void;
    className?: string;
}

export default function MetadataSidebar({
    resource,
    onChangeNotes,
    onChangeStatus,
    onChangeCharacters,
    onChangeLocations,
    onChangeItems,
    onChangePOV,
    className = "",
}: MetadataSidebarProps): JSX.Element {
    const [notes, setNotes] = React.useState(resource?.metadata?.notes ?? "");
    const [status, setStatus] = React.useState(
        (resource?.metadata?.status as string) ?? "draft",
    );
    const [characters, setCharacters] = React.useState<string[]>(
        resource?.metadata?.characters ?? [],
    );
    const [locations, setLocations] = React.useState<string[]>(
        resource?.metadata?.locations ?? [],
    );
    const [items, setItems] = React.useState<string[]>(
        resource?.metadata?.items ?? [],
    );
    const [pov, setPOV] = React.useState<string | null>(
        resource?.metadata?.pov ?? null,
    );

    React.useEffect(() => {
        setNotes(resource?.metadata?.notes ?? "");
        setStatus((resource?.metadata?.status as string) ?? "draft");
        setCharacters(resource?.metadata?.characters ?? []);
        setLocations(resource?.metadata?.locations ?? []);
        setItems(resource?.metadata?.items ?? []);
        setPOV(resource?.metadata?.pov ?? null);
    }, [resource]);

    // Fallback sample lists when metadata arrays are empty
    const sampleCharacters = characters.length ? characters : ["Alice", "Bob"];
    const sampleLocations = locations.length ? locations : ["Town", "Forest"];
    const sampleItems = items.length ? items : ["Key", "Map"];

    return (
        <aside
            className={`p-4 bg-white ${className}`}
            aria-label="metadata-sidebar"
        >
            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">
                    Notes
                </h4>
                <NotesInput
                    ariaLabel="notes"
                    value={notes}
                    onChange={(v) => {
                        setNotes(v);
                        onChangeNotes && onChangeNotes(v);
                    }}
                />
            </div>

            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">
                    Status
                </h4>
                <StatusSelector
                    ariaLabel="status"
                    value={status}
                    onChange={(s) => {
                        setStatus(s);
                        onChangeStatus && onChangeStatus(s);
                    }}
                />
            </div>

            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">
                    Characters
                </h4>
                <MultiSelectList
                    label="Characters"
                    items={sampleCharacters}
                    selected={characters}
                    onChange={(next) => {
                        setCharacters(next);
                        onChangeCharacters && onChangeCharacters(next);
                    }}
                />
            </div>

            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">
                    Locations
                </h4>
                <MultiSelectList
                    label="Locations"
                    items={sampleLocations}
                    selected={locations}
                    onChange={(next) => {
                        setLocations(next);
                        onChangeLocations && onChangeLocations(next);
                    }}
                />
            </div>

            <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">
                    Items
                </h4>
                <MultiSelectList
                    label="Items"
                    items={sampleItems}
                    selected={items}
                    onChange={(next) => {
                        setItems(next);
                        onChangeItems && onChangeItems(next);
                    }}
                />
            </div>

            <div>
                <h4 className="text-xs font-semibold text-slate-600 mb-2">
                    POV
                </h4>
                <POVAutocomplete
                    options={sampleCharacters}
                    value={pov ?? ""}
                    onChange={(v) => {
                        setPOV(v);
                        onChangePOV && onChangePOV(v);
                    }}
                />
            </div>
        </aside>
    );
}
