# Using GitHub Copilot to Build the Cricket Auction Platform

## Files

- `PROJECT_SPEC.md` — complete product specification and architecture.
- `.github/copilot-instructions.md` — instructions Copilot should follow for the repository.

## Recommended workflow

### 1. Create the project repository

Create a GitHub repository and place these files at:

```text
your-project/
├── PROJECT_SPEC.md
└── .github/
    └── copilot-instructions.md
```

If you already have a Next.js project, copy these files into its root.

### 2. Open the repository in VS Code

Open the entire repository folder, not just an individual file.

Make sure GitHub Copilot / Copilot Chat is enabled.

### 3. Start with planning, not code

In Copilot Chat, ask:

> Read PROJECT_SPEC.md and inspect the entire repository. Do not write code yet. Give me the implementation plan for Phase 1, including the files you expect to create/change, Firebase setup requirements, environment variables, and any decisions that need confirmation.

Review the plan.

### 4. Build one phase at a time

Then ask:

> Implement Phase 1 from PROJECT_SPEC.md. First inspect the existing project. Make only the changes required for this phase. After implementation, run the appropriate typecheck/lint/tests and fix any errors. Do not implement later phases.

Repeat this approach for each phase.

### 5. Use small prompts

Good prompts are specific:

> Implement the tournament creation page from PROJECT_SPEC.md. Reuse the existing layout/components. Add the Firestore data access layer and validation. Do not build teams, players, or auction controls yet. Run typecheck after the changes.

Avoid:

> Build the whole auction website.

The smaller prompts make Copilot less likely to invent architecture or overwrite unrelated work.

---

# Suggested Copilot Prompt Sequence

## Prompt 1 — Understand repository

```text
Read PROJECT_SPEC.md and inspect the entire repository.

Do not modify any files.

Explain:
1. Current project architecture
2. What already exists
3. What is missing
4. Recommended implementation order
5. Any conflicts between the existing code and PROJECT_SPEC.md

Do not write code yet.
```

## Prompt 2 — Phase 1

```text
Implement Phase 1 from PROJECT_SPEC.md.

Set up the project/Firebase foundation and admin authentication as appropriate for the current repository.

Before changing files, inspect the existing code.

Do not implement tournament, player, team, or auction functionality yet.

After implementation:
- run typecheck
- run lint if configured
- fix errors
- summarize changes
```

## Prompt 3 — Tournament

```text
Implement the tournament creation and tournament dashboard phase from PROJECT_SPEC.md.

Requirements:
- create tournament
- store it in Firestore
- support men's and women's auction configuration
- preserve independent auction configuration
- show tournament dashboard
- support saving and returning later

Do not implement live bidding yet.

Run typecheck/lint/tests and fix errors.
```

## Prompt 4 — Teams

```text
Implement team management for the current auction.

Follow PROJECT_SPEC.md exactly.

Admin only:
- add
- edit
- delete
- upload logo
- configure starting purse
- configure squad size

Do not create team authentication or team login.

Keep men's and women's data isolated by auctionId.

Run typecheck/lint/tests.
```

## Prompt 5 — Players

```text
Implement player management according to PROJECT_SPEC.md.

Include:
- player CRUD
- photo upload
- player details
- base price
- status
- search/filter
- auction order

Do not implement live bidding yet.

Run typecheck/lint/tests.
```

## Prompt 6 — Auction engine

```text
Implement the reusable auction domain layer described in PROJECT_SPEC.md.

Create strong TypeScript types and pure functions/services for:
- auction state
- bid validation
- SOLD
- UNSOLD
- purse
- squad count
- players needed
- maximum bid
- rounds

Do not build the final UI yet.

Add unit tests for the calculation and validation functions.

Run all tests and fix failures.
```

## Prompt 7 — Admin live auction

```text
Implement the admin live auction UI using the auction engine.

Include:
- current player
- player photo/details
- base price
- current bid
- highest team
- bid increment controls
- custom bid
- team selector
- SOLD
- UNSOLD
- NEXT PLAYER
- PAUSE
- RESUME
- safe UNDO

Use Firestore as the source of truth.

Do not build the public viewer in this task.

Run typecheck/lint/tests.
```

