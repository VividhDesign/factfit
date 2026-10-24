import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSafeTex, buildTex } from "@/lib/latex";
import { compileTex, tectonicPath } from "@/lib/pdf";
import { buildResume } from "@/lib/resume-model";
import { ProfileSchema } from "@/lib/schemas";
import { ComposeSchema } from "@/lib/tailor-schemas";

export const maxDuration = 60;

const Body = z.object({
  profile: ProfileSchema,
  result: ComposeSchema.pick({ entryOrder: true, bullets: true, skills: true }).extend({
    match: ComposeSchema.shape.match.optional(),
  }),
});

/** Compiles the tailored resume with tectonic. Answers 501 where tectonic is missing (Vercel); the UI then prints instead. */
export async function POST(req: Request) {
  if (!tectonicPath()) {
    return NextResponse.json({ error: "PDF compiling needs tectonic, which is not installed on this server. Use Print instead." }, { status: 501 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { profile, result }." }, { status: 400 });

  try {
    const { profile, result } = parsed.data;
    const tex = buildTex(
      buildResume(profile, { ...result, match: result.match ?? [], coverNote: { paragraphs: [] }, email: null }),
    );
    assertSafeTex(tex);
    const { pdf, pages } = await compileTex(tex);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="resume.pdf"', "x-pages": String(pages) },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not compile the PDF." }, { status: 500 });
  }
}
