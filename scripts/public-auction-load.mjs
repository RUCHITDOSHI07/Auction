import { createInterface } from "node:readline";

function parseArgs(args) {
  const options = { viewers: 50, durationSeconds: 120, pollMs: 1500, run: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--run") options.run = true;
    else if (argument === "--help") options.help = true;
    else if (argument.startsWith("--")) {
      const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
      options[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }
  return options;
}

function printUsage() {
  console.log(`Read-only public auction load test (dry-run unless --run is supplied)

Required to run:
  --url https://staging.example.com
  --auction-id <seeded-staging-auction-id>
  --target staging
  --confirm-staging-host staging.example.com
  PUBLIC_AUCTION_STAGING_HOST=staging.example.com
  --run

Optional:
  --viewers 50                 Minimum is 50
  --duration-seconds 120       Range: 15-3600
  --poll-ms 1500               Must be at least 1000

During the run, enter: change <label>
immediately after an authorized operator confirms a staging state change persisted.
The harness itself only sends GET requests.`);
}

function validateRun(options) {
  if (options.target !== "staging") throw new Error("Refusing to run: --target staging is required.");
  if (typeof options.url !== "string" || typeof options.auctionId !== "string") {
    throw new Error("Refusing to run: --url and --auction-id are required.");
  }

  const baseUrl = new URL(options.url);
  if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || baseUrl.pathname !== "/") {
    throw new Error("Refusing to run: --url must be an HTTPS origin without credentials, path, query, or fragment.");
  }
  if (options.confirmStagingHost !== baseUrl.hostname) {
    throw new Error("Refusing to run: --confirm-staging-host must exactly match the URL hostname.");
  }
  if (/prod(uction)?/i.test(baseUrl.hostname)) {
    throw new Error("Refusing to run: host contains a production marker.");
  }
  if (process.env.PUBLIC_AUCTION_STAGING_HOST !== baseUrl.hostname) {
    throw new Error("Refusing to run: PUBLIC_AUCTION_STAGING_HOST must be separately set to this exact staging hostname.");
  }

  const viewers = Number(options.viewers);
  const durationSeconds = Number(options.durationSeconds);
  const pollMs = Number(options.pollMs);
  if (!Number.isInteger(viewers) || viewers < 50 || viewers > 500) throw new Error("--viewers must be an integer from 50 to 500.");
  if (!Number.isInteger(durationSeconds) || durationSeconds < 15 || durationSeconds > 3600) {
    throw new Error("--duration-seconds must be an integer from 15 to 3600.");
  }
  if (!Number.isInteger(pollMs) || pollMs < 1000 || pollMs > 60000) throw new Error("--poll-ms must be from 1000 to 60000.");
  if (!/^[A-Za-z0-9_-]+$/.test(options.auctionId)) throw new Error("--auction-id contains unsupported characters.");

  return { baseUrl, auctionId: options.auctionId, viewers, durationSeconds, pollMs };
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)];
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runLoad(options) {
  const endpoint = new URL(`/api/public/auctions/${encodeURIComponent(options.auctionId)}`, options.baseUrl);
  const endAt = Date.now() + options.durationSeconds * 1000;
  const startedAt = Date.now();
  const latencies = [];
  const responseBytes = [];
  const responseBytesByStatus = {};
  const statuses = {};
  const errors = [];
  const etags = new Set();
  const stateFingerprints = new Set();
  const visibilityMeasurements = [];
  const pendingChangeMarkers = [];
  let stateTransitions = 0;
  let requestCount = 0;
  let firstRequestAt;
  let lastRequestAt;

  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  if (process.stdin.isTTY) {
    console.log('After each separately persisted staging change, type: change <label>');
    input.on("line", (line) => {
      const match = /^change\s+(.+)$/i.exec(line.trim());
      if (match) pendingChangeMarkers.push({ label: match[1], markedAt: Date.now() });
    });
  }

  function recordPublicState(body, responseEtag) {
    if (responseEtag) etags.add(responseEtag);
    const publicAuction = body.auction;
    const fingerprint = JSON.stringify({ auction: publicAuction, currentPlayer: body.currentPlayer, highestTeam: body.highestTeam, teams: body.teams, result: body.result });
    if (stateFingerprints.has(fingerprint)) return;
    if (stateFingerprints.size > 0) {
      stateTransitions += 1;
      const marker = pendingChangeMarkers.shift();
      if (marker) visibilityMeasurements.push({ label: marker.label, milliseconds: Date.now() - marker.markedAt });
    }
    stateFingerprints.add(fingerprint);
  }

  async function viewer(viewerId) {
    let etag;
    let consecutiveFailures = 0;
    await sleep(Math.random() * 750);
    while (Date.now() < endAt) {
      const started = Date.now();
      firstRequestAt ??= started;
      lastRequestAt = started;
      const headers = etag ? { "If-None-Match": etag } : undefined;
      try {
        const response = await fetch(endpoint, { method: "GET", headers, signal: AbortSignal.timeout(15000) });
        const bodyBytes = new Uint8Array(await response.arrayBuffer());
        const elapsed = Date.now() - started;
        requestCount += 1;
        latencies.push(elapsed);
        responseBytes.push(bodyBytes.byteLength);
        statuses[response.status] = (statuses[response.status] ?? 0) + 1;
        responseBytesByStatus[response.status] ??= [];
        responseBytesByStatus[response.status].push(bodyBytes.byteLength);
        consecutiveFailures = 0;

        if (response.status === 304) {
          const responseEtag = response.headers.get("etag");
          if (responseEtag) {
            etag = responseEtag;
            etags.add(responseEtag);
          }
        } else if (response.status === 200) {
          let body;
          let invalidJson = false;
          try {
            body = JSON.parse(new TextDecoder().decode(bodyBytes));
          } catch {
            invalidJson = true;
            errors.push({ viewerId, message: "HTTP 200 response was not valid JSON." });
          }
          if (!invalidJson && (!body || !body.auction || body.auction.id !== options.auctionId || !Array.isArray(body.teams))) {
            errors.push({ viewerId, message: "HTTP 200 response had an invalid public auction payload." });
          } else if (!invalidJson) {
            etag = response.headers.get("etag") ?? etag;
            recordPublicState(body, etag);
          }
        } else {
          errors.push({ status: response.status, viewerId, message: `HTTP ${response.status}` });
        }
      } catch (error) {
        requestCount += 1;
        latencies.push(Date.now() - started);
        statuses.error = (statuses.error ?? 0) + 1;
        consecutiveFailures += 1;
        errors.push({ viewerId, message: error instanceof Error ? error.message : "Request failed" });
      }

      const baseDelay = consecutiveFailures
        ? Math.min(options.pollMs * 2 ** Math.min(consecutiveFailures - 1, 4), 60000)
        : options.pollMs;
      await sleep(Math.round(baseDelay * (0.9 + Math.random() * 0.2)));
    }
  }

  try {
    await Promise.all(Array.from({ length: options.viewers }, (_, index) => viewer(index + 1)));
  } finally {
    input.close();
  }

  const actualSeconds = (Date.now() - startedAt) / 1000;
  const totalBytes = responseBytes.reduce((total, size) => total + size, 0);
  return {
    targetHost: options.baseUrl.hostname,
    auctionId: options.auctionId,
    viewers: options.viewers,
    requestedDurationSeconds: options.durationSeconds,
    actualDurationSeconds: Number(actualSeconds.toFixed(2)),
    requests: requestCount,
    requestsPerSecond: Number((requestCount / actualSeconds).toFixed(2)),
    latencyMs: {
      p50: percentile(latencies, 0.50),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length ? Math.max(...latencies) : null,
    },
    statuses,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
    responseBytes: {
      total: totalBytes,
      average: responseBytes.length ? Math.round(totalBytes / responseBytes.length) : 0,
      max: responseBytes.length ? Math.max(...responseBytes) : 0,
      byStatus: Object.fromEntries(Object.entries(responseBytesByStatus).map(([status, sizes]) => [status, {
        count: sizes.length,
        average: Math.round(sizes.reduce((total, size) => total + size, 0) / sizes.length),
        max: Math.max(...sizes),
      }])),
    },
    notModifiedRate: requestCount ? Number(((statuses[304] ?? 0) / requestCount).toFixed(4)) : 0,
    distinctEtags: etags.size,
    publicStateTransitionsObserved: stateTransitions,
    operatorMarkedUpdateVisibilityMs: visibilityMeasurements,
    unpairedOperatorChangeMarkers: pendingChangeMarkers.map(({ label }) => label),
    firstRequestAt: firstRequestAt ? new Date(firstRequestAt).toISOString() : null,
    lastRequestAt: lastRequestAt ? new Date(lastRequestAt).toISOString() : null,
    databaseDiagnostics: "Correlate Vercel logs with event=public_auction_request and event=public_auction_snapshot; no server diagnostics are exposed by the public API.",
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printUsage();
  if (!options.run) {
    console.log(JSON.stringify({
      mode: "dry-run",
      networkRequests: 0,
      viewers: options.viewers,
      pollIntervalMs: Number(options.pollMs),
      note: "Add --run plus explicit staging host confirmation to start read-only requests.",
    }, null, 2));
    return printUsage();
  }

  const validated = validateRun(options);
  console.log(JSON.stringify({ mode: "read-only-load", ...validated, writes: 0 }, null, 2));
  const report = await runLoad(validated);
  console.log(JSON.stringify(report, null, 2));
  if (report.errorCount > 0 || report.publicStateTransitionsObserved === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Load test refused or failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});