# CogniVit.ai AROS

AROS now has a tenant-aware identity and authorization foundation: email/password authentication, opaque server-side sessions, stable revenue roles, reporting hierarchy, centralized permissions, assignment-based resource scope, role-based Today routing, safe demo View As, and authenticated audit identity.

## Local demo login

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`. Every deterministic demo identity uses `ArosDemo!2026` unless `AROS_DEMO_PASSWORD` is set before the identity store is first created.

The application defaults to Demo mode, which displays seeded credentials and enables role simulation. Organization admins can change Application mode from the user administration screen. `AROS_APP_MODE=PRODUCTION` sets the initial mode; UI changes persist in `.aros-data/application.json` (or `AROS_APP_CONFIG_PATH`) and disable role simulation and demo credential hints.

| Role | Email |
| --- | --- |
| SDR | alex.morgan@demo.cognivit.ai |
| AE | sarah.chen@demo.cognivit.ai |
| RSM | mark.davis@demo.cognivit.ai |
| Partner Sales | priya.shah@demo.cognivit.ai |
| VP Sales | jennifer.lee@demo.cognivit.ai |
| Organization admin | admin@demo.cognivit.ai |
| CRO | michael.roberts@demo.cognivit.ai |

Runtime identity state defaults to `.aros-data/identity.json` and is created deterministically on first use. Delete that generated development file to reseed. Set `AROS_IDENTITY_STORE_PATH` to choose another writable location. Production deployments should implement the existing repository interface with PostgreSQL and apply [migrations/001_identity_authorization.sql](migrations/001_identity_authorization.sql); the file adapter is intended for the deterministic single-instance phase only.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Original Next.js notes

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
