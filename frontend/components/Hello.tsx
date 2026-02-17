import React from "react";

/** Tiny example component used in demos and stories. */
export default function Hello({ name = "writer" }: { name?: string }) {
    return (
        <div className="p-4 bg-white rounded shadow">
            Hello, {name} — GetWrite UI placeholder
        </div>
    );
}