## Prompt 8 — Maximum Bid

```text
Audit and test the Maximum Bid implementation against PROJECT_SPEC.md.

Verify:
- current purse
- purchased player count
- players needed
- cheapest eligible remaining players
- minimum reserve
- maximum bid
- recalculation after every sale
- informational-only behavior

Add/fix unit tests for edge cases.

Do not make Maximum Bid a hard restriction.
```

## Prompt 9 — Public live viewer

```text
Implement the public read-only live auction viewer from PROJECT_SPEC.md.

Routes:
- /live/[tournamentId]
- /live/[tournamentId]/men
- /live/[tournamentId]/women

Requirements:
- no login
- no mutation controls
- mobile-first
- projector-friendly
- real-time Firestore updates
- current player
- current bid
- highest team
- team status
- SOLD/UNSOLD states

Also update Firestore rules so public users cannot write auction data.

Run tests and verify admin writes still work.
```

## Prompt 10 — QR / sharing

```text
Implement the public live-link and QR-code experience from PROJECT_SPEC.md.

Users should be able to:
- open a tournament live page
- select men's or women's auction when applicable
- copy the live URL
- display/download a QR code if the current stack supports it cleanly

Do not add authentication for public viewers.
```

## Prompt 11 — Results/history

```text
Implement results and auction history according to PROJECT_SPEC.md.

Include:
- team squads
- spending
- remaining purse
- player sale results
- sold/unsold summary
- round information
- transaction/history view

Keep men's and women's results independent.
```

## Prompt 12 — Production audit

```text
Perform a production-readiness audit against PROJECT_SPEC.md.

Do not rewrite the application blindly.

Check:
- Firebase security rules
- public read-only behavior
- admin authorization
- duplicate SOLD protection
- atomic operations
- pause/resume persistence
- undo safety
- maximum bid calculations
- round transitions
- mobile UI
- projector UI
- real-time reconnection behavior
- loading/error states
- TypeScript errors
- lint
- tests

Report every issue first, then fix them in small safe changes.
```

---

# Important Copilot habits

## Always ask Copilot to inspect first

Use:

> Inspect the existing repository before making changes.

This prevents it from assuming a blank project.

## Ask for one feature at a time

Instead of:

> Build teams, players, auction, public display and database.

Use:

> Build player management only.

## Make Copilot verify its work

Always include:

> Run typecheck, lint, and relevant tests and fix errors.

## Keep the specification updated

If we later decide something like:

- different purse for men/women
- minimum squad size
- special player categories
- different bid increments
- different maximum-bid rules

update `PROJECT_SPEC.md` first.

Then tell Copilot:

> Re-read PROJECT_SPEC.md and update the implementation to match the new requirement. Do not change unrelated behavior.

## Use Git commits

After each stable phase, commit the changes.

Example:

```text
feat: add tournament setup
feat: add team management
feat: add player management
feat: add auction engine
feat: add live auction
feat: add public viewer
```

This makes it easy to revert if Copilot makes a bad change.

---

# Best way to work with me + Copilot

You can use this chat for architecture/product decisions and Copilot for implementation.

A good workflow is:

```text
YOU + CHATGPT
     │
     │ decide requirements
     ▼
PROJECT_SPEC.md
     │
     ▼
COPILOT
     │
     │ implements one phase
     ▼
YOUR REPOSITORY
     │
     ▼
run/test
     │
     ▼
YOU + CHATGPT
     │
     │ review next requirement
     ▼
COPILOT
```

If Copilot makes a decision you don't like, don't keep patching randomly. Update the specification, then tell Copilot to bring the implementation back into alignment.

## Very important

Don't paste the entire specification into every Copilot message.

Because `.github/copilot-instructions.md` is already in the repository, Copilot can use it as repository-level guidance. `PROJECT_SPEC.md` is the detailed source of truth that you can explicitly reference when necessary.

