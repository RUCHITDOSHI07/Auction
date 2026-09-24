# Cricket Auction Platform — Project Specification

## 1. Product Overview

Build a hosted cricket player auction platform for a tournament.

The platform has exactly two operational experiences:

1. **Admin** — authenticated, full control of tournament setup and live auction.
2. **Public Live Viewer** — unauthenticated, read-only live auction experience usable on phones, laptops, TVs, and projectors.

There are **NO team logins**, **NO team accounts**, and **NO public bidding**.

The admin prepares tournament and auction data before auction day. Auctions can be started later, paused, resumed, and completed over multiple sessions.

The public display changes only from successfully persisted auction state.

---

# 2. Core Principles

- Admin is the only person who can modify application data.
- Public viewers are strictly read-only.
- Never depend on frontend-only security.
- **MongoDB Atlas is the source of truth for application data.**
- **Google Drive is the external file/photo store.**
- Player photos/files must not be stored as binary data inside MongoDB.
- Auction state must persist so the admin can close the browser and continue later.
- Men's and women's competitions are completely independent.
- Never mix players, teams, purse, transactions, rounds, or state between men's and women's competitions.
- Use reusable components and services; do not duplicate auction logic for men and women.
- Financial calculations must be deterministic and testable.
- SOLD operations must be atomic/safely idempotent.
- Maximum Bid is informational only. It must never automatically block the admin from entering a higher bid.
- Public display must not contain mutation controls.
- Preserve existing player data during migrations. Never delete or recreate player records merely to change architecture.

---

# 3. Technology

Use:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- MongoDB Atlas
- MongoDB Node.js driver
- bcryptjs for admin password hashing
- HTTP-only MongoDB-backed admin sessions
- Google Drive for player/team photos and other externally stored files
- Vercel for hosting

The current repository already contains a MongoDB connection, admin authentication/session implementation, and player service. Reuse these where appropriate.

Do **not** introduce Firebase Authentication, Cloud Firestore, Firebase Storage, or Firebase real-time listeners.

Do not introduce Socket.IO unless there is a demonstrated requirement.

---

# 4. User Roles

## Admin

Admin can:

- Create tournaments
- Edit tournament setup
- Add/edit/delete teams
- Add/edit/delete players
- Manage player photos/files
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
- Import/export Excel data

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
- Write application data

---

# 5. Authentication and Authorization

Admin authentication is application-owned and MongoDB-backed.

Current repository architecture:

`admins`
- userId
- passwordHash
- name
- role

`adminSessions`
- tokenHash
- userId
- expiresAt
- createdAt
- updatedAt

The browser receives an HTTP-only session cookie. Server-side APIs/pages use the session to authorize admin operations.

Rules:

- Never put admin passwords or password hashes in client code.
- Never use client-side checks as the only authorization mechanism.
- Critical mutations must verify the admin session server-side.
- Public routes must not receive admin mutation credentials.
- Do not introduce team authentication.

---

# 6. Tournament Model

A tournament is the long-lived container for one PNPL edition.

Suggested fields:

- tournamentId
- name
- year
- logo/reference if applicable
- description
- status
- createdAt
- updatedAt

A tournament contains two independent competitions:

```
Tournament
├── Men's Competition
│   ├── Teams
│   ├── Players
│   ├── Auction
│   └── Results
└── Women's Competition
    ├── Teams
    ├── Players
    ├── Auction
    └── Results
```

Men's and women's teams are different records. They are never shared automatically.

Every tournament-specific entity must be associated with the correct `tournamentId` and competition/gender.

---

# 7. Competition / Gender Isolation

Gender separation is a **backend/data rule**, not just a UI filter.

Every relevant tournament record should carry enough information to validate:

- tournamentId
- gender/competition
- related auctionId where applicable

The server must reject invalid relationships such as:

- male auction + female player
- male auction + female team
- PNPL 2027 auction + PNPL 2026 tournament record
- women's result attached to a men's auction

The UI may reuse components, but the data and API boundaries must remain isolated.

---

# 8. Permanent Player Identity

Players have a permanent system-generated Player ID.

The Player ID is generated when a player is first created/imported into the master player collection.

Example:

```
P001 — Vandit Vipul Savla
P002 — Rahul Shah
P003 — Priya Patel
```

The normal player Excel import must **not require the user to provide a Player ID**.

The system generates the next permanent ID and stores it with the master player.

Once assigned, a Player ID must never change.

A player's master identity can participate in multiple tournaments:

```
P001
├── PNPL 2025
├── PNPL 2026
└── PNPL 2027
```

Do not identify historical records by player name alone.

Existing player records must be migrated safely. Do not delete the existing player collection or reset player data as part of architectural migration.

---

# 9. Player Master Data

