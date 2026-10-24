# FactFit: How to Win "No Hands"

Your strategy file. Sonnet follows `BUILD_PLAN.md`. You follow this one.

---

## 0. Facts this plan is built on

Checked on the challenge site on 24 Oct.

- **Deadline:** Sat 31 Oct, 11:59 pm IST. That's 8 days including today.
- **Prizes, each ₹1,00,000:**
  - Builders track winner (one)
  - No-Code track winner
  - Most Wispr usage, ranked by words dictated during the challenge
- **Social** is judged on *"how clearly a post shows a real workflow"*.
- **Daily draw:** $100 to one random submitted project each day, 10 draws in all. Draw 01 was on 22 Oct, so Draw 10 is around 31 Oct. *"Every project submitted is in the draw."*
- **Judging:** four questions. The weights aren't shown on the page yet.
  1. **Real problem?** "A specific problem, a clear user, and a tool that person would keep using."
  2. **Wispr used meaningfully?** "Flow is part of the build *and the workflow*, and your demo and usage card show it."
  3. **Does it work?** "A live link the judges can open and use."
  4. **Is the demo clear?** "A two-minute video anyone can follow."
- **Judges:** Kunal Kushwaha (Founder, WeMakeDevs), Rohan Kochhar (India Growth, Wispr Flow), Aayush Sharma (COO, WeMakeDevs) and Sachin Sharma (CMO, WeMakeDevs).
- **After the deadline:** scores are published Wed 4 Nov, and winners are announced and paid Fri 6 Nov.

## 1. The project

**FactFit: tailored job applications with receipts.**

- You keep **one verified bank of facts** about yourself and add to it by talking.
- You paste any job post or recruiter email and say what to stress. You get:
  - a one-page resume in **your own LaTeX template**
  - a cover note and an email
  - an honest list of what you're missing
- **Every line has a receipt** pointing to the verified fact behind it.
- **A deterministic guard** (code, not AI) blocks any number, date, award or skill that isn't in your facts.

## 2. Why this can win

| Judging question | How FactFit answers it |
|---|---|
| Real problem in your work | **Your own files.** You made 31 hand-tailored resume copies between 5 and 23 Oct. 18 still say your research internship is "Present", and 10 have CGPA 8.72 instead of 8.73. It's placement season, so you'll keep using the tool. Every judge runs a student community; they've all lived this. |
| Wispr used meaningfully | Wispr is in **the build** (every prompt to Claude Code is dictated) **and the workflow** (steer notes, "add facts by talking", recruiter replies, all dictated into FactFit). Usage card and clips show both. |
| Does it work | Live Vercel link with no login. Sample jobs load instantly, a live run takes under 30 s, and it produces a real PDF. |
| Is the demo clear | One story: the problem with numbers → paste a job → **the AI is told to lie and gets blocked** → real numbers → proof it was built by voice. |

**Your edge:** most AI resume tools make things up. FactFit's guard is tested code that you can show failing a lie on camera. That's real Builders-track depth, and it's a demo moment people remember.

## 3. Timeline

