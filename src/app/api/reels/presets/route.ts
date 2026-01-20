import { NextResponse } from "next/server";
import { listPresets } from "@/lib/reels/presets";

export async function GET() {
  return NextResponse.json({ presets: listPresets() });
}
