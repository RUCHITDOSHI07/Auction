# Public Auction Staging Load Test

The load runner is read-only. It never creates bids, sales, rounds, or any other auction mutations. Auction state changes for visibility measurements must be performed separately by an authorized operator against a dedicated staging deployment.

## 1. Provision Staging

1. Create or identify a dedicated MongoDB Atlas staging cluster. Prefer a cluster separate from production. This application selects the database named `pnpl-auction` in `lib/mongodb.ts`, regardless of the database name in the URI path.
2. If using a shared Atlas cluster, create a staging database/user boundary so the staging application credentials can access only the staging `pnpl-auction` database. Do not reuse the production URI or production database user.
3. Record the staging cluster name, database, allowed network sources, and the staging deployment hostname in the team runbook. Confirm these in the Atlas and Vercel dashboards before testing. Do not put credentials in the test command or shell history.
4. Configure a separate Vercel staging project or a protected preview deployment. Set its `MONGODB_URI` to the staging-only connection string. Configure the staging-only admin environment variables required by the app (`ADMIN_USER_ID`, `ADMIN_PASSWORD`, and `ADMIN_NAME`) through Vercel's encrypted environment settings. Never copy production admin credentials.
5. Set `PUBLIC_AUCTION_DIAGNOSTICS=true` only on the staging deployment. This emits JSON runtime log events for request lookup counts, snapshot query counts, metadata cache hits, and in-process coalescing. It does not add diagnostics to public responses.
6. Separately record the exact staging hostname in the operator's local environment as `PUBLIC_AUCTION_STAGING_HOST`. This non-secret allowlist is mandatory for the CLI and prevents an accidentally supplied production URL from being treated as staging.
7. Configure MongoDB network access for the Vercel staging runtime and the machine running the load script. Restrict access to known egress sources where practical; do not temporarily open production access.

The application reads these optional MongoDB pool settings: `MONGODB_MAX_POOL_SIZE` (default 5, maximum 10), `MONGODB_MAX_CONNECTING` (default 2, maximum 5), and `MONGODB_WAIT_QUEUE_TIMEOUT_MS` (default 5000, range 1000-30000). Set them only after reviewing Atlas connection limits and Vercel instance scale. They are not substitutes for checking aggregate connections across all function instances.

## 2. Seed a Synthetic Auction

1. Using the staging admin UI, create a clearly named tournament such as `LOAD TEST ONLY - YYYYMMDD` and enable one competition.
2. Add synthetic teams and players through the existing admin/Excel workflows. A useful starting fixture is 10-12 teams and 100-300 synthetic players, with realistic base-price distributions. Do not import real personal data or photos.
3. Configure and initialize a staging auction with a representative player pool and a round in progress. Make sure its public URL works in a normal browser without admin cookies and displays the expected team, player, purse, and round fields.
4. Record the auction ID and staging hostname. Keep the auction isolated from any event or production link.
5. For query-volume comparison, record an idle baseline from Atlas metrics before starting. Avoid running an index build or other maintenance during the load test.

## 3. Configure and Run Focused Tests

From the repository root:

```powershell
npm ci
npm run test:public
npm run test:auction
npm run typecheck
npm run lint
npm run build
```

These commands do not need a database connection. `test:public` covers the coalescer, ETags, sale-state version changes, dry-run defaults, and refusal conditions.

## 4. Run 50 Read-Only Viewers

The default command is dry-run and sends no network traffic:

```powershell
npm run load:public
```

The actual test refuses to start unless `--run`, `--target staging`, and an exact `--confirm-staging-host` are supplied. It also requires HTTPS, rejects production-marked hosts, and enforces a minimum of 50 viewers.

```powershell
$env:PUBLIC_AUCTION_STAGING_HOST = "<staging-host>"
npm run load:public -- --url https://<staging-host> --auction-id <seeded-auction-id> --target staging --confirm-staging-host <staging-host> --run --viewers 50 --duration-seconds 180 --poll-ms 4500
```

