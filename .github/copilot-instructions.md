# Copilot Instructions — Cricket Auction Platform

## Project source of truth

Read `PROJECT_SPEC.md` before implementing or modifying auction functionality.

The project is an admin-controlled cricket auction platform.

## Non-negotiable product rules

- There is ONLY an Admin role for auction control.
- There are NO team logins.
- Teams are configured by the admin before the auction.
- There is NO public bidding.
- Public viewers are READ-ONLY.
- Public viewers can watch the live auction from phones, laptops, TVs, and projectors.
- Men's and women's auctions are completely independent.
- Auction setup can be completed days/weeks before the actual event.
- Auction state must persist across browser closes and later sessions.
- Admin can pause and resume.
- Admin controls current bid, highest team, SOLD, UNSOLD, UNDO, and NEXT PLAYER.
- SOLD/UNSOLD and other auction changes must be persisted.
- Public screens update in real time only from successfully committed database state.
- Firestore security rules must prevent public writes.
- Do not rely on hidden UI buttons for security.

## Stack

Prefer:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Firebase Authentication
- Firestore
- Firebase Storage
- Vercel

Avoid Socket.IO unless there is a demonstrated requirement.

## Architecture

Keep these concerns separate:

- React/UI
- Firebase data access
- auction business logic
- calculations
- validation
- domain types

Do not put auction calculations directly in UI components.

Create reusable auction logic so men's and women's auctions use the same engine with different auction data.

Use strong TypeScript types. Avoid `any`.

## Database

Use Firestore as the source of truth.

Recommended shape:

`tournaments/{tournamentId}`

`tournaments/{tournamentId}/auctions/{auctionId}`

`tournaments/{tournamentId}/auctions/{auctionId}/teams/{teamId}`

`tournaments/{tournamentId}/auctions/{auctionId}/players/{playerId}`

`tournaments/{tournamentId}/auctions/{auctionId}/transactions/{transactionId}`

`tournaments/{tournamentId}/auctions/{auctionId}/history/{historyId}`

Keep men's and women's data separated by auctionId.

Do not trust client-calculated purse or squad data as canonical financial state. Preserve purchase/transaction records so state can be reconstructed.

## Critical auction operations

SOLD is a critical atomic operation.

When SOLD:

- validate player
- validate bid
- validate highest team
- mark player SOLD
- save team
- save price
- save round
- create transaction/history
- update auction state safely

Prevent duplicate SOLD operations.

UNSOLD:

- mark player UNSOLD
- retain the player
- record round/history
- make available for later rounds according to the rules

## Maximum Bid

Maximum Bid is informational only.

Concept:

`currentPurse = startingPurse - completedPurchaseSpend`

`playersNeeded = squadSize - playersPurchased`

`minimumReserve = sum of cheapest eligible remaining player base prices needed`

`maximumBid = max(0, currentPurse - minimumReserve)`

Recalculate after every sale and whenever the eligible player pool changes.

Never use Maximum Bid as a hard bid restriction.

Put the calculation in a pure, unit-testable function.

## Live display

Public routes should be read-only, such as:

- `/live/[tournamentId]`
- `/live/[tournamentId]/men`
- `/live/[tournamentId]/women`

Use Firestore real-time listeners.

The public UI must not contain mutation controls.

Firestore rules must enforce public read-only access.

Build a mobile-first viewer and ensure projector/large-screen readability.

## Persistence

Never rely only on React state.

Current auction state must be persisted in Firestore so the admin can:

- close the browser
- reopen later
- continue from the same player/bid/round
- pause and resume

## Rounds

When a round ends, show a summary and wait for explicit admin action before starting the next round.

Unsold players are retained and can return in subsequent rounds.

## Undo

Implement safe undo for accidental auction actions.

Prefer preserving history rather than destructively deleting it.

Do not implement unsafe arbitrary historical rewrites.

## Development workflow

Do not build the whole application in one shot.

Work phase-by-phase:

1. Project/Firebase setup
2. Tournament creation
3. Team management
4. Player management
5. Auction setup/order
6. Auction engine/state
7. Admin live auction
8. SOLD/UNSOLD/UNDO/PAUSE
9. Purse/squad/max-bid engine
10. Rounds
11. Public live viewer
12. Mobile/QR experience
13. Results/history
14. Security
15. Testing
16. Deployment

For each task:

1. Inspect current repository first.
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

The final application should be production-oriented:

- secure
- persistent
- real-time
- responsive
- testable
- maintainable
- easy for an admin to operate during a live event

Do not add team authentication or public bidding unless the user explicitly changes the requirements.
