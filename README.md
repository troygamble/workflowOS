# WorkflowOS

**Design, simulate, and ship PSF-aligned AI workflows — free and open source.**

WorkflowOS (PSF Workflow Studio) is the [Production AI Institute](https://www.productionai.institute)'s open-source reference implementation of the [Production Safety Framework (PSF)](https://www.productionai.institute/standard). It turns the standard from something you read into something you can model, stress-test, and export as evidence of production-ready design.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Production AI Institute](https://img.shields.io/badge/Built%20by-Production%20AI%20Institute-6366f1)](https://www.productionai.institute)

---

## Try it now (no install)

**Hosted Studio:** [productionai.institute/studio](https://www.productionai.institute/studio)

Sign in with a free account. Non-AI features work immediately. AI features use **your own OpenAI API key** — add it once in **⋯ → OpenAI API key**.

---

## Self-host (this repository)

This repo contains **WorkflowOS only** — the workflow canvas, AI tools, and six API routes. It does **not** include the Production AI Institute website, certifications, admin, or billing.

```bash
git clone https://github.com/troygamble/workflowOS.git
cd workflowOS
npm install
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk auth (free dev keys work locally) |
| `CLERK_SECRET_KEY` | Yes | Clerk auth |
| `OPENAI_API_KEY` | No | Server fallback; users can BYOK in Studio instead |

```bash
npm run dev
```

Open [http://localhost:3000/studio](http://localhost:3000/studio).

Production: `npm run build && npm start` — deploy to Vercel, Railway, or any Node host.

---

## What you can do

| Capability | Description |
|------------|-------------|
| **Visual workflow canvas** | Map skills, humans, artifacts, integrations, and triggers |
| **PSF Compliance Analyzer** | Score your workflow against all eight PSF domains |
| **AI Workflow Wizard** | Describe a process in plain English; get a structured workflow |
| **AI Heal** | Fix gaps, missing artifacts, and wiring issues automatically |
| **Automate This** | Transform a manual “current state” map into a future-state automation design |
| **Executive Brief** | Generate a C-suite-ready narrative from your workflow |
| **Export deployment ZIP** | YAML skill specs, docs, and hooks ready for engineering handoff |
| **Share links & templates** | Community patterns and read-only sharing |

Portfolio exports support [CPAP certification](https://www.productionai.institute/certify/cpap) evidence at Production AI Institute.

---

## AI features — bring your own key (BYOK)

1. Create a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. In Studio: **⋯ → OpenAI API key** → paste `sk-…` → Save
3. AI usage bills to your OpenAI account — not the host's

Self-hosters can set `OPENAI_API_KEY` in environment variables as a server-wide fallback instead.

---

## For MSPs and integrators

WorkflowOS is included in the [Certified AI Integrator](https://www.productionai.institute/certify/integrator) partner toolkit. Self-host this repo for client engagements — MIT licence, no fees.

---

## Syncing from upstream

The hosted edition at productionai.institute is built from a private institute monorepo. **That repo is not public.** To refresh this extract after Studio changes upstream, maintainers run:

```bash
python scripts/extract-workflowos.py   # in the institute repo
```

---

## License

MIT — see [LICENSE](LICENSE).

---

## Links

- **Live Studio:** [productionai.institute/studio](https://www.productionai.institute/studio)
- **WorkflowOS overview:** [productionai.institute/workflowos](https://www.productionai.institute/workflowos)
- **Why we open-sourced it:** [Institute article](https://www.productionai.institute/insights/why-we-open-sourced-workflowos)
- **The PSF:** [productionai.institute/standard](https://www.productionai.institute/standard)
- **Institute:** [productionai.institute](https://www.productionai.institute)

*Community-supported, provided as-is.*
