---
description: 'Run adversarial code review using Codex and Gemini CLI agents, then report fixes and disagreements'
---

# Adversarial Code Review

Run parallel code reviews using OpenAI Codex CLI and Google Gemini CLI as adversarial reviewers, then analyze their feedback, fix what makes sense, and explain what you disagreed with.

## Workflow

### Step 1: Gather the diff

Run `git diff` to capture the current WIP changes (staged + unstaged). If there are no changes, tell the user and stop.

```bash
git diff HEAD
```

Also run `git diff --stat HEAD` for a summary of changed files.

### Step 2: Launch adversarial reviews in parallel

Use **two subagents in parallel**, each shelling out to a different CLI reviewer. Both should run in the background so they execute concurrently.

**Subagent 1 — Codex Review:**

First, detect if running in a dev container by checking if the file `/.dockerenv` exists or the env var `REMOTE_CONTAINERS` / `CODESPACES` is set. This determines which codex invocation to use.

Context to include in either invocation: this is a Vite + React + TypeScript SPA using shadcn/ui (Radix primitives + Tailwind CSS), TanStack Query, React Router, React Hook Form + Zod, and Supabase as the backend. Auth is a local `VITE_APP_PASSWORD` gate — Clerk is NOT used at runtime despite a leftover `@clerk/clerk-react` dep. Tests run via Vitest + React Testing Library.

**If in a dev container:**
```bash
codex exec --sandbox danger-full-access "Review the uncommitted changes (run git diff HEAD to see them) critically. This is a Vite + React + TypeScript SPA using shadcn/ui (Radix + Tailwind), TanStack Query, React Router, React Hook Form + Zod, and Supabase. Auth is a local VITE_APP_PASSWORD gate (Clerk is NOT used at runtime despite a leftover dep). Tests use Vitest + React Testing Library. Focus on: bugs, logic errors, security issues (incl. Supabase RLS, password gate boundaries), performance problems (incl. unnecessary re-renders, missing query keys), missing edge cases, accessibility on Radix components, and code style. Be thorough and adversarial — assume the author missed something. Format your review as a numbered list of issues with file paths and line references where possible."
```

**If NOT in a dev container (default):**
```bash
codex review --uncommitted "Review these changes critically. This is a Vite + React + TypeScript SPA using shadcn/ui (Radix + Tailwind), TanStack Query, React Router, React Hook Form + Zod, and Supabase. Auth is a local VITE_APP_PASSWORD gate (Clerk is NOT used at runtime despite a leftover dep). Tests use Vitest + React Testing Library. Focus on: bugs, logic errors, security issues (incl. Supabase RLS, password gate boundaries), performance problems (incl. unnecessary re-renders, missing query keys), missing edge cases, accessibility on Radix components, and code style. Be thorough and adversarial — assume the author missed something. Format your review as a numbered list of issues with file paths and line references where possible."
```

**Subagent 2 — Gemini Review:**

Shell out to Gemini CLI in non-interactive headless mode. Pipe the diff as context. A `GOOGLE_CLOUD_PROJECT` prefix is required because Gemini Code Assist rejects Google Workspace accounts without a project id; a spawned shell does not inherit the repo's `.env`. The default below is this repo's project (`auditless`); forks should set `GOOGLE_CLOUD_PROJECT` in their shell to override:

```bash
git diff HEAD | GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-auditless}" gemini -p "You are a senior staff engineer conducting a thorough code review. Review the following diff critically. This is a Vite + React + TypeScript SPA using shadcn/ui (Radix + Tailwind), TanStack Query, React Router, React Hook Form + Zod, and Supabase. Auth is a local VITE_APP_PASSWORD gate (Clerk is NOT used at runtime despite a leftover dep). Tests use Vitest + React Testing Library. Focus on: bugs, logic errors, security issues (incl. Supabase RLS, password gate boundaries), performance problems (incl. unnecessary re-renders, missing query keys, stale TanStack Query cache), missing edge cases, race conditions, accessibility on Radix components, and code style. Be adversarial — assume the author missed something. Format your review as a numbered list of issues with file paths and line references where possible."
```

### Step 3: Analyze the reviews

Once both reviews come back, analyze all feedback items. For each issue raised:

1. **Read the relevant code** to understand the context
2. **Assess validity** — is this a real issue or a false positive?
3. **Categorize** each item as:
   - **Will fix** — valid issue, fixing now
   - **Disagree** — not a real issue, with explanation why
   - **Already handled** — the reviewer missed existing handling
   - **Out of scope** — valid concern but not related to this change

### Step 4: Apply fixes

For items categorized as "Will fix", make the code changes directly.

### Step 5: Report

Present a structured report to the user:

```
## Code Review Summary

### Reviewers
- **Codex**: [number] issues raised
- **Gemini**: [number] issues raised

### Fixes Applied
For each fix:
- **[File:line]** — Description of the issue and what was changed

### Disagreements
For each disagreement:
- **[File:line]** — What was raised and why you disagree

### Out of Scope / Already Handled
Brief list of items that were valid but not actionable in this context.
```

## Important Notes

- Both `codex` and `gemini` commands must be available on PATH
- **Dev container detection**: check `[ -f /.dockerenv ] || [ -n "$REMOTE_CONTAINERS" ] || [ -n "$CODESPACES" ]`. In a dev container, use `codex exec -s unsafe-none --full-auto` instead of `codex review --uncommitted` (the `review` subcommand doesn't work without a sandbox)
- Codex uses `codex review --uncommitted` which reviews all uncommitted changes (non-container environments)
- Gemini uses `-p` flag for non-interactive headless mode with the diff piped via stdin. Always prefix `GOOGLE_CLOUD_PROJECT=auditless` (Workspace account requirement; the spawned shell won't have it from `.env`)
- If either CLI fails (auth issues, network errors), report the failure and continue with the other reviewer's feedback
- Do NOT auto-commit any fixes — just apply them as uncommitted changes for the user to review
