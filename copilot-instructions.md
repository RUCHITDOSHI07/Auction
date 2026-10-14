# PNPL Auction — GitHub Copilot Project Context

> Purpose: This file gives GitHub Copilot (including a new Copilot chat or coding agent) the durable project context, product rules, architecture expectations, current priorities, and future work for the PNPL Auction website.
>
> **Important:** Treat the checked-out repository as the source of truth for the current implementation. Inspect the code before changing it. This document captures product intent and known history; some implementation details may have changed.

## 1. Project overview

PNPL Auction is a web application for managing and displaying a cricket player auction. The admin runs the auction; the public can watch the live auction in a read-only view.

Production URL previously shared:
- https://pnplauction.vercel.app

Useful routes previously shared:
- `/` — public/home entry point
- `/admin/results` — admin results area
- `/admin/players/import` — player Excel import area

Check the current route structure in the repository before relying on these paths.

### Main goals
- Make the admin auction process reliable and straightforward.
- Make the public live-auction page fast, lightweight, mobile-friendly, and read-only.
- Support separate men's and women's auctions within a tournament.
- Import player information from Excel, including player photos/images.
- Export post-auction results to Excel, grouped by team and assigned players.
- Support an audience of at least 50 concurrent public viewers, with sensible headroom.
- Keep infrastructure and implementation as simple and cost-conscious as practical.

## 2. Product requirements and auction rules

### Tournament and auction setup
- The admin creates/manages a tournament.
- Men's and women's auctions are separate.
- The admin can enter team details before the auction.
- The auction may be prepared in advance and started later.
- The admin must be able to stop and continue an auction later without losing its correct state.
- There are no team logins; teams do not need separate accounts to participate in the website.

### Player pool and auction operation
- The admin manages the player pool and controls auction progression.
- The live screen displays the current player, player photo and relevant details.
- Team summaries should show the information needed during bidding, such as squad strength, remaining players they can buy, and maximum bid.
- Maximum bid is a calculated/display value based on the configured auction rules, including base player price and number of players remaining. Inspect existing domain logic before changing the formula; do not invent or silently alter auction rules.
- When a team buys a player, its team summary and relevant counts/budget values must update correctly.
- Unsold players should return to the appropriate pool/state according to the existing auction rules after the eligible players have been processed. Preserve the current intended workflow and confirm edge cases before changing it.
- Prevent duplicate sales, inconsistent assignments, or advancing to the next player before the result has been persisted.

### Player Excel import
- Excel input is an important part of the workflow.
- The input file contains individual player details and may include photo/image information.
- Imported information should populate player records and the relevant UI.
- Preserve the existing Excel/CSV formats and validation behavior unless a deliberate, documented migration is needed.
- Provide useful row-level validation/error reporting; never report successful imports if writes failed.

### Post-auction Excel export
- The application should export results to Excel after the auction.
- Output should group each team with the players assigned to that team.
- Preserve this feature when changing the database, APIs, models, or UI.

## 3. Known architecture direction

The latest requested direction is:

- **Application data:** MongoDB.
- **Player photos/images:** Google Drive, using an appropriate image-delivery and caching strategy.
- **Hosting/deployment:** Vercel.
- **Frontend:** The repository has previously used Next.js App Router, TypeScript, and Tailwind CSS. Verify the current package files and code before assuming exact versions.
- **Do not reintroduce Firebase** as part of new work. Earlier Firebase work caused Firestore permission-denied import failures and confusion; the requested direction moved to MongoDB + Google Drive.

### Configuration and secrets
- Keep MongoDB connection strings and Google credentials in environment variables.
- Never commit secrets, `.env` files, service-account keys, admin passwords, or production data.
- Verify which environment variables are already used before adding or renaming any.
- Configure required variables in both local development and the correct Vercel environments.
- Reuse a safe MongoDB connection strategy for serverless execution; avoid opening a new database connection for every request when the existing project can reuse a cached connection/promise.
- Never expose privileged MongoDB or Google Drive credentials to browser/client code.

## 4. Current priority: optimize the public live-auction page first

The public page is the highest-priority performance target because many spectators may open it at once. Keep it independent of the heavier admin experience.

### Public page principles
- Read-only: spectators must not be able to mutate auction state, teams, players, bids, or results.
- Lightweight: fetch only the data required for the public display.
- Mobile-first/responsive: the page should work well on phones and desktop.
- Reliable: retain the last valid display during transient network errors, show a useful connection/loading state, retry safely, and recover to the latest persisted state after reconnect.
- No admin-only UI, unnecessary client-side bundles, or admin queries on public routes.
- Do not expose credentials, private fields, or internal admin information.

