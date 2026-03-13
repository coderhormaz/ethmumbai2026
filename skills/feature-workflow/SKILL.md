---
name: feature-workflow
description: "Structured 9-phase workflow for building features systematically. Use when: implementing a new feature, adding functionality, building a module, designing an integration, or any non-trivial code change. Phases: explore codebase → plan all changes → clarify requirements → architect solution → design review → UX flow review → implement → code review → quality gate. Invokes code-explorer to trace execution paths and map architecture, code-architect to propose approaches with trade-offs, and code-reviewer to catch bugs, security issues, and convention violations with confidence-scored findings. Includes UX flow review to verify user-side states, transitions, and logical flows before coding. Use for: feature development, module creation, refactoring large components, API integration, system design."
argument-hint: "Brief description of the feature to build (e.g. 'add JWT refresh token support')"
---

# Feature Workflow

A disciplined 9-phase process: explore → plan → clarify → architect → design-review → UX-review → implement → code-review → quality-gate. Each phase has a concrete deliverable and a hard gate before proceeding. Never skip phases.

## Phases at a Glance

| # | Phase | Role | Deliverable |
|---|-------|------|-------------|
| 1 | **Explore** | code-explorer | Architecture map + execution trace |
| 2 | **Plan** | You | Ordered change list — every file, every task |
| 3 | **Clarify** | You + user | Signed-off requirements |
| 4 | **Architect** | code-architect | 2–3 approaches with trade-offs |
| 5 | **Design Review** | code-reviewer | Green-lit design (pre-code) |
| 6 | **UX Flow Review** | You + user | User journey verified — all states logical, no dead ends |
| 7 | **Implement** | You | Working code, committed incrementally |
| 8 | **Code Review** | code-reviewer | Confidence-scored findings, all criticals resolved |
| 9 | **Quality Gate** | You | Lint clean, tests pass, docs updated |

---

## Phase 1 — Explore

**Input**: Feature description  
**Output**: Explorer Report (use [code-explorer prompt](./references/code-explorer.md))  
**Gate**: You can answer — *"Which files are involved, and what patterns must the feature follow?"*

The Explorer Report must cover:

| Section | Deliverable |
|---------|-------------|
| Execution trace | Entry → service → data → response path, every file in order |
| Architecture map | Layer diagram, file→responsibility, any violations |
| Conventions | Naming, error-handling, async, state, import style (with real examples) |
| Integration points | Exact plug-in locations, types to extend, files that will import new code |
| Risk flags | Fragile code, TODOs, FIXMEs, dead code in the area |

---

## Phase 2 — Plan

**Input**: Explorer Report  
**Output**: Change Plan + active todo list  
**Gate**: Every task has a file, a change, and an order. Zero open questions. Todo list created.

Produce the Change Plan in this exact format:

```
FILES TO CREATE
  path/to/file.ts — purpose (exports: X, depends on: Y)

FILES TO MODIFY
  path/to/file.ts — what changes | why | breaks existing? yes/no

TASK ORDER  (types/schema first → services → UI last)
  [ ] 1. description (file: path)
  [ ] 2. description (file: path)
  ...

CRITICAL PATH  (tasks that block others or touch shared code)
  - task N blocks tasks M, P — reason
```

Ordering rules: schema/migrations → types/interfaces → services → stores → components → tests.

**After presenting the Change Plan**: create a `manage_todo_list` with one item per task from TASK ORDER, all set to `not-started`. This is the live tracking list for Phase 7.

---

## Phase 3 — Clarify

**Input**: Feature description + Explorer Report  
**Output**: Requirements Summary (≤20 bullets) — explicit user sign-off required  
**Gate**: User confirms summary is complete and correct.

Cover every row before writing the summary:

| Category | Questions to resolve |
|----------|---------------------|
| Scope | What must it do? What is out of scope? |
| Edge cases | Empty state, error state, concurrent access, permission boundaries |
| Acceptance | How do we know it's done? (behaviour, not implementation) |
| Constraints | Perf budget, bundle size, backward compatibility |
| Dependencies | External APIs, libraries, infra needs |

---

## Phase 4 — Architect

**Input**: Explorer Report + Requirements Summary  
**Output**: 2–3 approaches with trade-offs + recommendation (use [code-architect prompt](./references/code-architect.md))  
**Gate**: User selects an approach; choice + rationale documented.

Each approach must include: name, core idea (1–2 sentences), files changed/created, trade-off table (complexity / perf / testability / reversibility / coupling), risk level + rationale, and best-when scenario. End with a direct recommendation grounded in Phase 1 patterns.

---

## Phase 5 — Design Review

**Input**: Chosen approach + Explorer Report  
**Output**: Scored findings list + gate decision (use [code-reviewer prompt Mode A](./references/code-reviewer.md))  
**Gate**: Zero 🔴 findings. All 🟡 acknowledged or resolved. → If 🔴 exists, return to Phase 4.

| Review dimension | Checks |
|-----------------|--------|
| Consistency | Fits layer structure; no duplicate abstractions; no circular deps |
| Security (OWASP) | Access control, injection, data exposure, SSRF, misconfiguration |
| Scalability | N+1 queries, unbounded loops, sync blocking, cache strategy |
| Testability | Core logic isolatable from I/O; failures injectable |
| Reversibility | Rollback cost; hard migrations flagged |

Findings format: `🔴/🟡/🟢 [Area] — description | impact | fix`

---

## Phase 6 — UX Flow Review

**Input**: Chosen approach + Requirements Summary  
**Output**: Journey map + state inventory — explicit user sign-off required  
**Gate**: User confirms all flows are correct. Zero ❌ in state inventory. No open UX questions.

