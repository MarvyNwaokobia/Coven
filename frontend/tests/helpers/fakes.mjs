// A fake backend for the route tests: Supabase (PostgREST), Circle and Yellow Card, all answered
// by a replacement for global fetch. The database enforces the same unique keys as the real
// migrations, so a test that replays a request sees the constraint fire as it would in Postgres.
//
// Routes are the real route handlers from app/api; only the network is faked.
import assert from "node:assert/strict";

export const FRONTEND = new URL("../../", import.meta.url);
export const load = (relativePath) => import(new URL(relativePath, FRONTEND).href);

const SUPABASE = "https://supabase.test";

/** Unique keys the migrations add (006, 007 and the cash-out deposit hash). */
const UNIQUE = {
  payments: "tx_hash",
  goal_contributions: "tx_hash",
  circle_goals: "contract_goal_id",
  splits: "contract_split_id",
  offramp_payouts: "deposit_tx_hash",
};

const json = (body, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const noRows = () =>
  json({ code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "no rows" }, 406);
const duplicate = (column) =>
  json(
    { code: "23505", details: `Key (${column}) already exists.`, hint: null, message: `duplicate key value violates unique constraint on ${column}` },
    409
  );

function matches(row, searchParams) {
  return [...searchParams.entries()].every(([key, value]) => {
    if (["select", "order", "limit", "on_conflict"].includes(key)) return true;
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[key]));
    return true;
  });
}

/**
 * Install the fakes. Returns { db, world, reset }.
 *  db     tables as arrays of rows, created on first use
 *  world  what the fake Circle / Yellow Card side holds and has seen:
 *           transfers   USDC transfers Circle can list (matched by destinationAddress)
 *           execTxs     contract executions Circle can list
 *           inbound     inbound transfers for the deposit sync
 *           challenges / transferChallenges   challenges the routes asked Circle to create
 *           yellowCard  payout requests made to Yellow Card
 *           upserts     payments upserts (to check on_conflict / ignore-duplicates)
 *           hidePaymentSelect  make the "already recorded?" pre-check miss, so only the unique
 *                              constraint can stop a duplicate (a race)
 *           yellowCardFails    make Yellow Card answer 500
 */
