# pivot-tech-dashboard

Customer dashboard for Pivot-Tech — the $25/month unlimited talk, text & data
MVNO. Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui, deployed to
Netlify.

All API calls go **directly from the browser** to the Pivot-Tech middleware
(`NEXT_PUBLIC_API_URL`). There are no Next.js API routes — `lib/api.ts` is the
single client for every middleware call.

## Pages

| Route                    | Purpose                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `/`                      | Landing — plan pitch + sign-up CTA                            |
| `/signup`                | Two-step form: email → new number / port (`POST /v1/accounts`)|
| `/signup/choose-number`  | Area-code search → pick a DID (`GET /v1/numbers/available`)    |
| `/onboarding`            | eSIM QR (BICS placeholder) + Acrobits provisioning QR + steps |
| `/status`                | Activation / port status, polled every 10s (`/v1/accounts/:id/status`) |

## Local development

```bash
cp .env.example .env.local   # already points at the dev middleware
npm install
npm run dev                  # http://localhost:3000
```

## Deploy (Netlify)

`netlify.toml` configures the Next.js runtime plugin and sets
`NEXT_PUBLIC_API_URL`. Point a Netlify site at this repo; build command is
`npm run build`. Override `NEXT_PUBLIC_API_URL` per deploy context (staging /
prod) in the Netlify UI.

## Notes

- Signup state is carried between routes via `sessionStorage` (`lib/session.ts`)
  — no server session.
- The port-in path creates the account + port intent; full port details
  (carrier, PIN, billing zip) are Phase 2 in the middleware.
- The eSIM QR is a placeholder pending the BICS provisioning integration.