### Public data to show (as applicable to existing UI)
- Tournament/auction status.
- Current player and the fields needed to display that player.
- Current auction/result state, including SOLD/UNSOLD state and result details.
- Team summaries required during the auction.
- Squad counts and remaining-player counts.
- Remaining budget/purse and maximum-bid display values, where applicable.
- A version/event identifier or timestamp that helps detect whether the state changed.

### Performance work to investigate and implement
1. Inspect the current public page, its client components, API routes/server actions, MongoDB queries, and image delivery before changing code.
2. Measure the current behavior first. Identify whether slowness comes from initial JS/hydration, API latency, duplicate requests, database queries, image downloads, or repeated rendering.
3. Avoid fetching the entire player pool, full auction history, or every team/player document on every live update.
4. Create or reuse a small public read model/API response containing only the fields the public page needs.
5. Review client/server component boundaries and remove unnecessary client-side JavaScript from the public page.
6. Prevent duplicate requests and overlapping polling. If polling is used, choose a sensible interval, pause or reduce work when appropriate, and handle request cancellation/cleanup correctly.
7. Compare lightweight polling with a suitable real-time mechanism. Choose the simplest reliable approach compatible with the current architecture and budget; do not add paid services without explaining why.
8. If polling is retained, support a lightweight version/ETag/unchanged-state mechanism where practical so unchanged state does not require a full payload and rerender.
9. Cache relatively static tournament/team data where safe. Do not cache dynamic auction state in a way that causes viewers to see a misleading stale result.
10. Inspect MongoDB query patterns and indexes. Add only justified indexes, and project/select only the fields required.
11. Optimize player image delivery. Use appropriately sized images, cacheable URLs, and lazy loading for non-visible/upcoming players. Avoid repeatedly querying Google Drive or reprocessing/downloading the same image on every render. Confirm that the chosen Drive URL method is suitable for public image display and browser caching.
12. Avoid full-page reloads when the auction advances; update only the relevant state.
13. Keep the admin experience and admin authorization separate from public read access.
14. Add basic observability/logging for request latency, errors, and database activity without logging secrets or sensitive data.

### Performance targets (targets, not guarantees)
- Initial public page load: aim for 2–3 seconds or less on a reasonable connection.
- Auction update visibility: aim for approximately 1–2 seconds, depending on the chosen update strategy and connection.
- Concurrent public viewers: test at least 50, with headroom where feasible.
- Duplicate result animations/events: zero.
- Reconnect state: correct and up to date.
- Report actual measurements; never claim that a load test passed unless it was run.

## 5. SOLD / UNSOLD result experience

After public-page performance work is understood, implement or refine the result experience.

### Expected behavior
- When the admin marks a player SOLD, show a clear SOLD banner/overlay on both admin and public auction screens.
- Display the player's name/photo, winning team, and final sold price where applicable.
- Keep the result visible for about 2–3 seconds, then transition to the next player according to the existing auction workflow.
- When a player is UNSOLD, show a distinct UNSOLD state before moving on.
- Use polished but lightweight animations; avoid heavy effects that slow the public page.
- Provide optional short SOLD/UNSOLD sound effects and a visible mute/unmute control.
- Browser autoplay may be blocked; handle this gracefully and allow users to enable sound with a user gesture.
- Respect reduced-motion preferences where practical.

### Correctness requirements
- Persist the authoritative auction result before broadcasting/displaying it as completed.
- Use a unique result/event ID, sequence number, or equivalent durable identifier to identify each new result.
- Do not replay the same sound/animation on every poll, rerender, reconnect, or page refresh.
- A viewer joining late should see the current authoritative state, not replay a historical animation unless that is an explicit product decision.
- Ensure all viewers eventually converge on the same persisted auction state.
- Prevent duplicate admin actions, duplicate sale assignments, and race conditions.
- The result display timer must not be the source of truth for auction state. It is a presentation layer over persisted state.
- If the admin pauses/stops the auction or a transition fails, preserve the correct state and avoid silently skipping a player.

## 6. Security and data integrity

- Public endpoints must be read-only and expose only approved fields.
- All mutations must be server-side and appropriately authorized.
- Validate incoming request bodies and imported spreadsheet data.
- Do not trust client-supplied prices, team budgets, player ownership, or auction status; validate critical transitions on the server.
- Use atomic/conditional database updates or transactions where appropriate to prevent duplicate sales and inconsistent team assignments. Confirm MongoDB deployment capabilities before relying on transactions.
- Never expose environment variables, admin credentials, database connection strings, or Google service credentials to the browser.
- Preserve auditability of important state transitions where feasible.
- Handle malformed data, missing images, database timeouts, and network failures gracefully.

