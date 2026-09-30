# D1 + Kysely 0.29 cross-request I/O repro

Reproduces better-auth/better-auth#11483 locally in workerd (`wrangler dev`) with local D1.

A fresh `better-auth@1.7.6` install resolves `kysely@0.29.6`. Kysely 0.29 puts a
`ConnectionMutex` in front of every SQLite dialect whose adapter reports
`supportsMultipleConnections === false`, which `D1SqliteAdapter` inherits from
`SqliteAdapter`. With the auth instance memoized per isolate, one request
awaits a mutex promise that another request resolves.

## Run

```sh
npm install
npx wrangler d1 execute repro --local --file schema.sql
npx wrangler dev --port 8799      # terminal 1
node load.mjs 100 100             # terminal 2: 100 rounds x 100 concurrent getSession calls
```

## Results (10,000 requests each)

| Setup | Failed requests |
| --- | --- |
| kysely 0.29.6, adapter as published | 261 and 664 (two runs) |
| kysely 0.29.6, `get supportsMultipleConnections() { return true; }` on `D1SqliteAdapter` | 0 |
| kysely 0.28.17 (`"overrides": { "kysely": "0.28.17" }`), adapter as published | 0 |

Failures are `Cannot perform I/O on behalf of a different request ... (I/O type: UserTraceAsyncContext)`,
some surfacing as `Fatal uncaught kj::Exception`, which drops the isolate and
fails in-flight requests with `Network connection lost`.
