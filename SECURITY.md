# Security — boundary with Production AI Institute

This public repository contains **WorkflowOS (PSF Workflow Studio) only**.

## What is NOT in this repo

The private [Production AI Institute](https://www.productionai.institute) application (`troygamble/ai`) is **separate and not public**. It is never cloned or required to run this project.

This repo does **not** include:

- `/admin`, `/ops`, or superadmin tooling
- Stripe checkout, webhooks, or payment logic
- Supabase schema, org billing, or cert issuance backends
- MSP partner toolkit server routes or org provisioning
- Marketing pages, SEO content, or certification exam banks
- Automation scripts, brain docs, or operational secrets

## API surface (this repo only)

| Route | Purpose |
|-------|---------|
| `POST /api/wizard` | AI workflow wizard |
| `POST /api/heal` | AI workflow healer |
| `POST /api/generate` | AI generation |
| `POST /api/executive-brief` | Executive brief |
| `POST /api/automate-workflow` | Automate transformation |
| `POST /api/psf-analyze` | PSF compliance analyzer |

All AI routes require Clerk sign-in and accept **bring-your-own-key** OpenAI credentials via the `x-openai-api-key` header. No institute OpenAI key is embedded in source.

## Secrets

- **Never commit** `.env.local` or real API keys (see `.gitignore`).
- `.env.example` contains placeholders only.
- Self-hosters supply their own Clerk and (optionally) OpenAI keys.

## External links

Some export templates and UI copy link to `productionai.institute` for **marketing attribution** (CPAP certification, PSF standard). These are ordinary HTTPS links — they do not expose private infrastructure or credentials.

## Reporting

If you believe private institute data appears in this repository, open an issue or email hello@productionai.institute immediately.
