---
description: 'Run adversarial plan review using Codex and Gemini CLI agents, then report improvements and disagreements'
---

# Adversarial Plan Review

Run parallel plan reviews using OpenAI Codex CLI and Google Gemini CLI as adversarial reviewers, then analyze their feedback, apply improvements that make sense, and explain what you disagreed with.

## Workflow

### Step 1: Locate the plan

Find the current plan to review. Check these locations in order:

1. `tasks/todo.md` — active task plan
2. Any file path provided as an argument: $ARGUMENTS
3. The most recently modified `.md` file in `tasks/` or `docs/design/`

If no plan is found, tell the user and stop.

Read the plan content in full.

### Step 2: Gather codebase context

Run a quick scan to understand the current state of the codebase relevant to the plan:

```bash
git diff --stat HEAD
```

Also read `docs/ENGINEERING.md` if it exists, to understand the architecture.

### Step 3: Launch adversarial reviews in parallel

Use **two subagents in parallel**, each shelling out to a different CLI reviewer. Both should run in the background so they execute concurrently.

**Subagent 1 — Codex Review:**

Pipe the plan content to Codex:

```bash
cat <plan-file> | codex -p "You are a principal engineer reviewing an implementation plan before coding begins. The plan is provided below. Also consider that this is a Vite + React + TypeScript SPA using shadcn/ui (Radix primitives + Tailwind CSS), TanStack Query, React Router, React Hook Form + Zod, and Supabase as the backend. Auth is a local `VITE_APP_PASSWORD` gate — Clerk is NOT used at runtime despite a leftover `@clerk/clerk-react` dep. Tests run via Vitest + React Testing Library.

Review this plan critically. Focus on:
- Missing steps or gaps in the implementation sequence
- Architectural risks or wrong abstractions
- Don't repeat yourself principles
- Reuse existing component, keep things simple principle
- Missing error handling, edge cases, or failure modes
- Unclear or ambiguous requirements that will cause rework
- Dependencies between steps that aren't acknowledged
- Over-engineering or unnecessary complexity
- Missing testing strategy
- Security or performance concerns
- Whether the plan accounts for existing code patterns

Be thorough and adversarial — assume the author missed something. Format your review as a numbered list of issues with severity (Critical/Major/Minor) and specific suggestions for improvement."
```

**Subagent 2 — Gemini Review:**

Shell out to Gemini CLI in non-interactive headless mode:

```bash
cat <plan-file> | GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-auditless}" gemini -p "You are a staff engineer and technical lead reviewing an implementation plan before coding begins. The plan is provided below. Also consider that this is a Vite + React + TypeScript SPA using shadcn/ui (Radix primitives + Tailwind CSS), TanStack Query, React Router, React Hook Form + Zod, and Supabase as the backend. Auth is a local `VITE_APP_PASSWORD` gate — Clerk is NOT used at runtime despite a leftover `@clerk/clerk-react` dep. Tests run via Vitest + React Testing Library.

Review this plan critically. Focus on:
- Missing steps or gaps in the implementation sequence
- Architectural risks or wrong abstractions
- Don't repeat yourself principles
- Reuse existing component, keep things simple principle
- Missing error handling, edge cases, or failure modes
- Unclear or ambiguous requirements that will cause rework
- Dependencies between steps that aren't acknowledged
- Over-engineering or unnecessary complexity
- Missing testing strategy
- Security or performance concerns
- Whether the plan is feasible given typical project constraints
- Alternative approaches that would be simpler or more robust

Be adversarial — assume the author missed something. Format your review as a numbered list of issues with severity (Critical/Major/Minor) and specific suggestions for improvement."
```

### Step 4: Analyze the reviews

Once both reviews come back, analyze all feedback items. For each issue raised:

1. **Read the relevant plan section** to understand the context
2. **Check the codebase** if needed to validate assumptions
3. **Assess validity** — is this a real gap or a false positive?
4. **Categorize** each item as:
   - **Will incorporate** — valid issue, updating the plan
   - **Disagree** — not a real concern, with explanation why
   - **Already covered** — the reviewer missed existing plan content
   - **Good idea, deferred** — valid but better handled in a future iteration

### Step 5: Apply plan improvements

For items categorized as "Will incorporate", edit the plan file directly to address them.

### Step 6: Report

Present a structured report to the user:

```
## Plan Review Summary

### Plan Reviewed
- **File**: [path to plan file]
- **Scope**: Brief description of what the plan covers

### Reviewers
- **Codex**: [number] issues raised
- **Gemini**: [number] issues raised

### Improvements Applied
For each improvement:
- **[Severity]** — Description of the gap and how the plan was updated

### Disagreements
For each disagreement:
- **[Severity]** — What was raised and why you disagree

### Deferred Ideas
Brief list of good suggestions that should be tracked for future iterations.

### Good Ideas, Deferred
Brief list of valid suggestions not applicable to the current scope.
```

## Important Notes

- Both `codex` and `gemini` commands must be available on PATH
- Codex uses `-p` flag for non-interactive headless mode with the plan piped via stdin
- Gemini uses `-p` flag for non-interactive headless mode with the plan piped via stdin. Always prefix `GOOGLE_CLOUD_PROJECT=auditless` (Workspace account requirement; the spawned shell won't have it from `.env`)
- If either CLI fails (auth issues, network errors), report the failure and continue with the other reviewer's feedback
- Plan edits are saved directly to the file — the user can review the diff with `git diff`
- Do NOT auto-commit any changes — leave them as uncommitted for the user to review
