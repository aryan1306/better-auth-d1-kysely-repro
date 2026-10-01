# Repro: better-auth/better-auth#11483

On Cloudflare D1, concurrent requests that share one memoized auth instance fail with `Cannot perform I/O on behalf of a different request`, because kysely 0.29 puts every D1 query behind a `ConnectionMutex` shared across requests.

## Versions

- better-auth@1.7.6 (resolves kysely@0.29.6 on a fresh install). The issue was reported on 1.7.5; 1.7.7 has the same kysely range (`^0.28.17 || ^0.29.0`) and was not run separately.
- wrangler@4.145.0 (workerd 1.20260930.2), `compatibility_date = "2026-09-01"`, `nodejs_compat`
- Local D1 through `wrangler dev`
- Node 24 on two machines: macOS (Darwin 27.0.0, Apple Silicon) and Ubuntu 24.04 (x86_64, 6 cores)

## Run

    npm install
    npx wrangler d1 execute repro --local --file schema.sql
    npx wrangler dev --port 8799      # terminal 1
    node load.mjs 100 100             # terminal 2: 100 rounds x 100 concurrent getSession calls

`load.mjs` signs up one user, then sends `getSession` requests in parallel and prints a count of each response.

## Result

| Setup | macOS | Ubuntu |
| --- | --- | --- |
| kysely 0.29.6, adapter as published | 261 and 664 of 10,000 (two runs) | 91 of 2,424 |
| kysely 0.29.6, `get supportsMultipleConnections() { return true; }` on `D1SqliteAdapter` | 0 of 10,000 | 0 of 2,501 |
| kysely 0.28.17 (`"overrides": { "kysely": "0.28.17" }`), adapter as published | 0 of 10,000 | 0 of 2,501 |

Numbers are failed requests out of requests sent. The Ubuntu runs were stopped early because local D1 on that machine handled only about 2 requests per second in every setup, including the two that don't fail.

Failures are `Cannot perform I/O on behalf of a different request ... (I/O type: UserTraceAsyncContext)`. Some surface as `Fatal uncaught kj::Exception`, which drops the isolate and fails in-flight requests with `Network connection lost`. The failure count varies between runs because it depends on when V8 optimizes the waiting code, so expect different counts on each run.

Expected: 0 failed requests.

## Notes

Kysely 0.29 adds a `ConnectionMutex` in front of every SQLite dialect whose adapter reports `supportsMultipleConnections === false`. `D1SqliteAdapter` inherits that from `SqliteAdapter`. With the auth instance memoized per isolate (the usual Workers pattern, see `src/index.ts`), one request awaits a mutex promise that another request resolves, and its next D1 call runs outside its own I/O context.

D1 keeps no connection state and the driver already refuses interactive transactions, so the mutex protects nothing. The fix in better-auth/better-auth#11490 overrides `supportsMultipleConnections` to return `true` on `D1SqliteAdapter`, which is the second row above.

## Auth config

```ts
betterAuth({
  secret: "repro-secret-repro-secret-repro-secret",
  baseURL: "http://localhost:8799",
  database: env.DB,
  emailAndPassword: { enabled: true },
});
```
