# Cricket Auction Platform — Project Specification

## 1. Product Overview

Build a hosted cricket player auction platform for a tournament.

The platform has exactly two operational experiences:

1. **Admin** — authenticated, full control of tournament setup and live auction.
2. **Public Live Viewer** — unauthenticated, read-only live auction experience usable on phones, laptops, TVs, and projectors.

There are **NO team logins**, **NO team accounts**, and **NO public bidding**.

The admin prepares the complete tournament and auction data before auction day. The auction can be started later, paused, resumed, and completed over multiple sessions.

The public display must change only when the admin changes/saves the auction state.

---

# 2. Core Principles

- Admin is the only person who can modify data.
- Public viewers are strictly read-only.
- Never depend on frontend-only security. Firestore security rules must enforce permissions.
- Firestore is the source of truth.
- Auction state must persist so the admin can close the browser and continue later.
- Men’s and women’s auctions are completely independent.
- Never mix players, teams, purse, transactions, rounds, or state between men and women.
- Use reusable components and services; do not duplicate auction logic for men and women.
- Financial calculations must be deterministic and testable.
- SOLD operations must be atomic.
- Undo must safely reverse a completed auction transaction.
- Maximum Bid is informational only. It must never automatically block the admin from entering a higher bid.
- Public display must not contain mutation controls.

---

# 3. Recommended Technology

Use:

- Next.js with App Router
- TypeScript
- React
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Storage for player/team images
- Vercel for hosting
- Firestore real-time listeners for live synchronization

Do not introduce Socket.IO unless there is a demonstrated need.

---

# 4. User Roles

## Admin

Admin can:

- Create tournaments
- Edit tournament setup
- Add/edit/delete teams
- Add/edit/delete players
- Upload images
- Configure men's and women's auctions
- Arrange player auction order
- Preview and mark auctions ready
- Start/pause/resume auctions
- Control current bid
- Select highest team
- Mark players SOLD
- Mark players UNSOLD
- Undo the latest completed auction action when safe
- Start subsequent rounds
- View history
- View results

## Public Viewer

Public viewers can:

- Open a shared live URL
- View the current live auction
- View current player
- View current bid
- View highest team
- View team status
- View SOLD/UNSOLD states
- View relevant auction information

Public viewers cannot:

- Log in as a team
- Bid
- Edit
- Mark SOLD/UNSOLD
- Pause/resume
- Change players
- Modify purse
- Modify team information
- Modify player information
- Write to Firestore

---

# 5. Tournament Lifecycle

A tournament contains independent men's and women's auctions.

Suggested statuses:

- NOT_STARTED
- READY
- IN_PROGRESS
- PAUSED
- COMPLETED

A tournament may be prepared days/weeks before the event.

The admin can:

1. Create tournament.
2. Configure men's auction.
3. Configure women's auction.
4. Add teams.
5. Add players.
6. Set base prices.
7. Set auction order.
8. Preview.
9. Mark auction READY.
10. Leave the application.
11. Return on auction day.
12. Start the required auction.

---

# 6. Tournament Setup

Tournament fields:

- tournamentId
- name
- logo
- description
- createdAt
- updatedAt

Each auction should have its own configuration:

- auctionId
- tournamentId
- type: "men" | "women"
- startingPurse
- squadSize
- minimumSquadSize (optional if required)
- bidIncrement
- status
- currentRound
- currentPlayerId
- createdAt
- updatedAt

Men's and women's configurations must be independent.

---

# 7. Team Management

Teams are entered by the admin before the auction.

Team fields:

- teamId
- auctionId
- name
- logo
- startingPurse
- squadSize
- createdAt
- updatedAt

Do not create team authentication.

Do not create team passwords.

Do not create team dashboards.

Team selection during bidding is an admin action.

Current purse and squad count should be derived from canonical purchase/transaction data where practical rather than trusting mutable frontend values.

---

# 8. Player Management

Player fields:

- playerId
- auctionId
- name
- photoUrl
- age
- role
- battingStyle
- bowlingStyle
- basePrice
- auctionOrder
- status
- soldToTeamId (nullable)
- soldPrice (nullable)
- soldRound (nullable)
- createdAt
- updatedAt

Player statuses:

- AVAILABLE
- ON_AUCTION
- SOLD
- UNSOLD

Admin must be able to:

- Add
- Edit
- Delete
- Search
- Filter
- Sort
- Reorder

Player images should be stored in Firebase Storage, with the URL/reference saved in Firestore.