## 7. Future work / prioritized roadmap

### P0 — Public live-page performance and reliability
- [ ] Inspect current implementation and map public page → API/data access → MongoDB → image URLs.
- [ ] Capture baseline load/update timings and identify bottlenecks.
- [ ] Make the public view read-only and independent of admin data-fetching/UI code.
- [ ] Reduce initial payload and client JavaScript.
- [ ] Reduce repeated MongoDB reads and duplicate API requests.
- [ ] Improve image sizing, caching, and lazy loading.
- [ ] Implement robust update/reconnect behavior.
- [ ] Add safe indexes and query projections based on actual queries.
- [ ] Load-test at least 50 concurrent read-only viewers using a safe test environment.

### P1 — Auction result feedback
- [ ] Add SOLD result overlay/animation.
- [ ] Add UNSOLD result overlay/animation.
- [ ] Show winner/team and final price for sold players.
- [ ] Add optional sound and mute/unmute.
- [ ] Prevent duplicate result effects across polls/reconnects.
- [ ] Verify transition timing and persisted-state correctness.

### P2 — Admin auction correctness and usability
- [ ] Audit auction state transitions, pause/resume, next-player behavior, and duplicate-action handling.
- [ ] Confirm squad counts, remaining-player counts, purse/budget, and maximum-bid calculations against the existing rules.
- [ ] Ensure unsold players are handled correctly at the right stage.
- [ ] Ensure errors are visible to the admin and do not leave the UI falsely showing a successful update.

### P3 — Import/export reliability
- [ ] Verify Excel/CSV player import, validation, image references, and partial-failure reporting.
- [ ] Verify post-auction Excel export grouped by team and assigned players.
- [ ] Test empty, malformed, duplicate, and partially invalid rows.
- [ ] Preserve existing templates and avoid silent format changes.

### P4 — Production readiness
- [ ] Confirm production and preview environment variables.
- [ ] Verify MongoDB connection reuse and connection-pool behavior under concurrency.
- [ ] Add basic request/error/latency monitoring.
- [ ] Check mobile usability and accessibility.
- [ ] Document deployment and rollback steps.
- [ ] Review Vercel and MongoDB usage limits/cost implications before introducing new services.

## 8. Testing and delivery expectations

For every change:
1. Inspect the relevant existing implementation first.
2. Make the smallest coherent change; do not rebuild the application from scratch.
3. Keep TypeScript types strict and avoid `any` unless there is a documented reason.
4. Run the available lint, type-check, test, and production-build commands. Determine the actual commands from `package.json`.
5. Test the affected admin and public flows, including mobile layout when relevant.
6. Test loading, error, empty, reconnect, and duplicate-action cases.
7. For performance changes, report measured before/after results and the method used.
8. For concurrency claims, state the actual test setup, request rate, duration, and results.
9. Summarize files changed, behavior changed, commands/tests run, results, and remaining risks.
10. Do not say a feature, deployment, or test succeeded unless it actually did.

## 9. How Copilot should work on this project

- Read this file and inspect the repository before proposing code.
- Treat the current repository as authoritative for exact filenames, routes, schema, package versions, and existing behavior.
- Preserve current working functionality and existing visual design unless the task explicitly requests a change.
- Do not invent APIs, environment variables, database schemas, or test results.
- Do not perform broad refactors while working on a focused task.
- Explain any required environment-variable changes without printing secret values.
- If a requirement conflicts with current code, explain the conflict and propose a minimal migration.
- Prioritize **P0 public live-page performance** before optional polish, unless the user explicitly changes priorities.
- Work in small phases and stop after each phase with a concise report if the user requested phased implementation.
- Never use production auction mutations for load tests.

## 10. First task for a new Copilot session

Start by inspecting the repository and report:
1. The current public live-auction route and component tree.
2. The API/server actions and MongoDB queries used to populate it.
3. How live updates currently work (polling, subscriptions, refresh, or another mechanism).
4. How player images are served from Google Drive and whether they are cacheable.
5. Any duplicate requests, oversized payloads, unbounded reads, missing indexes, or unnecessary client-side JavaScript found.
6. A short, prioritized plan to improve the **public live-auction page first**, without changing auction rules or the Excel import/export workflows.

Then implement the smallest high-impact performance changes, run the available checks, and report actual measurements and remaining limitations.