export function installFakes() {
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE,
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    CIRCLE_API_KEY: "test",
    YELLOW_CARD_API_KEY: "test",
    YELLOW_CARD_API_SECRET: "test",
    ARC_USDC_TOKEN_ID: "test-token",
    ENCRYPTION_KEY: "ab".repeat(32),
  });

  // Any table name answers with an array, like a real database that has the table but no rows yet.
  const db = new Proxy({}, { get: (target, key) => (typeof key === "string" ? (target[key] ??= []) : target[key]) });
  const world = {};
  let seq = 0;

  function reset() {
    for (const key of Object.keys(db)) delete db[key];
    Object.assign(world, {
      transfers: [],
      execTxs: [],
      inbound: [],
      challenges: [],
      transferChallenges: [],
      yellowCard: [],
      upserts: [],
      errors: [],
      inserts: {},
      lastWallet: null,
      hidePaymentSelect: false,
      yellowCardFails: false,
    });
  }
  reset();
  const table = (name) => db[name];

  // Routes retry while Circle indexes a new transaction (seconds apart). Skip the waiting.
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms >= 1000 ? 0 : ms, ...args);
  // Routes log the failures they turn into 4xx/5xx; keep them for assertions instead of noise.
  console.error = (...args) => world.errors.push(args.map(String).join(" "));

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const u = new URL(url);
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers ?? {});
    const single = (headers.get("accept") ?? "").includes("pgrst.object");
    const bearer = (headers.get("authorization") ?? "").replace("Bearer ", "");
    let m;

    // ---- Supabase
    if (url === `${SUPABASE}/auth/v1/user`) return json({ id: bearer.replace("tok-", ""), aud: "authenticated" });
    if ((m = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/))) {
      table("rpc").push({ fn: m[1], args: JSON.parse(init.body) });
      return json(null, 204);
    }
    if ((m = u.pathname.match(/^\/rest\/v1\/(\w+)$/))) {
      const name = m[1];
      const rows = table(name);
      if (method === "GET") {
        let found = rows.filter((r) => matches(r, u.searchParams));
        if (name === "payments" && world.hidePaymentSelect && u.searchParams.get("tx_hash")) found = [];
        if (name === "splits") found = found.map((r) => ({ ...r, creator: table("users").find((x) => x.id === r.creator_id) }));
        return single ? (found.length ? json(found[0]) : noRows()) : json(found);
      }
      if (method === "POST") {
        const body = JSON.parse(init.body);
        const list = Array.isArray(body) ? body : [body];
        const prefer = headers.get("prefer") ?? "";
        world.inserts[name] = (world.inserts[name] ?? 0) + 1;
        if (name === "payments" && u.searchParams.get("on_conflict")) {
          world.upserts.push({ onConflict: u.searchParams.get("on_conflict"), prefer, rows: list });
        }
        const saved = [];
        for (const r of list) {
          const column = UNIQUE[name];
          if (column && r[column] && rows.some((x) => x[column] === r[column])) {
            if (prefer.includes("ignore-duplicates")) continue;
            return duplicate(column);
          }
          const row = { id: name[0] + ++seq, ...r };
          rows.push(row);
          saved.push(row);
        }
        if (!prefer.includes("return=representation")) return new Response(null, { status: 201 });
        return single ? json(saved[0], 201) : json(saved, 201);
      }
      if (method === "PATCH") {
        for (const r of rows.filter((x) => matches(x, u.searchParams))) Object.assign(r, JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
    }

    // ---- Circle
    if (url === "https://api.circle.com/v1/w3s/users/token") return json({ data: { userToken: "t", encryptionKey: "e" } });
    if (url === "https://api.circle.com/v1/w3s/user/transactions/contractExecution") {
      world.challenges.push(JSON.parse(init.body));
      return json({ data: { challengeId: "challenge-" + world.challenges.length } });
    }
    if (url === "https://api.circle.com/v1/w3s/user/transactions/transfer") {
      world.transferChallenges.push(JSON.parse(init.body));
      return json({ data: { challengeId: "transfer-" + world.transferChallenges.length } });
    }
    if (u.pathname === "/v1/w3s/transactions") {
      if (u.searchParams.get("txType") === "INBOUND") return json({ data: { transactions: world.inbound } });
      world.lastWallet = u.searchParams.get("walletIds");
      const destination = u.searchParams.get("destinationAddress");
      const list = destination
        ? world.transfers.filter((t) => t.destinationAddress.toLowerCase() === destination.toLowerCase())
        : world.execTxs;
      return json({ data: { transactions: list.map(({ id, amounts, contractAddress, createDate }) => ({ id, amounts, contractAddress, createDate })) } });
    }
    if ((m = u.pathname.match(/^\/v1\/w3s\/transactions\/(.+)$/))) {
      const t = world.transfers.find((x) => x.id === m[1]) ?? world.execTxs.find((x) => x.id === m[1]);
      return json({ data: { transaction: { state: "COMPLETE", walletId: world.lastWallet, ...t } } });
    }

    // ---- Yellow Card
    if (url === "https://sandbox.api.yellowcard.io/v1/payouts") {
      world.yellowCard.push(JSON.parse(init.body));
      if (world.yellowCardFails) return json({ error: "boom" }, 500);
      return json({ id: "yc-" + world.yellowCard.length, destinationAmount: 154440, estimatedArrival: "soon" });
    }

    throw new Error(`unstubbed fetch: ${method} ${url}`);
  };

  return { db, world, table, reset };
}

/** Call a route's POST handler as `who` (the fake auth treats the bearer token "tok-<id>" as that user id). */
export async function callRoute(route, who, body, params) {
  const response = await route.POST(
    new Request("http://test.local", {
      method: "POST",
      headers: { authorization: `Bearer tok-${who}`, "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
    { params: Promise.resolve(params ?? {}) }
  );
  return { status: response.status, body: await response.json() };
}

/**
 * The scenarios are stateful (each step builds on the last), so they run in order inside one test
 * and every check is then reported as its own subtest. `finally { await report(t) }` keeps the
 * results visible even when a step throws.
 */
export function makeChecker() {
  const results = [];
  return {
    check(name, condition, detail = "") {
      results.push({ name, ok: Boolean(condition), detail: typeof detail === "string" ? detail : JSON.stringify(detail) });
    },
    async report(t) {
      for (const r of results) await t.test(r.name, () => assert.ok(r.ok, r.detail));
    },
  };
}