---

# 9. Auction Order

The admin must be able to configure the player order before auction day.

Required functionality:

- Display numbered order
- Drag/drop or equivalent reorder interaction
- Move up/down fallback
- Save order

Auction order is independent for men's and women's auctions.

---

# 10. Auction Preview / Ready State

Before an auction is live, show a validation/preview screen.

Validate:

- Teams exist
- Players exist
- Starting purse configured
- Squad size configured
- Bid increment configured
- Auction order is valid
- Required player/team information exists

Allow:

- EDIT
- MARK READY / LOCK

Do not allow unsafe setup changes while an auction is IN_PROGRESS unless explicitly designed as an admin correction workflow.

---

# 11. Admin Live Auction

The admin auction screen should contain:

## Current Player

Show:

- Large player image
- Name
- Role
- Age
- Batting style
- Bowling style
- Base price

## Current Bidding

Show:

- Current bid
- Highest/current team

Controls:

- Bid increment buttons
- Custom bid input
- Highest team selector
- SOLD
- UNSOLD
- UNDO
- PAUSE
- RESUME
- NEXT PLAYER

The exact bid increment may be configurable per auction.

The admin remains the source of bidding truth. The application is not an automated multi-user bidding platform.

---

# 12. Bid Validation

At minimum:

- Current bid cannot be below base price.
- A new bid should normally be >= current bid + configured increment when using increment controls.
- Custom bid should be validated according to the configured auction rules.
- Highest team is required before SOLD.
- SOLD price must equal the saved current bid.
- Do not allow SOLD twice for the same player.
- Do not allow a player already SOLD to return to active auction except through an explicit safe correction/undo workflow.
- The admin may intentionally exceed Maximum Bid because Maximum Bid is informational only.

---

# 13. Maximum Bid Engine

Maximum Bid is a display/strategy aid.

For each team:

currentPurse = startingPurse - total completed purchase spend

playersPurchased = count of SOLD players for that team

playersNeeded = squadSize - playersPurchased

minimumReserve = sum of the base prices of the cheapest eligible remaining players needed to fill the squad

maximumBid = max(0, currentPurse - minimumReserve)

Important:

- Recalculate after every completed sale.
- Recalculate for every team because the remaining player pool changes.
- Maximum Bid is NOT a hard limit.
- The admin can enter a higher bid.
- Do not let a frontend-only cached number become the source of truth.
- Put the calculation in a pure, unit-testable TypeScript function.

Define "eligible remaining players" consistently. Prefer a central calculation function/configuration so the rule can be changed without rewriting UI code.

Unsold players that will return in future rounds should be considered consistently according to the chosen auction rule. Do not silently change the interpretation between rounds.

---

# 14. SOLD Operation

SOLD must be treated as a critical atomic operation.

When admin clicks SOLD:

1. Validate current auction state.
2. Validate current player.
3. Validate selected highest team.
4. Validate current bid.
5. Mark player SOLD.
6. Save soldToTeamId.
7. Save soldPrice.
8. Save soldRound.
9. Create a transaction/history record.
10. Update/persist auction state.
11. Ensure the operation cannot be accidentally executed twice.
12. Recalculate team-derived values for UI.

Use Firestore transactions/batches where appropriate.

The database must retain enough canonical data to reconstruct results.

---

# 15. UNSOLD Operation

When admin clicks UNSOLD:

- Mark player UNSOLD.
- Save round.
- Do not delete the player.
- Do not create a purchase transaction.
- Make the player eligible for later rounds according to the round rules.
- Save auction history/state.

---

# 16. Rounds

Round 1 includes the initial auction pool.

After all players in the current round have been processed:

Show:

- Round number
- Total players
- Sold count
- Unsold count

Example:

"ROUND 1 COMPLETE — 48 Players — 35 Sold — 13 Unsold"

Admin manually clicks:

START ROUND 2

Unsold players return to the eligible auction pool.

Repeat for Round 3 or more as required.

Never automatically jump into the next round without an explicit admin action.

---

# 17. Pause / Resume / Persistence

At any point during an auction, admin can pause.

On pause:

- Persist current auction state.
- Preserve current player.
- Preserve current bid.
- Preserve highest team.
- Preserve round.
- Preserve history.
- Preserve all completed transactions.

After closing/reopening the browser, the admin can resume.

The system must never rely only on React state for auction persistence.

---

# 18. Undo

Provide a safe Undo workflow for accidental actions.