**Step 1 — Journey Map.** Write the full happy-path step-by-step for each user role / entry point:
```
User lands on X → clicks Y → sees Z → inputs W → result V
```

**Step 2 — State Inventory.** Fill this table for every affected screen/component. Any ❌ = user-visible bug; resolve before proceeding.

| State | User sees | Trigger | Handled? |
|-------|-----------|---------|----------|
| Loading | Skeleton / spinner | async in-flight | ✅/❌ |
| Empty | Zero-data message | no records | ✅/❌ |
| Error | Message + recovery CTA | request failed | ✅/❌ |
| Partial/degraded | Fallback UI | partial data | ✅/❌ |
| Success | Confirmation feedback | action done | ✅/❌ |
| No permission | Locked / hidden UI | auth boundary | ✅/❌ |

**Step 3 — Flow Logic Checklist.**
- [ ] No dead ends (user can always proceed or go back)
- [ ] No circular loops in navigation
- [ ] Every destructive action has a confirmation step
- [ ] Every form shows inline validation before submit
- [ ] Every async action updates UI on both success and failure
- [ ] Post-action redirects are correct (after delete/submit, where does user land?)
- [ ] Flows match existing app patterns (no invented paradigms)
- [ ] Back/forward navigation handled; mid-flow exit handled
- [ ] Session expiry mid-flow handled

---

## Phase 7 — Implement

**Input**: Phase 2 Change Plan (task checklist) + Phase 4 chosen approach  
**Output**: Working code; every Phase 2 task checked off; todo list fully completed  
**Gate**: All Phase 2 tasks ✅ in the todo list. Feature satisfies every acceptance criterion from Phase 3.

Discipline rules — no exceptions:
- **Before starting**: ensure the `manage_todo_list` from Phase 2 is visible and accurate
- **For each task**: mark it `in-progress` → implement → confirm compile/run → mark `completed` immediately
- Work tasks in Phase 2 order; never jump ahead
- Follow Phase 1 conventions exactly — naming, error handling, async, imports
- Smallest meaningful change at a time; no unrequested refactors or extras
- Validate only at system boundaries (user input, external APIs)
- No defensive code for impossible scenarios; no speculative abstractions
- Comments only where logic is non-obvious
- **After every task**: update the todo list status before moving to the next

---

## Phase 8 — Code Review

**Input**: Diff / changed files only + Phase 1 conventions  
**Output**: Confidence-scored findings (use [code-reviewer prompt Mode B](./references/code-reviewer.md))  
**Gate**: Zero 🔴. All 🟡 resolved or accepted with written justification. → If blocked, fix and re-run.

| Scan area | What to check |
|-----------|---------------|
| Security (OWASP) | Injection (SQL/XSS/cmd), broken access control, data exposure, SSRF, hardcoded secrets |
| Bugs | Null/undefined deref, off-by-one, race conditions, stale closures, unhandled rejections, missing cleanup |
| Conventions | Naming vs Phase 1 catalog, layer violations, import style, error-handling style |
| Quality | Single-responsibility, no dead code, no `console.log`, no `any` |

Finding format: `🔴/🟡/🟢 file:line — title | code snippet | problem | fix`

---

## Phase 9 — Quality Gate

**Input**: Implemented feature post Phase 8 review  
**Output**: Shippable feature  
**Gate**: Every item below is ✅. Feature is shippable.

**Step 1 — Verify the todo list.** Open the `manage_todo_list` from Phase 2. Every single task must show `completed`. If any task is `not-started` or `in-progress`, stop — return to Phase 7 and finish it.

**Step 2 — Run the quality checklist:**

- [ ] All Phase 2 todo items: `completed` ✅
- [ ] Linter passes — zero errors (`eslint`, `tsc --noEmit`, or project equivalent)
- [ ] Existing tests pass
- [ ] New tests cover critical paths (if project has a test suite)
- [ ] No `console.log`, dead code, or commented-out blocks
- [ ] No `any` — all types explicit
- [ ] Feature works: happy path ✅ + all error states ✅
- [ ] All Phase 6 UX states (loading, empty, error, success, no-permission) verified in the running app
- [ ] Docs updated (README / inline / API) if public surface changed
- [ ] No secrets hard-coded; env vars documented

**Step 3 — Final confirmation.** Present the completed todo list and the checked quality checklist to the user. Confirm: *"Every planned task is done. Every quality check passed. This feature is shippable."*

---

## Sub-Agent Prompts

- Phase 1: [code-explorer](./references/code-explorer.md)
- Phase 4: [code-architect](./references/code-architect.md)
- Phase 5 + 8: [code-reviewer](./references/code-reviewer.md) (Mode A = design, Mode B = code)

---

## Execution Protocol

1. Ask: *"What feature are you building?"* (one sentence)
2. **Phase 1** — run code-explorer subagent; present Explorer Report
3. **Phase 2** — produce Change Plan; create `manage_todo_list` (one item per task, all `not-started`); present to user; get acknowledgement
4. **Phase 3** — fill requirements table; get sign-off
5. **Phase 4** — run code-architect; present approaches; user picks one
6. **Phase 5** — run code-reviewer Mode A; resolve findings; get PROCEED
7. **Phase 6** — fill journey map + state inventory + logic checklist; get user sign-off
8. **Phase 7** — for each task in order: mark `in-progress` → implement → compile/run → mark `completed`; never batch completions
9. **Phase 8** — run code-reviewer Mode B on diff; resolve all findings
10. **Phase 9** — verify todo list: all `completed`; run quality checklist; present final confirmation to user

**Never skip a phase. Never start a phase before the previous phase's gate is passed. Never mark a task completed before the code compiles and runs.**
