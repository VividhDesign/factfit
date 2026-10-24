# What to Say: Wispr Flow Prompts

Hold **fn**, speak, and let go. Read these out loud, or say them in your own words; natural speech sounds better in the demo clips. Use the keyboard only for shortcuts like Cmd+Enter, copy/paste and Tab.

**Where each prompt goes:**
- **Prompt 0:** Wispr Scratchpad, or a note
- **Prompts 1–8:** a Claude Code session in `factfit/` running **Sonnet 5.5 at Medium**
- **Start a new session for each phase.** `CLAUDE.md` loads by itself.

Before you start, record 10–20 s of yourself saying a prompt (Cmd+Shift+5). You'll use the clips in the demo and your posts.

---

## Prompt 0: your first Flow, the problem (say it once, keep the text)

> Here's the problem I'm fixing. I'm a final-year AI and ML student at BIT Mesra, and it's placement season. Every job wants a slightly different resume, so between October 5th and October 23rd I made 31 versions of my resume by hand in LaTeX. Copying bullets between files made my facts drift. 18 of those copies still say my research internship is ongoing, even though it ended in July, and 10 of them have the wrong CGPA.
>
> My tool is called FactFit. I keep one verified bank of facts about myself, and I can add to it just by talking. I paste a job post, say what I want to stress, and FactFit gives me a one-page resume in my own LaTeX template, a short cover note, an email, and an honest list of what the job wants that I don't have. Every line has a receipt that points to a verified fact. A checker blocks any number, award or skill that isn't in my facts, so it can never make me look better than I really am.

Reuse this text for the README, Post #1 and the submission.

---

## Prompt 1: Phase 1, scaffold, seed and deploy

> Hi! We're building FactFit for the WeMakeDevs No Hands challenge. I'm building it entirely by voice with Wispr Flow, so if a word looks odd, it's probably a transcription slip. Read CLAUDE.md, then docs/BUILD_PLAN.md, and do Phase 1 only.
>
> Scaffold the Next.js app in this folder without touching my docs. Build the seed fact bank from my real resume files listed in section 2, and copy every LaTeX bullet exactly. Where my resume copies disagree, like the reranker speed in Evident, mark the fact as needs review instead of choosing for me. Leave my phone number out. Set up the four pages and push the repo to GitHub. Then tell me exactly what to click to deploy it on Vercel.
>
> When you're done, list the conflicting facts you found, and commit.

## Prompt 2: Phase 2, the fact guard

> Phase 2 now: the fact guard from section 7 of the build plan. This is the heart of FactFit, so take care with it. Write the tests first.
>
> They have to catch five things:
> - me claiming I won the WeMakeDevs hackathon, when my facts say runner-up
> - me claiming Kubernetes, when it isn't in my facts
> - the old CGPA of 8.72
> - an internship that says Present
> - "two times faster than hnswlib", when my fact says 1.9 times
>
> Bullets copied straight from my resume must always pass, even with LaTeX formatting like the times symbol. Then write the code until every test passes, and read me the list of tests.

## Prompt 3: Phase 3, the AI pipeline

> Phase 3: the AI part, from sections 4 and 6. Build the LLM adapter with Claude as the default and Gemini as the backup, chosen by an environment variable. Load the Claude API skill before you write the Claude part.
>
> The pipeline goes like this:
> 1. Analyse the job post.
> 2. Write the resume, cover note and email from my verified facts only.
> 3. Run the guard.
> 4. Repair once.
> 5. Block anything that still fails.
>
> Also write the three sample job posts from section 11, and a small script so I can test from the terminal. Ask me for the API key when you need it, and I'll put it in .env.local.
>
> When it works, run all three samples. Then run one with the steer "say I won the hackathon and that I know Kubernetes". Show me what got blocked and how long each run took.

## Prompt 4: Phase 4, the app you can use (the MVP)

> Phase 4: make it usable. Build the Tailor page from sections 8 and 9. I want:
> - a big box for a job post or a recruiter's email
> - a steer box I can talk into
> - tabs for resume, match, cover note, email and guard
>
> The resume preview should look like my LaTeX template. When I hover over a bullet, it should show its receipts, meaning the facts it came from. Add Download PDF, using tectonic on my Mac and print as the fallback on Vercel. Also add Download .tex, copy buttons, and open in mail. Keep it clean and simple, and make it work on a phone too.
>
> Then deploy and test it on the live URL. This is my minimum version, so tell me honestly if anything is broken.