Undo should reverse the relevant canonical operation, for example:

- Reverse player SOLD status
- Reverse team purchase
- Restore purse derived from transactions
- Restore squad derived from transactions
- Restore auction state
- Restore maximum bid calculation

Prefer an append-only history/event approach where practical instead of destructive history deletion.

Define clearly what actions are undoable and prevent unsafe undo of unrelated historical transactions.

---

# 19. Public Live Viewer

Create public read-only routes such as:

- /live/[tournamentId]
- /live/[tournamentId]/men
- /live/[tournamentId]/women

The public viewer must be mobile-first.

It should work on:

- iPhone
- Android
- Tablet
- Laptop
- TV
- Projector

Show:

- Tournament name/logo
- Live status
- Current player
- Player photo
- Player details
- Base price
- Current bid
- Highest team
- Team purse
- Squad count
- Players needed
- Maximum Bid if intended for public viewing
- SOLD/UNSOLD state
- Round information

Do not show admin controls.

Do not expose sensitive admin information.

---

# 20. Public Mobile UX

The mobile viewer should be intentionally designed for phones, not merely desktop-responsive.

Recommended structure:

1. Tournament header
2. LIVE indicator
3. Current player card
4. Current bid
5. Highest team
6. Team status list/cards
7. Auction/round status

Large numbers and readable typography are important because users may watch from a distance or while moving.

---

# 21. Projector / Large Display UX

Provide a display-friendly layout.

Use:

- Large player image
- Large player name
- Large current bid
- Highest team prominently displayed
- Team status table
- High readability
- Full-screen friendly layout

The same public route can be responsive, or a dedicated display route can be created if needed.

---

# 22. Real-Time Synchronization

Firestore real-time listeners should power the live display.

Flow:

Admin UI
→ Firestore
→ real-time listener
→ Public viewer / projector

Public viewers do not submit auction actions.

If admin changes the current bid, public screens update.

If admin clicks SOLD, public screens update.

If admin clicks UNSOLD, public screens update.

If admin pauses, public screens update.

Avoid optimistic public changes that can display a state which was never successfully committed to Firestore.

---

# 23. Public Access & Security

Public live data can be readable without login if required.

Firestore security rules must enforce:

- Admin authenticated user: permitted writes according to admin authorization.
- Public viewer: read-only access to explicitly public auction data.
- Public viewer: no writes.
- Public viewer: no access to private/admin-only data.

Never rely only on hiding buttons.

For admin authorization, use Firebase Authentication plus a secure admin authorization mechanism (for example, a controlled allowlist or custom claims). Do not hardcode a secret admin password into client-side code.

---

# 24. QR Code / Sharing

Generate a public live URL for each tournament/auction.

Example concept:

/live/{tournamentId}

Provide:

- Copy link
- QR code display
- QR code download/print option if practical

Users should be able to scan the QR code and immediately watch.

---

# 25. Public Landing Page

A tournament public page may show:

Tournament name

Men's Auction:
- NOT STARTED / LIVE / PAUSED / COMPLETED
- Watch Live when available

Women's Auction:
- NOT STARTED / LIVE / PAUSED / COMPLETED
- Watch Live when available

This avoids requiring users to know separate URLs.

---

# 26. Results

After completion, provide:

## Team results

- Team
- Players bought
- Total spent
- Remaining purse
- Final squad

## Player results

- Player
- Sold/Unsold
- Team
- Sold price
- Round

## Summary

- Total players
- Sold
- Unsold
- Total spend
- Highest sale
- Team spending

Men's and women's results remain separate.

---

# 27. Auction History

Record meaningful actions.

Examples:

- Auction started
- Auction paused
- Auction resumed
- Player put on auction
- Bid changed
- Player SOLD
- Player UNSOLD
- Round completed
- Round started
- Undo performed

For purchase history, retain:

- Player
- Team
- Amount
- Round
- Timestamp

---

# 28. Data Model

A practical Firestore model can be:

tournaments/{tournamentId}

tournaments/{tournamentId}/auctions/{auctionId}

tournaments/{tournamentId}/auctions/{auctionId}/teams/{teamId}

tournaments/{tournamentId}/auctions/{auctionId}/players/{playerId}

tournaments/{tournamentId}/auctions/{auctionId}/transactions/{transactionId}

tournaments/{tournamentId}/auctions/{auctionId}/history/{historyId}

The auction document contains current state/configuration.