The `players` collection is the master player identity/profile store.

Typical fields:

- id / playerId
- name / fullName
- gender
- age
- dateOfBirth
- wingFlatNumber
- phoneNumber
- role
- battingStyle
- bowlingStyle
- batting
- bowling
- instagramId
- playedCricket
- photoFileId
- photoUrl or derived public/display URL when appropriate
- category
- basePrice when used by the current tournament workflow
- createdAt
- updatedAt

Do not add tournament-specific sale state directly to the permanent master identity when that state belongs to a particular auction.

Tournament-specific information belongs in tournament/auction/history records.

---

# 10. Player Excel Import

The normal player master Excel import may contain fields such as:

- Full Name
- Gender
- Age
- Date of Birth
- Wing - Flat Number
- Phone Number
- Upload Your Recent Photo
- Have you played cricket before?
- Role
- Batting Preference
- Bowling Preference
- Insta-id
- Category
- Base Price when applicable

Player ID is generated by the application.

The importer must:

- validate required fields
- normalize gender
- avoid duplicate master players where a safe matching strategy exists
- preserve existing Player IDs
- never silently replace an existing player with a newly generated ID
- report inserted/updated/unchanged rows
- preserve existing data during migration
- support photo/file references without storing binary files in MongoDB

The exact player deduplication/matching strategy must be designed before changing existing production player records.

---

# 11. Google Drive File Storage

Google Drive is the external store for player photos and other files that should not live in MongoDB.

Preferred flow:

```
Player Excel
   ↓
Photo/file reference
   ↓
Google Drive
   ↓
photoFileId / file reference
   ↓
MongoDB player record
```

MongoDB stores metadata/reference, not image binary content.

Google Drive integration should be introduced as a separate service layer so UI components do not directly contain Drive API logic.

Do not redesign the existing player UI merely to introduce Drive storage.

---

# 12. Team Management

Teams are entered by the admin before the auction.

Team fields may include:

- teamId
- tournamentId
- auctionId
- gender
- name
- logoFileId / logoUrl
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

# 13. Auction Configuration

Each auction is tied to exactly one tournament and competition.

Suggested fields:

- auctionId
- tournamentId
- gender
- startingPurse
- squadSize
- minimumSquadSize when required
- bidIncrement
- status
- currentRound
- currentPlayerId
- currentBid
- highestTeamId
- createdAt
- updatedAt

Suggested statuses:

- UPCOMING
- READY
- LIVE
- PAUSED
- COMPLETED

Men's and women's auction configurations are independent.

---

# 14. Auction Order

The admin must be able to configure player order before auction day.

Required functionality:

- display numbered order
- reorder interaction
- move up/down fallback
- save order

Auction order is independent for men's and women's auctions.

---

# 15. Auction Preview / Ready State

Before an auction is live, show a validation/preview screen.

Validate:

- correct tournament
- correct competition/gender
- teams exist
- players exist
- starting purse configured
- squad size configured
- bid increment configured
- auction order is valid
- required player/team information exists

Allow:

- EDIT
- MARK READY / LOCK

Do not allow unsafe setup changes while an auction is LIVE unless explicitly designed as an admin correction workflow.

---

# 16. Admin Live Auction

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

The admin remains the source of bidding truth. This is not an automated multi-user bidding platform.

---

# 17. Bid Validation

At minimum:

- Current bid cannot be below base price.
- A new bid should normally be >= current bid + configured increment when using increment controls.
- Custom bid must be validated according to configured auction rules.
- Highest team is required before SOLD.
- SOLD price must equal the saved current bid.
- Do not allow SOLD twice for the same player.
- Do not allow a player already SOLD to return to active auction except through an explicit safe correction/undo workflow.
- The admin may intentionally exceed Maximum Bid because Maximum Bid is informational only.

---

# 18. Maximum Bid Engine

Maximum Bid is a display/strategy aid.

For each team:

`currentPurse = startingPurse - totalCompletedPurchaseSpend`

`playersPurchased = count(SOLD players for team)`

`playersNeeded = squadSize - playersPurchased`

`minimumReserve = sum(base prices of the cheapest eligible remaining players needed to fill the squad)`

`maximumBid = max(0, currentPurse - minimumReserve)`

Important:

- Recalculate after every completed sale.
- Recalculate for every team because the remaining player pool changes.
- Maximum Bid is NOT a hard limit.
- The admin can enter a higher bid.
- Do not let a frontend-only cached number become the source of truth.
- Put the calculation in a pure, unit-testable TypeScript function.

Unsold players returning in later rounds must be handled consistently according to the chosen auction rules.

---

# 19. SOLD Operation

SOLD is a critical mutation.

When admin clicks SOLD:

1. Validate current auction state.
2. Validate current player.
3. Validate selected highest team.
4. Validate current bid.
5. Validate tournament and gender relationships.
6. Mark the tournament/auction player as SOLD.
7. Save soldToTeamId.
8. Save soldPrice.
9. Save soldRound.
10. Create a canonical transaction/history record.
11. Persist auction state.
12. Prevent accidental duplicate execution.
13. Recalculate derived team values for the UI.

Use MongoDB atomic operations/transactions where appropriate.

The database must retain enough canonical data to reconstruct results.

---

# 20. UNSOLD Operation

When admin clicks UNSOLD:

- Mark the auction player UNSOLD.
- Save round.
- Do not delete the player.
- Do not create a purchase transaction.
- Make the player eligible for later rounds according to the rules.
- Save auction history/state.

---

# 21. Rounds

Round 1 includes the initial auction pool.

After all players in the current round have been processed, show:

- Round number
- Total players
- Sold count
- Unsold count

Example:

`ROUND 1 COMPLETE — 48 Players — 35 Sold — 13 Unsold`

Admin explicitly starts the next round.

Unsold players return to the eligible pool according to the auction rules.

Never automatically jump into the next round without explicit admin action.

---

# 22. Pause / Resume / Persistence

At any point during an auction, admin can pause.

On pause, persist:

- current player
- current bid
- highest team
- round
- auction status
- completed transactions
- history

After closing/reopening the browser, the admin must be able to resume from persisted MongoDB state.

Never rely only on React state for auction persistence.

---

# 23. Undo

Provide a safe Undo workflow for accidental actions.

Undo may reverse a recent canonical operation such as:

- player SOLD status
- team purchase
- derived purse/squad state
- auction state

Prefer append-only history/event records where practical instead of destructive history deletion.

Define clearly which actions are undoable and prevent unsafe undo of unrelated historical transactions.

---

# 24. Public Live Viewer

Public routes should follow the tournament/competition structure, for example:

- /live/[tournamentId]
- /live/[tournamentId]/men
- /live/[tournamentId]/women

The viewer is read-only and mobile-first.

Show:

- Tournament name/logo
- Live status
- Current player
- Player photo
- Player details
- Base price
- Current bid
- Highest team
- Team status
- Squad count
- Players needed
- Maximum Bid if intended for public viewing
- SOLD/UNSOLD state
- Round information

Do not show admin controls.

Do not expose private admin data.

---

# 25. Live Synchronization

MongoDB is the source of truth.

The first implementation should prefer simple, reliable server/API polling or refresh behavior unless a later requirement justifies a dedicated real-time transport.

Do not add Socket.IO merely because the old Firebase design used real-time listeners.

If a real-time transport is later required, isolate it from the auction domain/service layer.

Public screens must never display an optimistic state that was not successfully persisted.

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

Record meaningful actions, such as:

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

Purchase history should retain:

- Player ID
- Team
- Amount
- Round
- Timestamp
- Tournament ID
- Auction ID
- Gender

---

# 28. Historical Tournament Data

Previous tournaments are permanent records and must not be deleted when a new tournament is created.

Historical player participation/statistics belong in a separate collection such as:

`playerTournamentHistory`

Example:

```json
{
  "playerId": "P001",
  "tournamentId": "pnpl-2026",
  "gender": "male",
  "teamId": "team-001",
  "auction": {
    "status": "sold",
    "price": 7000
  },
  "statistics": {
    "matches": 8,
    "runs": 214,
    "wickets": 6,
    "catches": 5
  }
}
```

Historical statistics may be incomplete.

Missing information must be represented as unavailable/null, not silently converted to zero.

---

# 29. Historical Excel Import

Historical data comes from manually prepared Excel files, based on external sources such as CricClubs.

Do not build a direct CricClubs integration unless explicitly requested later.

The historical Excel should use the permanent Player ID so records can be matched reliably.

Example:

```
Player ID | Player Name | Gender | Team | Auction Price | Matches | Runs | Wickets
P001      | Vandit...   | Male   | Team A | 7000 | 8 | 214 | 6
P002      | Rahul...    | Male   | Team B | 5000 | 7 | 180 | 3
```

The system should validate:

- Player ID exists
- tournament exists
- gender matches
- team belongs to the correct tournament/competition
- duplicate historical records are handled safely

---

# 30. Excel Export

Post-auction export should support:

- each team and assigned players
- player details
- sold price
- round
- tournament/competition

Men's and women's exports remain separate.

Optionally provide a combined tournament workbook with separate men's and women's sheets.

---

# 31. MongoDB Collections

The target data model is:

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

Collections may be added when justified by a concrete requirement.

Use `tournamentId`, `auctionId`, and `gender`/competition fields to enforce correct ownership and segregation.

