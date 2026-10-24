# FactFit

Tailored applications with receipts. FactFit tailors a job application from a bank of verified facts, and a deterministic guard blocks any claim the facts don't prove.

Built for the WeMakeDevs × Wispr Flow "No Hands" challenge (Builders track). The full README comes in Phase 7; the spec is [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md).

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test
```

Copy `.env.example` to `.env.local` for API keys (needed from Phase 3). Never commit `.env*`.

## Seed data

`data/seed-profile.json` is built from the author's real resume files by `npm run seed`. It contains no phone number, salary or API key. Facts the resume copies disagree on are marked `needs_review`.

## Built by voice with Wispr Flow

Every prompt that built this project was dictated with Wispr Flow.

## License

MIT. The resume LaTeX template is Jake Gutierrez's (MIT).