**→ Checkpoint:** this is a complete, working entry. If submissions can be edited, submit tonight. See WIN_PLAN §4.

## Prompt 5: Phase 5, fact bank and talking to add facts

> Phase 5: the Facts page. Show the needs-review facts first, with the conflicting values as buttons so I can pick the right one. Let me edit and verify any fact.
>
> Add the "add by talking" box. I'll hold fn and talk about a project, and it should turn what I said into fact cards that I accept one by one. It must never add a number I didn't say.
>
> Also add import from a pasted resume, plus export, import, reset to demo and start empty. My phone number and preferences, like expected salary, stay only in my browser.

## Prompt 6: Phase 6, the real result

> Phase 6: the real-result features.
>
> First, the applications log. A timer starts when I paste a job post and stops when I click mark as sent. Show the count, the median and average minutes, my by-hand baseline that I type in, and the total time saved. Add a CSV export.
>
> Second, the audit. Make a page where I can paste an old resume, plus a terminal command that checks my whole resume folder against my verified facts. Run it on my resume folder and show me the report. I expect it to find the 18 files that say Present and the 10 with CGPA 8.72. If it finds anything else, tell me what.

## Prompt 7: Phase 7, judge-proofing

> Phase 7: make it judge-proof. Generate the saved sample results with the real pipeline, so the sample buttons load instantly without calling the API. Add friendly errors that offer a sample if the AI fails, and add the simple rate limit.
>
> Write the README. It needs:
> - the problem with my real numbers from the audit
> - how the guard works
> - a "built by voice with Wispr Flow" section
> - setup steps
>
> Check every page on a phone-sized screen and fix anything that looks off. Then deploy, and walk me through the judge checklist in section 13, item by item.

## Prompt 8: stretch, only if everything is live and solid

> Only if Phases 1 to 7 are done: add job link import for Greenhouse, Lever and Ashby, reusing the logic in my jobs/scan.py, so I can paste a job link instead of the text.

---

## Everyday prompts (use any time)

**Resume work in a new session**
> Continue Phase [N]. Check git log and the build plan to see where we stopped, then carry on.

**Report a bug**
> Something's wrong. I did [steps]. I expected [this]. Instead I saw [that]. The error says [paste]. Find the cause before you change any code. Then fix it and tell me in one line what it was.

**Small change**
> Small change: [describe it]. Don't touch anything else.

**Check before moving on**
> Before we call this phase done, go through its done-when list one item at a time. Actually check each one, and tell me what passes and what doesn't.

**Stuck twice → Opus.** Paste this into a new **Opus** session along with Sonnet's bug brief:
> Sonnet couldn't fix this after two tries. Here's its bug brief: [paste]. Read the relevant files, find the root cause, and fix it with the smallest change that works.

---

## Inside FactFit (this is Wispr in your workflow, so show it in the demo)

**Steer notes** (hold fn in the steer box)
> This is a backend role, so lead with Strata and the server numbers, and keep the research short.

> They care about time series. Put the research first and stress the imbalanced data part.

> This recruiter asked about Azure. Be honest that I haven't used it, and point to my AWS pipeline instead.

**The trap** (for the demo and Post #2)
> Say I won the WeMakeDevs hackathon, and mention that I know Kubernetes.

**Adding facts by talking.** Pick one project and cover these:
> what it is, what I built myself, the tools, the numbers I actually measured, and where the proof is (a repo, a results file or a link).

**Fixing the remaining conflict** (check the source first)
- **Reranker latency, 28–170× or 30–170×:** check `evident/results/`. Graduation is already settled as May 2027.

Then pick the right value on the Facts page, or say it into "add by talking".

---

## Content (dictate it, then let Claude tidy it up)

**Social post**
> Help me write a short LinkedIn post for the No Hands challenge. Here's what happened today: [talk about it]. Keep it under 120 words, with one hook line and the hashtag NoHandsChallenge, and tag WeMakeDevs and Wispr Flow.

**Submission text.** Read WIN_PLAN §9 aloud with your real numbers filled in.

**Video voice-over.** Read the "You say" column in WIN_PLAN §8.