Do not duplicate the entire tournament in multiple places.

Use the auctionId as the main partition between men's and women's data.

---

# 29. Suggested Types

Create strong TypeScript types/interfaces for:

- Tournament
- Auction
- AuctionType
- AuctionStatus
- Team
- Player
- PlayerStatus
- Transaction
- AuctionState
- AuctionHistory
- Bid
- Round

Avoid `any` for domain data.

Use enums/unions where appropriate.

---

# 30. Suggested Folder Structure

Use a maintainable structure similar to:

app/
  login/
  dashboard/
  tournaments/
    create/
    [tournamentId]/
      page.tsx
      men/
        teams/
        players/
        setup/
        auction/
      women/
        teams/
        players/
        setup/
        auction/
      results/
      history/
  live/
    [tournamentId]/
      page.tsx
      men/
      women/

components/
  auction/
  players/
  teams/
  display/
  tournament/
  ui/

lib/
  firebase/
    client.ts
    admin.ts
  auction/
    calculations.ts
    validation.ts
    operations.ts
  auth/
  storage/

types/
  auction.ts
  tournament.ts
  team.ts
  player.ts

tests/
  auction/
  calculations/

---

# 31. Architecture Rules

Separate:

- UI
- Firebase data access
- auction business logic
- calculations
- validation
- types

Do not put complex auction calculations directly inside React components.

Do not duplicate SOLD logic between men's and women's pages.

Build reusable auction services/functions.

Prefer server-side/secure operations for critical mutations where appropriate.

---

# 32. Testing Requirements

Write unit tests for:

- Maximum Bid calculation
- Purse calculation
- Squad calculation
- Players needed
- SOLD validation
- UNSOLD transitions
- Round transitions
- Undo behavior
- Bid increment logic

Test edge cases:

- Team has exactly enough money to fill squad
- No players remain
- More players are needed than eligible players
- Zero remaining purse
- Player base price equals current bid
- Multiple teams with same purse
- Final squad slot
- Final player in round
- All players unsold
- Repeated SOLD click
- Browser refresh during auction

---

# 33. Deployment

Target:

- GitHub repository
- Vercel deployment
- Firebase production project
- Firestore
- Firebase Storage
- Firebase Authentication

Environment variables must never expose server-only secrets to the browser.

Before production:

- Configure Firestore rules
- Configure Storage rules
- Configure admin authorization
- Test public read-only access
- Test admin writes
- Test on mobile
- Test on projector/TV
- Test multiple simultaneous public viewers
- Test disconnect/reconnect behavior

---

# 34. Important Non-Goals

Do NOT build:

- Team login
- Team bidding accounts
- Public bidding
- Payment system
- Automatic auctioneer
- Automated bidding bots
- Chat
- Team-side controls
- Complicated multi-role permissions unless later requested

Keep the product focused on admin-controlled live auction management.

---

# 35. Definition of Done

The application is considered complete when:

1. Admin can create a tournament.
2. Admin can configure men's and women's auctions separately.
3. Admin can add teams beforehand.
4. Admin can add players and images beforehand.
5. Admin can configure auction order.
6. Admin can save everything and return later.
7. Admin can preview and mark auctions ready.
8. Admin can start an auction later.
9. Admin can conduct live bidding.
10. Admin can mark SOLD/UNSOLD.
11. Purse/squad/max-bid update correctly.
12. Unsold players return in later rounds.
13. Admin can pause and resume.
14. Safe undo exists.
15. Auction state survives browser close/reopen.
16. Public users can open a live URL without login.
17. Public users cannot modify anything.
18. Public viewers update in real time.
19. Mobile view is polished.
20. Projector view is readable.
21. QR/share functionality works.
22. Results and history work.
23. Firestore security rules enforce read/write boundaries.
24. Critical business logic has automated tests.
25. Application is deployed and usable online.

---

# 36. Implementation Philosophy

Build incrementally.

Do not generate the entire application in one response.

For each phase:

1. Inspect the existing repository.
2. Identify what already exists.
3. Make a small coherent change.
4. Run type checks/lint/tests.
5. Fix errors.
6. Explain what changed.
7. Move to the next phase only after the current phase is stable.

Do not overwrite working code unnecessarily.

Before introducing a new dependency, check whether the existing stack already provides the required capability.

If a requirement is ambiguous, choose the simplest architecture consistent with this specification and clearly state the assumption before implementing it.

The specification is the source of truth unless the user explicitly changes a requirement.
