import React, { useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

export interface TinyMCEEditorProps {
    value?: string;
    onChange?: (content: string) => void;
    apiKey?: string;
    id?: string;
    readonly?: boolean;
}

/**
 * Thin wrapper around TinyMCE for placeholder editing in the UI.
 * - forwards `value` and calls `onChange(content)` on editor changes
 * - configures a small plugin/toolset suitable for placeholder editing
 * - disables branding and uses autoresize plugin
 *
 * Note: `apiKey` is forwarded to TinyMCE if provided.
 */
export default function TinyMCEEditor({
    value = "",
    onChange,
    apiKey,
    id,
    readonly = false,
}: TinyMCEEditorProps) {
    const handleChange = (content: string) => {
        if (onChange) onChange(content);
    };
    const [ready, setReady] = useState(false);
    const [scriptSrc, setScriptSrc] = useState<string | undefined>(undefined);

    useEffect(() => {
        // client-only: ensure we don't run during SSR
        if (typeof window === "undefined") return;

        let cancelled = false;

        // load the tinymce module (this attaches a global or module export)
        // then resolve the served URL for the tinymce bundle so we can
        // compute a baseURL and avoid the Cloud CDN fallback.
        (async () => {
            try {
                // ensure tinymce module evaluated (sets window.tinymce)
                await import("tinymce");

                // get the served URL for the tinymce bundle (Vite provides
                // a string when using ?url). This is done at runtime inside
                // the client so it won't affect SSR.
                // @ts-ignore - Vite-specific import
                const mod = await import("tinymce/tinymce.min.js?url");
                const url = (mod && (mod as any).default) || (mod as any);
                if (typeof url === "string") {
                    const folder = String(url).replace(/\/tinymce(\.min)?\.js(\?.*)?$/, "").replace(/\/$/, "");
                    // set baseURL so TinyMCE resolves plugins/themes/icons
                    (globalThis as any).tinymce = (globalThis as any).tinymce || (window as any).tinymce;
                    if ((globalThis as any).tinymce) {
                        (globalThis as any).tinymce.baseURL = folder;
                        setScriptSrc(folder + "/tinymce.min.js");
                    }
                }
                if (!cancelled) setReady(true);
            } catch (e) {
                // if anything fails, avoid letting the React wrapper attempt
                // to load the Tiny Cloud CDN by leaving `ready` false. The
                // dev can see the failure in console and we won't show the
                // editor until fixed.
                // Still attempt to surface a minimal fallback: if a global
                // tinymce already exists, mark ready.
                (globalThis as any).tinymce = (globalThis as any).tinymce || (window as any).tinymce;
                if ((globalThis as any).tinymce && !cancelled) setReady(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="prose max-w-none">
            {ready ? (
                <Editor
                    tinymceScriptSrc={scriptSrc}
                    licenseKey="gpl"
                    id={id}
                    apiKey={apiKey}
                    value={value}
                    init={{
                        menubar: false,
                        statusbar: true,
                        plugins: ["lists", "link", "paste", "autoresize"],
                        toolbar:
                            "undo redo | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | link",
                        autoresize_bottom_margin: 16,
                        branding: false,
                    }}
                    onEditorChange={handleChange}
                    readonly={readonly}
                />
            ) : (
                <div>Loading editor...</div>
            )}
        </div>
    );
}
