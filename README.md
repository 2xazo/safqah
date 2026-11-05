# Safqah

**Text like you talk. Get the deal.**

Safqah (Arabic for “the deal”) is an Arabic-first B2B procurement platform for restaurants and cafés in Saudi Arabia. A buyer describes what they need in everyday Saudi dialect, **Meta Llama** turns it into a structured purchase request, verified suppliers send locked quotes, and the buyer awards the order using a transparent score.

Built for the Meta AMET AI Awards 2026 by Abdulaziz Al-Othman (Meta 2026 AI Academy, Saudi Arabia).

## Pitch deck

The five slide pitch deck is in [`docs/Safqah-Pitch-Deck.pdf`](docs/Safqah-Pitch-Deck.pdf).

The demo video is in [`docs/Safqah-Demo-Video.mp4`](docs/Safqah-Demo-Video.mp4).

## How it works

1. **Describe the need.** The buyer types a request the way they would text a supplier, for example *“I need 50 cartons of oil for the restaurant in Riyadh before Thursday”* (written in Saudi Arabic).
2. **Meta Llama builds the draft.** Llama 3.3 70B extracts items, quantities, units, city and timing. When something is missing it asks a short follow-up question instead of guessing.
3. **The buyer confirms.** Nothing is saved or published until the buyer reviews the draft.
4. **Suppliers compete.** Matched suppliers submit quotes that lock on submission.
5. **The buyer decides.** Offers are ranked by a deterministic formula (price 50%, delivery 30%, supplier rating 20%). The AI never selects the supplier.
6. **Purchase order and delivery.** The award creates a purchase order that is tracked through delivery, with complaints, ratings and an audit log.

Group purchasing lets small buyers pool demand to get better terms.

## Meta Llama in Safqah

| | |
|---|---|
| Model | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| Hosting | Cloudflare Workers AI |
| Code | [`lib/ai/llama-provider.ts`](lib/ai/llama-provider.ts), [`lib/ai/requirement-assistant.ts`](lib/ai/requirement-assistant.ts) |
| Output | JSON mode, then validated again with a strict Zod schema |

Responsible by design:

- Missing values stay empty and become clarification questions. Invented values are not accepted.
- Every model response is re-validated. Invalid output is rejected, never patched.
- Buyer text is passed to the model as untrusted data, which protects against prompt injection.
- The model cannot publish, award or change records. Commercial decisions stay with the buyer.
- Requests are length-limited and rate-limited per buyer, and API keys stay server-side.

## Evaluation

We tested the assistant on 20 realistic Saudi procurement requests written by the team, covering Saudi dialect, Modern Standard Arabic, English, mixed Arabic and English, missing details, ambiguous dates, multiple items and prompt-injection attempts.

| Result | |
|---|---|
| Valid structured drafts | **20 / 20** |
| Correct item, quantity and city | **19 / 20** |
| Invented values | **0** |
| Prompt-injection attempts ignored | **2 / 2** |

The one miss translated “paper cups” with a valid Arabic synonym that the strict test did not accept. Full results are in [`eval-results/llama-eval.md`](eval-results/llama-eval.md). This is a small demonstration set, not a comprehensive benchmark.

Run it yourself with `npm run eval:llama`.

## Tech stack

Next.js (App Router) on Cloudflare Workers via vinext, PostgreSQL with Drizzle ORM, Zod, and Meta Llama on Cloudflare Workers AI. The interface is fully Arabic and right-to-left.

## Run locally

Requirements: Node.js 22.13 or newer, and a Cloudflare account with Workers AI.

```bash
npm install
cp .env.example .env.local
cp .env.example .dev.vars
```

Fill in both files:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/safqah
SESSION_SECRET=any-long-random-string
DEMO_AUTH_ENABLED=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=token-with-workers-ai-permission
```

Then, in two terminals:

```bash
npm run db:pg        # embedded PostgreSQL, keep it running
npm run db:setup     # tables and demo data
npm run dev          # http://localhost:3000
```

## Demo accounts

All demo accounts use the password `SafqahDemo1!`, or use the one-click demo buttons on `/login`.

| Role | Email |
|---|---|
| Buyer (restaurant) | buyer@safqah.demo |
| Buyer (café) | buyer2@safqah.demo |
| Supplier | supplier@safqah.demo |
| Admin (read-only support) | admin@safqah.demo |

All data in the demo is seeded for demonstration. Safqah is a working MVP and has not yet been piloted with real customers.

## Roadmap

- Pilots with Saudi restaurants and suppliers to measure time saved and price differences
- Ordering by message on WhatsApp, supplier discovery on Instagram, and group buying in Facebook communities
- Self-hosted Llama so buyer data stays on infrastructure we control
- Benchmarking Meta’s Muse open models against Llama on Arabic procurement requests