Run this from an interactive PowerShell terminal. During the test, an authorized staging operator can use the staging admin UI to persist controlled state changes, such as a bid update and then a SOLD or UNSOLD transition on the test auction. After each change is confirmed saved, type the matching marker into the load runner terminal:

```text
change bid-update-1
change sold-1
change unsold-1
```

Keep each changed state persisted long enough for at least one viewer poll. The runner measures from the marker to the first differing public payload it observes. It sends only `GET /api/public/auctions/<auctionId>` requests and never receives or sends admin credentials.

Example with literal placeholder values replaced by the staging operator:

```powershell
$env:PUBLIC_AUCTION_STAGING_HOST = "pnpl-auction-staging.example.com"
npm run load:public -- --url https://pnpl-auction-staging.example.com --auction-id load-test-auction-20261018 --target staging --confirm-staging-host pnpl-auction-staging.example.com --run --viewers 50 --duration-seconds 180 --poll-ms 4500
```

The runner reports p50/p95/p99/max request latency, status counts, error count and samples, total/average/max response bytes (also grouped by status), `304` rate, distinct ETags, observed state transitions, operator-marked update visibility, and request rate. A nonzero error count or no observed state transition returns a failing exit code.

## 5. Correlate Database and Cache Metrics

In Vercel runtime logs, filter to the test time window and staging function. The optional JSON events are:

- `public_auction_request`: one projected auction lookup per API request, outcome (`not_modified`, `modified`, or `not_found`), and whether the expensive computation joined an in-flight request.
- `public_auction_snapshot`: application-level additional read count for the computed snapshot, plus metadata-cache-hit state. This is emitted once per fan-out, not once per joining viewer.

Estimate application read volume by summing `mongoReads` from request events and `additionalMongoReads` from snapshot events. Compare joined computations against modified requests to estimate in-process coalescing. These logs are application estimates, not MongoDB command-monitoring events; Atlas metrics are authoritative for database operations and connections.

In Atlas, compare the test period with the idle baseline for read operations, query execution time, connections/current connections, and any available wait-queue or connection saturation metrics. In Vercel, compare function duration, invocations, concurrent executions, cold starts, and errors. Record the deployment region and Atlas region, since cross-region latency can dominate.

Review the runner report as follows:

- A high `304` rate with low p95/p99 suggests stable-state polling is inexpensive; investigate high response counts if poll jitter is absent or viewers reconnect together.
- High p95/p99 during state changes with few coalesced snapshots points to scale-out, DB query cost, or Atlas/Vercel resource limits. In-memory coalescing is per warm process, never shared across serverless instances.
- High `200` response bytes suggest the snapshot payload is a bandwidth cost; compare the `200` row with the `304` row rather than averaging them together.
- Delayed or missing state transitions can indicate operator marker timing, polling latency, an API error, or a stale intermediary. Check response status and ETag progression.
- Rising Atlas connections or wait time with acceptable query counts suggests reviewing the per-instance pool settings and deployment scaling, not blindly increasing pool size.
- Do not declare 50-viewer support from a single run. Repeat at expected peak duration and representative state-change frequency, and agree on latency/error thresholds before calling the result a pass.

## 6. Cleanup

1. Stop the load runner with `Ctrl+C` after its report is written; it has no background process and performs no writes.
2. Use the staging admin UI to pause/complete the test auction and remove its public link from shared materials.
3. Keep or archive the synthetic tournament according to the staging retention policy. If the Atlas cluster is disposable and the fixture must be removed, have the staging owner verify the cluster/database identity and take any required export before dropping the staging database. Never run cleanup commands against production or a shared database containing non-test data.
4. Turn `PUBLIC_AUCTION_DIAGNOSTICS` off after testing if the logs are no longer needed. Review and retain the sanitized report and relevant Atlas/Vercel metrics; do not include connection strings, credentials, or personal data.