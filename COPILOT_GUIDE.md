# Using GitHub Copilot to Build the PNPL Cricket Auction Platform

## Repository source of truth

- `PROJECT_SPEC.md` — product requirements and target MongoDB + Google Drive architecture.
- `.github/copilot-instructions.md` — repository-level implementation instructions.

The project uses:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- MongoDB Atlas
- MongoDB-backed admin sessions
- Google Drive for external player/team photos/files
- Vercel

**Firebase is no longer part of the target architecture.**

## Recommended workflow

### 1. Inspect before coding

Ask Copilot:

```text
Read PROJECT_SPEC.md and inspect the entire repository.

Do not modify any files.

Explain:
1. Current architecture
2. What already works
3. What is still legacy
4. What conflicts with PROJECT_SPEC.md
5. Recommended implementation order

Do not write code yet.
```

### 2. Work one phase at a time

Use small prompts. Do not ask Copilot to build the whole auction platform in one shot.

For every phase:

- inspect first
- reuse existing code
- make the smallest coherent change
- run typecheck
- run lint when configured
- run relevant tests
- fix errors
- summarize changes

### 3. Current implementation order

Recommended phases:

1. Architecture/documentation migration
2. Permanent system-generated Player IDs
3. Tournament creation
4. Men's/women's competition separation
5. Team management
6. Player/tournament pool management
7. Google Drive integration
8. Auction setup/order
9. Auction engine
10. Admin live auction
11. SOLD/UNSOLD/UNDO/PAUSE
12. Maximum Bid/purse/squad calculations
13. Rounds
14. Public live viewer
15. Results/history
16. Historical Excel import
17. Excel export
18. Security/testing
19. Deployment

## Architecture migration prompt

Use this when beginning the MongoDB/Google Drive migration:

```text
Read PROJECT_SPEC.md and .github/copilot-instructions.md.

Inspect the current repository before changing anything.

Implement ONLY the architecture/documentation migration required to align the repository with the current specification:

- MongoDB Atlas is the application data source of truth.
- Existing MongoDB admin authentication/session code remains in use.
- Google Drive is the planned external file/photo store.
- Firebase is no longer part of the target architecture.
- Do not introduce Firebase dependencies.
- Do not redesign any UI.
- Do not change or delete existing player data.
- Do not change Player IDs in this phase.
- Do not implement tournaments, teams, auction engine, history import, or Google Drive API integration yet.

Update project documentation/instructions so future Copilot work does not reintroduce Firebase.

Inspect for Firebase-specific references before removing or changing anything.

Run typecheck/lint if available. Do not modify unrelated application code.

At the end, report:
1. Files changed
2. Firebase references that remain and why
3. Verification performed
4. Anything that must wait for the next phase
```

## Important migration rules

Do not:

- delete the `players` collection
- delete the existing 47 players
- recreate player records unnecessarily
- change Player IDs during architecture cleanup
- redesign existing pages
- introduce Firebase
- add Socket.IO just because the old design used Firebase listeners

Do:

- reuse the existing MongoDB connection
- reuse the existing admin session system
- preserve current player UI
- keep legacy files temporarily if they are still referenced
- remove legacy Firebase files only after confirming they are unused

## Player ID phase

After architecture cleanup, use a separate prompt:

```text
Implement ONLY the permanent Player ID migration described in PROJECT_SPEC.md.

Inspect the existing players collection and current Excel importer first.

Requirements:
- Player Excel must not require a Player ID.
- Generate permanent IDs such as P001, P002, P003 when a player is first created.
- Existing player records must be preserved.
- Existing Player IDs must never change.
- Do not delete/recreate the 47 existing players.
- Do not redesign the player UI.
- Make the import safe against duplicate rows.
- Add tests for ID generation and existing-ID preservation.

Run typecheck/lint/tests and fix errors.

Do not implement tournaments or auction functionality in this task.
```

## General Copilot habits

Always ask Copilot to inspect the repository first.

Prefer:

> Inspect the existing repository before making changes.

Avoid:

> Build the whole auction website.

When a requirement changes:

1. Update `PROJECT_SPEC.md`.
2. Update `.github/copilot-instructions.md` if the rule affects implementation behavior.
3. Then ask Copilot to align the implementation with the new specification.

Keep commits small and meaningful, for example:

```
chore: migrate project architecture docs to mongodb
feat: add permanent player ids
feat: add tournament setup
feat: add team management
feat: add auction engine
feat: add public live viewer
```

Never include secrets in source control.

## Division of work

Use this chat for:

- product requirements
- architecture
- data-model decisions
- migration planning
- reviewing Copilot output

Use Copilot for:

- repository edits
- implementation
- typecheck/lint/test execution

Keep the repository specification updated so both remain aligned.
