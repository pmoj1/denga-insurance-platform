# Denga Insurance Platform

A Next.js and TypeScript insurance operations prototype, previously called Casefile.

The source covers staff sign-in, claim intake, evidence uploads, AI-assisted case files, client portal links, quotes, policies and renewals. Generated findings are designed for human review; the project’s original guardrails exclude automated accept/deny decisions.

## Project files

- `src/app/` — staff and client screens and API routes.
- `src/components/` — claim, evidence, case-file and portal interfaces.
- `src/agents/`, `src/services/` and `src/lib/` — application logic, AI providers, storage and authentication.
- `prisma/` — schema, migrations and development seed.
- `docs/DESIGN-SYSTEM.md` — design documentation.
- `docs/ORIGINAL_README.md` — historical setup and phase notes, retained as a project record. Its deployment and provider claims have not been reverified for this publication.

## Development setup

Install Node.js and npm compatible with the versions in `package.json`.

```sh
cp .env.example .env
# Fill in your own development configuration before running the app.
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Use a development database you control. Set your own seed email and password. See the original setup notes and source for the required service configuration. Migrations and seeding write to the configured database; they were not run during publication.

## Publication

This repository contains the collected source, configuration templates, migrations and documentation. Private environment files, uploaded claim evidence, deployment linkage, dependencies and build caches are excluded. `PUBLICATION.md` describes the snapshot and `FILE-MANIFEST.json` records file checksums.

The application was not rebuilt or deployment-tested as part of this source publication.

The separate [Denga citizen-services prototype](https://github.com/pmoj1/denga-prototype) remains in its own repository.
