import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm";
import { tailor } from "@/lib/tailor";
import { TailorInputSchema } from "@/lib/tailor-schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = TailorInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  // The phone number stays in the browser: it is never needed to tailor, so drop it here too.
  const input = { ...parsed.data, profile: { ...parsed.data.profile, phone: undefined } };

  try {
    return NextResponse.json(await tailor(input));
  } catch (e) {
    const message = e instanceof LlmError ? e.message : "Something went wrong while tailoring. Try again, or load a sample.";
    if (!(e instanceof LlmError)) console.error("tailor failed:", e);
    return NextResponse.json({ error: message }, { status: e instanceof LlmError ? 502 : 500 });
  }
}
