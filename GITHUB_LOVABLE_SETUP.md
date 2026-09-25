# GitHub → Lovable handoff

## 1. Create the GitHub repository

Create a new **private** repository on GitHub, for example:

`coopos-nigeria`

Do not add a README, .gitignore, or license when creating the empty repository because those files are already included here.

## 2. Upload this project

Extract this ZIP and upload the **contents of the project folder** to the root of the GitHub repository.

The repository root should contain at least:

- `package.json`
- `bun.lock`
- `src/`
- `supabase/`
- `.lovable/`
- `vite.config.ts`
- `tsconfig.json`
- `.env.example`

Do **not** upload `.env` or `node_modules`.

## 3. Connect the repository to Lovable

Open the existing CoopOS project in Lovable and use its GitHub integration to connect/select the repository.

Once connected, keep the repository synchronized with Lovable. Future Lovable changes should be committed to the same repository rather than creating a second copy of CoopOS.

## 4. Environment variables

The real environment values are intentionally not stored in GitHub.

Use `.env.example` for the required variable names:

- `SUPABASE_PROJECT_ID`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

Configure the actual values through the Lovable/Supabase project environment and local `.env` when developing locally.

## 5. Automatic verification

GitHub Actions is included at `.github/workflows/ci.yml`.

Every push and pull request runs:

1. dependency installation from `bun.lock`
2. `bun run typecheck`
3. `bun run build`

This gives the project a repeatable build check before future Phase 8/9 changes are merged.

## 6. First Lovable prompt after connection

After Lovable recognizes the repository, do not ask it to rebuild the existing accounting engine. Start from the current codebase and ask it to inspect the existing Phase 8 implementation and continue from it.

Recommended first instruction:

> Inspect the existing CoopOS codebase and preserve the current Phase 8 accounting engine, Supabase schema/RPCs, RBAC, transaction architecture, and General Ledger implementation. Do not duplicate existing modules or create parallel accounting logic. First confirm the repository builds successfully, then continue Phase 8 with the remaining accounting screens one at a time. Do not modify working functionality unless required for integration or build correctness.
