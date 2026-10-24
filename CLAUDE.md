# FactFit

FactFit is an entry for the WeMakeDevs × Wispr Flow "No Hands" challenge (Builders track). Submissions close **Sat 31 Oct 2026, 11:59 pm IST**. It's a solo project by Vividh.

**The spec is `docs/BUILD_PLAN.md`.** Read it before starting any phase.
- `docs/WIN_PLAN.md` is the user's strategy. Read it only if asked.
- `docs/VOICE_PROMPTS.md` is what the user says to you.

## How the user talks to you

Vividh builds by voice, so every prompt is dictated with Wispr Flow. That's the challenge rule.

Expect transcription slips, such as "Sonos" for Sonnet, "whisper" for Wispr, or "fact fit" for FactFit. Read them generously, and ask only when a slip changes the meaning.

Keep your questions short and answerable in one sentence.

## Rules

1. **One phase per session** unless asked. Finish the phase's whole "done when" list before stopping. Don't start the stretch phase (P8) unless asked.
2. **Truth is the product.** Never invent a fact, number, date, award or skill for the user. That applies to seed data, samples, tests and the README.
   - Copy resume LaTeX byte-for-byte.
   - Conflicting values stay `needs_review` until the user picks one.
3. **Confirmed facts:**
   - CGPA 8.73/10
   - Class XII 91.25%
   - Class X 87.16%
   - Research internship Jan 2026 – Jul 2026, never "Present"
   - Dhuaan was **Runner-up**, never "winner" or "won"
   - Graduation Aug 2023 – May 2027, never "Jul 2027"
4. **Privacy:**
   - Never commit the phone number, salary expectations or any API key. The phone and prefs live only in the browser's localStorage.
   - `.env*` is gitignored, except `.env.example`.
5. **Read-only sources:** `/Users/vividhyadav/Projects/resume/`, `/Users/vividhyadav/Projects/RESUME_BULLETS.md` and `/Users/vividhyadav/Projects/jobs/`.
6. **Keep it simple:** no database and no auth. Don't add a dependency without stating why in your report. Prefer small files and plain functions.
7. **Before calling a phase done,** `npm run lint`, `npm test` and `npm run build` must pass. Say what you couldn't verify, such as Vercel.
8. **Commit at the end of each phase** with the message `P<n>: <summary>`. Push if a remote exists.
9. **Report in 10 lines or fewer:**
   - what changed
   - how to try it: the exact URL or command
   - what the user must do, such as clicks in Vercel or keys in `.env.local`
10. **Stuck after two fix attempts on the same bug:** stop. Write a bug brief (symptom, repro steps, what you tried, suspected cause) the user can hand to Opus.
11. **LLM code:** load the claude-api skill before writing the Anthropic provider. Validate every LLM response with Zod.
12. **Voice-first UI:** every free-text input is a Wispr Flow dictation target.
    - Use big textareas.
    - Never validate keystroke-by-keystroke in a way that fights dictation.
    - Cmd+Enter submits.

## Commands

- `npm run dev` · `npm run build` · `npm run lint` · `npm test`
- `npm run audit -- /Users/vividhyadav/Projects/resume`
- `npx tsx scripts/try-tailor.ts data/sample-jobs/<file>.txt --steer "..."`
- LaTeX: `/opt/homebrew/bin/tectonic file.tex`
