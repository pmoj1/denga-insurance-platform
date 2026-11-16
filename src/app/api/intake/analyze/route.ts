import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { analyzeIntake } from "@/lib/ai/intake";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_MESSAGE_CHARS = 20_000;

export async function POST(request: NextRequest) {
  try {
    await requireStaffSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  if (!message.trim()) {
    return NextResponse.json({ error: "Paste the client's message first." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Message is too long (20,000 character limit)." }, { status: 400 });
  }

  try {
    const intake = await analyzeIntake(message);
    return NextResponse.json({ intake });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intake analysis failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
