import { NextResponse } from "next/server";
import fs from "node:fs/promises";

// Fetch project resources from the filesystem
// Body expects a project file path
export async function POST(req: Request) {
    return NextResponse.json({ message: "Project resources endpoint" });
}