Do not store the same canonical purchase data redundantly in multiple collections without a clear reason.

---

# 32. Application Architecture

Use this separation:

```
Next.js App Router
        ↓
Server/API routes
        ↓
Authentication + validation
        ↓
Domain/service layer
   ├── tournaments
   ├── players
   ├── teams
   ├── auctions
   ├── results
   ├── playerHistory
   └── googleDrive
        ↓
MongoDB Atlas
        ↓
Google Drive for files/photos
```

UI components must not contain database credentials or Google Drive credentials.

Complex auction calculations must not live directly in React components.

---

# 33. Suggested Folder Structure

The existing repository already has working UI folders. Preserve them unless there is a concrete reason to move them.

Target service structure:

```
lib/
  mongodb.ts
  auth/
  services/
    tournaments.ts
    players.ts
    teams.ts
    auctions.ts
    results.ts
    playerHistory.ts
  auction/
    calculations.ts
    validation.ts
    operations.ts
  storage/
    googleDrive.ts

types/
  tournament.ts
  player.ts
  team.ts
  auction.ts
  history.ts
  admin.ts
```

Firebase-specific folder structures should not be introduced.

---

# 34. Environment Variables

Server-only secrets must remain server-side.

Expected variables may include:

```
MONGODB_URI=...
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=...
```

Only add Google Drive variables when the integration is implemented.

Never expose MongoDB or Google Drive server credentials through NEXT_PUBLIC_* variables.

Do not commit `.env` files or secrets.

---

# 35. Existing Repository Migration Rules

The repository already contains MongoDB-backed player/admin functionality.

During migration:

- Reuse working MongoDB code.
- Do not delete the existing `players` collection.
- Do not delete existing player records.
- Do not reset or re-import the 47 existing players merely to change architecture.
- Do not redesign the existing UI as part of the architecture migration.
- Do not change player IDs until the dedicated Player ID migration phase.
- Do not introduce Firebase dependencies.
- Firebase-era files may remain temporarily if they are not referenced, but they must be clearly marked as legacy/deprecated and must not be used by new code.
- Remove obsolete Firebase files only after verifying they have no imports/references and only as a deliberate cleanup step.

---

# 36. Testing Requirements

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
- tournament/gender relationship validation
- Player ID generation when that phase is implemented
- historical import validation when that phase is implemented

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
- Wrong gender
- Wrong tournament
- Missing historical statistics

---

# 37. Deployment

Target:

- GitHub repository
- Vercel deployment
- MongoDB Atlas
- Google Drive

Before production:

- Configure MongoDB connection securely
- Configure admin authentication/session handling
- Configure Google Drive credentials securely
- Test public read-only access
- Test admin writes
- Test on mobile
- Test on projector/TV
- Test multiple public viewers if real-time delivery is introduced
- Test disconnect/reconnect behavior

---

# 38. Important Non-Goals

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
- Direct CricClubs integration unless explicitly requested

Keep the product focused on admin-controlled live auction management.

---

# 39. Definition of Done

The application is considered complete when:

1. Admin can create a tournament.
2. Admin can configure men's and women's competitions separately.
3. Admin can add teams beforehand.
4. Admin can add players and images beforehand.
5. Permanent Player IDs are generated and preserved.
6. Admin can configure auction order.
7. Admin can save everything and return later.
8. Admin can preview and mark auctions ready.
9. Admin can start an auction later.
10. Admin can conduct live bidding.
11. Admin can mark SOLD/UNSOLD.
12. Purse/squad/max-bid update correctly.
13. Unsold players return in later rounds.
14. Admin can pause and resume.
15. Safe undo exists.
16. Auction state survives browser close/reopen.
17. Public users can open a live URL without login.
18. Public users cannot modify anything.
19. Public viewers receive persisted auction state.
20. Mobile view is polished.
21. Projector view is readable.
22. Results and history work.
23. Historical tournament data can be imported using Player IDs.
24. Player/team photos can be stored through Google Drive.
25. Results can be exported to Excel.
26. Critical business logic has automated tests.
27. Application is deployed and usable online.

---

# 40. Implementation Philosophy

Build incrementally.

Do not generate the entire application in one response.

For each phase:

1. Inspect the existing repository.
2. Identify what already exists.
3. Make a small coherent change.
4. Run typecheck/lint/tests.
5. Fix errors.
6. Explain what changed.
7. Move to the next phase only after the current phase is stable.

Do not overwrite working code unnecessarily.

Before introducing a new dependency, check whether the existing stack already provides the required capability.

If a requirement is ambiguous, choose the simplest architecture consistent with this specification and clearly state the assumption before implementing it.

This specification is the source of truth unless the user explicitly changes a requirement.