| Day | Goal |
|---|---|
| **Sat 24 (today)** | **MVP live.** Phase 0 (30 min) → P1, P2, P3, P4 with Sonnet. Time one application by hand (§5). Post #1. |
| Sun 25 | P5 and P6. Run the **audit** (real result #1). Pick the right value for the 2 conflicting facts on the Facts page. Check the submission edit policy (§4). |
| Mon 26 | P7 (polish, samples, README). Start **real applications** from your `jobs/scan.py` hits, about 3 a day. |
| Tue 27 | Real use, and fix whatever annoys you. Post #2 (the guard catching "winner"). |
| Wed 28 | Real use. Do P8 only if everything else is solid. |
| Thu 29 | Record the demo (§8) and finish the README. |
| Fri 30 | Final deploy by 6 pm. Screenshot the usage card, submit or update the entry, and Post #3. |
| Sat 31 | Buffer. Don't touch production. Entries close at 11:59 pm IST. |

**If you only get P1–P4 done, you still have a complete entry.** Everything after P4 makes it stronger.

## 4. When to submit (the $100 draw)

1. **Find out first** whether an entry can be edited after you submit. Log in and open the submit page, or ask in the WeMakeDevs Discord.
2. **If it can be edited:** submit as soon as the MVP is live, today or tomorrow. Include a quick 60-second screen recording and your current usage card. On Fri 30, update the video, card and text. That puts you in every remaining draw.
3. **If it can't be edited:** submit **Tue 27 evening**, once you have the audit, some real applications and a proper video. That still gets you about 5 draws. Don't lock in a weak entry for the ₹1,00,000 prize to chase a $100 draw.
4. Early draws probably have fewer entries, because most people submit near the deadline. That makes each early day worth more.
5. Either way, the project link is your live Vercel URL, so it always shows your latest deploy.

## 5. The real result (you don't build anything twice)

1. **Audit (Sun).** Run `npm run audit` on your resume folder. You get a line like *"FactFit found [D] drifted facts across [F] of my 31 resumes"*. You already know some of them: 18 "Present", 10 "8.72", and two numbers that differ between copies.
2. **Baseline (once, today or Sun).** Take the next real job you want:
   - Tailor it **by hand** the old way, editing the LaTeX and writing the email, with a stopwatch running.
   - Then do the **same job in FactFit**. The log times it.
   - That gives you one honest before-and-after pair.
3. **Real use (Mon–Thu).** Send every real application through FactFit. Aim for 10 or more jobs you actually want. Don't spray junk applications to raise the count.
4. **Your headline:** *"[N] real applications, median [M] min each vs [B] min by hand · 0 unverified claims sent · audit caught [D] drifted facts."*
5. If a recruiter replies or you get an interview from these, add it. Only if it's true.

## 6. Wispr Flow plan

1. **Pro trial:** claim it if you'll dictate a lot, and set a reminder to cancel before it renews.
2. **Your name:** fix it in Settings. The app greets you as "The".
3. **Dictionary:** add these words now. Your last message turned "Sonnet" into "Sonos".
   > FactFit, Sonnet, Opus, Claude Code, CLAUDE.md, Wispr, No Hands, WeMakeDevs, Next.js, Vercel, Tailwind, Zod, Vitest, LaTeX, tectonic, Overleaf, localStorage, Greenhouse, Lever, Ashby, Strata, Evident, Dhuaan, SnapLink, HNSW, hnswlib, FAISS, BM25, nDCG, pybind11, USearch, sktime, skpro, KFall, Conformer, BIT Mesra
4. **What to dictate:**
   - every prompt to Claude Code, and every bug report
   - steer notes and fact brain-dumps inside FactFit
   - recruiter emails and social posts
   - the submission text and the video voice-over

   Use the keyboard only for shortcuts like Cmd+Enter, copy/paste and Tab. That's the challenge's own rule.
5. **Daily target:** about 2,000 words a day, roughly 20 minutes of talking at your 116 wpm. That's about 15,000 by Friday. Keep it to real work; the judges read your usage card next to your demo.
6. **The usage prize:** you started on day 8 with 213 words, so rank 1 is a long shot. Your usage still counts toward judging question 2.
7. **Proof clips** (Cmd+Shift+5, 10–20 s each):
   - (a) you dictating a phase prompt into Claude Code, and the code changing
   - (b) you dictating a steer into FactFit
   - (c) a brain-dump turning into fact cards
   - (d) your Insights card

   These become the demo's voice-proof segment and your posts.
8. **Weekly check-in:** when the checkpoint email arrives, upload your usage card and link your latest post.

## 7. Models

- **Coding:** in the Claude desktop app, open a **new Code session in `factfit/`** with **Sonnet 5.5 at Medium**. `CLAUDE.md` loads automatically, so Sonnet always has the rules.
- **One phase per session.** Small context is cheaper and makes fewer mistakes.
- **Opus,** with your remaining ~12%, only:
  - (a) when Sonnet fails the same bug twice; it writes a bug brief, and you paste it into an Opus session
  - (b) for an optional final review on Thu
- **FactFit's own AI** (the API the app calls at runtime) is separate from your Claude subscription, which doesn't cover API calls.
  - Use the **Claude API** if you have API credits, and set a monthly spend limit.
  - Otherwise use the **Gemini free tier**.
  - Switching is one env var.

## 8. Demo video (2:00 max)

| Time | On screen | You say (dictate this as your script) |
|---|---|---|
| 0:00–0:15 | Finder with 31 resume files, then the audit report | "In 19 days of placement season I hand-tailored 31 versions of my resume. 18 still said my internship was ongoing. 10 had the wrong CGPA." |
| 0:15–0:25 | FactFit home | "FactFit keeps one verified bank of facts and builds every application from it, with receipts." |
| 0:25–1:00 | Paste a real job post → hold fn and speak a steer → result → hover a bullet to show its receipts → Download PDF → Email tab → Match tab with honest gaps | Narrate what's happening in one short sentence per step. |
| 1:00–1:15 | Speak "say I won the hackathon and that I know Kubernetes" → Guard tab shows both blocked | "Even when I ask it to lie, it can't. My facts say runner-up, and I've never used Kubernetes." |
| 1:15–1:35 | The Log stats and audit numbers | "[N] real applications this week, [M] minutes each instead of [B]." |
| 1:35–1:55 | Clip of you dictating into Claude Code, then the Insights card | "I built all of it by voice with Wispr Flow: [W] words. And voice is part of the product: steer notes and adding facts by talking." |
| 1:55–2:00 | URL and tagline | "FactFit. Tailored applications with receipts." |

**Recording tips:**
- Record at 1080p with the browser zoomed to 125%.
- **Add captions**, since judges may watch muted.
- Cut every pause, and rehearse twice.

## 9. Submission text (fill in the brackets)

> **Problem:** In placement season I hand-tailored 31 versions of my LaTeX resume in 19 days. Copying bullets between files made my facts drift: 18 copies still said my research internship was ongoing, and 10 had the wrong CGPA.
> **Who it's for:** Students and early-career engineers who tailor a resume for every application, starting with me.
> **What it does:** FactFit keeps a verified bank of my facts, which I add to by talking. For any job post, it writes a one-page resume in my own LaTeX template, a cover note and an email. A tested guard blocks any number, date, award or skill that isn't in my facts.
> **Result:** [N] real applications in [X] days, a median of [M] min each vs [B] min by hand. The guard blocked [K] unverified claims, and the audit found [D] drifted facts in my old resumes.
> **How I used Wispr:** I dictated every prompt to Claude Code, plus the README, posts and emails: [W] words. Inside FactFit, the steer notes and "add facts by talking" are built for Wispr dictation.

## 10. Social posts

| When | What | Hook |
|---|---|---|
| Today | Screenshot of the 31 files, the problem in 3 lines, and a 15 s clip of you dictating the first prompt | "I made 31 versions of my resume in 19 days. 10 have the wrong CGPA. Building the fix with my voice only." |
| Tue | 20 s clip: the trap steer getting blocked | "I asked an AI to lie on my resume. My code wouldn't let it." |
| Fri | The demo video, the real numbers and the live link | "[N] applications, [M] min each, zero made-up claims." |

Post on LinkedIn and X with **#NoHandsChallenge**, and tag WeMakeDevs and Wispr Flow. Put each link in your weekly check-in.

## 11. Risks and fallbacks

| Risk | Fallback |
|---|---|
| The API is down or rate-limited while judges try it | Sample results are precomputed and load instantly. |
| An unexpected API bill | A monthly spend limit in the provider console, plus 20 runs per hour per visitor. |
| No LaTeX on Vercel | Print-to-PDF from the preview, plus a `.tex` download for Overleaf. You keep real tectonic PDFs locally. |
| Sonnet gets stuck | It writes a bug brief, and you hand that to Opus. |
| Running out of time | P1–P4 alone is a complete entry. |
| Your data is public | The seed (your resume facts, minus the phone number) is public in the repo and the demo. Remove anything you don't want shown. |
| Wispr mishears tech words | Use the Dictionary list in §6. |

## 12. Phase 0: do this now (30 min)

1. **Register** on the challenge site if you haven't, then open the submit page and check whether entries can be edited.
2. **Wispr:** claim Pro (optional), fix your name, and add the Dictionary words.
3. **API key:** get one from console.anthropic.com (add billing and a monthly limit) or a free key from aistudio.google.com. It goes in `factfit/.env.local` when Sonnet asks for it.
4. **Accounts:**
   - GitHub signed in on this Mac; Sonnet will check with `gh auth status`.
   - A Vercel account, created with "Continue with GitHub".
5. **Claude Code:** open a new session in `/Users/vividhyadav/Projects/factfit` with **Sonnet 5.5 at Medium**.
6. **Start talking:**
   - **Prompt 0** in Wispr's Scratchpad
   - then **Prompt 1** into Claude Code

   Both are in `docs/VOICE_PROMPTS.md`.
