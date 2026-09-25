# CoopOS Nigeria

CoopOS is a multi-tenant Cooperative Financial Operating System built with React, TypeScript, TanStack Start and Supabase.

This repository contains the current Phase 8 accounting build, including the General Ledger and the existing accounting engine.

## Current build status

- Phase 8 accounting engine: implemented
- General Ledger: implemented
- Chart of Accounts: implemented
- Journals: implemented
- Posting Mappings: implemented
- Trial Balance: implemented
- Supabase migrations/functions: included
- Remaining Phase 8 accounting screens: to be completed in subsequent work

## Technology

- TanStack Start
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- TanStack Router / React Query
- Recharts
- Vite

## GitHub + Lovable setup

1. Create a new **private GitHub repository** for CoopOS.
2. Upload the contents of this project to the repository root. Do not upload `node_modules`, `dist`, or `.env`.
3. In Lovable, connect the GitHub repository to the project.
4. Keep GitHub as the source-controlled master copy. Lovable can then pull the repository and commit future changes back to GitHub.
5. Configure the required Supabase/Lovable environment variables in the appropriate project environment. Use `.env.example` as the variable-name reference.

## Local development

Requires Node.js and npm.

```sh
npm install
npm run dev
```

## Build verification

```sh
npx tsc --noEmit
npm run build
```

If using Bun:

```sh
bun install
bun run build
```

## Important security note

Never commit `.env` or real Supabase credentials/keys to GitHub. The repository intentionally contains `.env.example` only.

## Architecture rule

Do not create duplicate accounting ledgers in the UI. Operational modules remain their source of truth, while the Phase 8 accounting engine and General Ledger provide the accounting presentation and double-entry accounting layer.
