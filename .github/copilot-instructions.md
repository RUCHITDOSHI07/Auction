# Copilot Instructions — PNPL Cricket Auction Platform

## Source of truth

Read `PROJECT_SPEC.md` before implementing or modifying auction functionality.

The project is an admin-controlled cricket auction platform using **MongoDB Atlas for application data** and **Google Drive for external file/photo storage**.

## Non-negotiable product rules

- There is ONLY an Admin role for auction control.
- There are NO team logins.
- There is NO public bidding.
- Public viewers are READ-ONLY.
- Men's and women's competitions are completely independent.
- Men's and women's teams are different records.
- Auction state must persist across browser closes and later sessions.
- Admin can pause and resume.
- Admin controls current bid, highest team, SOLD, UNSOLD, UNDO, and NEXT PLAYER.
- SOLD/UNSOLD and other auction changes must be persisted.
- Public screens may only display successfully persisted auction state.
- Never rely on frontend-only security.
- Do not use Firebase.
- Do not introduce Firebase Authentication, Firestore, Firebase Storage, or Firebase real-time listeners.
- Do not add team authentication or public bidding unless the user explicitly changes the requirements.

## Stack

Prefer:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- MongoDB Atlas
- MongoDB Node.js driver
- bcryptjs
- MongoDB-backed HTTP-only admin sessions
- Google Drive for player/team photos and files
- Vercel

Avoid Socket.IO unless there is a demonstrated requirement.

## Existing architecture

The repository already contains working MongoDB/admin foundations.

Reuse:

- `lib/mongodb.ts`
- existing MongoDB services
- `admins` collection
- `adminSessions` collection
- existing admin session cookie/authentication
- existing player UI and Excel UI

Do not replace working MongoDB authentication with another authentication system.

## Database

MongoDB Atlas is the source of truth.

Target collections:

```
admins
adminSessions
tournaments
players
teams
auctions
auctionTransactions
auctionHistory
playerTournamentHistory
settings
```

Keep canonical purchase/transaction records so results and derived purse/squad values can be reconstructed.

Use `tournamentId`, `auctionId`, and `gender`/competition to prevent cross-tournament and cross-gender relationships.

## Permanent Player ID

Player master records have permanent system-generated IDs:

```
P001
P002
P003
```

The normal player Excel file does NOT require a Player ID.

The application generates the ID when the player is first created.

Once assigned, the ID never changes.

Historical tournament Excel files use this Player ID for matching.

Do not change existing player IDs during unrelated architecture work.

Do not delete existing player records.

## Gender isolation

Gender separation is enforced at the data/API layer, not only through UI filters.

Reject invalid combinations such as:

- male auction + female player
- male auction + female team
- wrong tournament + player/team
- wrong auction + transaction

Reuse the same business logic for men and women, but never mix their records.

## Google Drive

Google Drive is the external file/photo store.

MongoDB should store file IDs/references and appropriate URLs/metadata, not image binary data.

Keep Google Drive integration in a service such as:

`lib/storage/googleDrive.ts`

Do not put Drive API credentials or calls directly into React components.

## Auction architecture

Keep these concerns separate:

- React/UI
- API/server routes
- authentication/authorization
- MongoDB data access
- Google Drive storage
- auction business logic
- calculations
- validation
- domain types

Do not put complex auction calculations directly in UI components.

Create reusable auction logic so men's and women's auctions use the same engine with different auction data.

## Critical auction operations

SOLD is a critical mutation.

When SOLD:

- validate auction
- validate tournament
- validate gender
- validate current player
- validate bid
- validate highest team
- prevent duplicate SOLD
- persist player sale state
- create canonical transaction/history
- persist auction state safely

Use MongoDB atomic operations/transactions where appropriate.

UNSOLD:

- retain the player
- record the round
- do not create a purchase
- allow later-round eligibility according to the rules

## Maximum Bid

Maximum Bid is informational only.

Concept:

`currentPurse = startingPurse - completedPurchaseSpend`

`playersNeeded = squadSize - playersPurchased`

`minimumReserve = sum of cheapest eligible remaining player base prices needed`

`maximumBid = max(0, currentPurse - minimumReserve)`

Recalculate after every sale and when the eligible pool changes.

Never use Maximum Bid as a hard restriction.

Put the calculation in a pure, unit-testable function.

## Public live viewer

Public routes may follow:

- `/live/[tournamentId]`
- `/live/[tournamentId]/men`
- `/live/[tournamentId]/women`

Public UI must:

- require no team login
- contain no mutation controls
- be mobile-first
- be projector-friendly
- display persisted auction state

MongoDB is the source of truth.

Prefer simple server/API polling or refresh behavior for the first implementation. Do not add Socket.IO just to imitate the old Firebase architecture.

## Persistence

Never rely only on React state.

Auction state must be persisted in MongoDB so the admin can:

- close the browser
- reopen later
- continue from the same player/bid/round
- pause and resume

## Historical tournaments

Previous tournaments remain permanently stored.

Historical player performance/participation belongs in `playerTournamentHistory`.

Historical data may be incomplete. Missing values must remain null/unavailable rather than being silently changed to zero.

Historical Excel uses permanent Player IDs.

Do not build direct CricClubs integration unless explicitly requested.

## Migration safety

This repository contains existing player data.

During architecture migration:

- DO NOT delete the MongoDB `players` collection.
- DO NOT delete existing player records.
- DO NOT reset or recreate the 47 existing players.
- DO NOT redesign the existing UI.
- DO NOT change Player IDs unless the dedicated Player ID migration phase explicitly requires it.
- Do not introduce Firebase.
- Reuse existing working MongoDB code.
- Legacy Firebase files may remain temporarily, but new code must not depend on them.
- Only remove legacy Firebase files after checking for references/imports.

## Development workflow

Do not build the whole application in one shot.

Work phase-by-phase:

1. Architecture/documentation migration
2. Permanent Player ID
3. Tournament creation
4. Team management
5. Player/tournament pool management
6. Google Drive storage
7. Auction setup/order
8. Auction engine/state
9. Admin live auction
10. SOLD/UNSOLD/UNDO/PAUSE
11. Purse/squad/max-bid engine
12. Rounds
13. Public live viewer
14. Results/history
15. Historical Excel import
16. Excel exports
17. Security/testing
18. Deployment

For each task:

1. Inspect the existing repository first.
2. Read relevant parts of `PROJECT_SPEC.md`.
3. Reuse existing code where possible.
4. Implement the smallest coherent change.
5. Run typecheck/lint/tests.
6. Fix errors.
7. Summarize files changed and verification performed.
8. Do not move to unrelated features without instruction.

Do not overwrite working functionality unnecessarily.

If a requirement is ambiguous, use the simplest interpretation consistent with `PROJECT_SPEC.md`, state the assumption, and proceed.

## Quality bar

The final application should be:

- secure
- persistent
- responsive
- testable
- maintainable
- easy for an admin to operate during a live event

Avoid unnecessary dependencies and architecture complexity.
