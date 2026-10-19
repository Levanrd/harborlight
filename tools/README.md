# Development tools

Run these from the repository root after `npm ci`. HTML previews are served by the local Vite development server at `/tools/<name>.html`. They are development harnesses, not production entry points.

Generated screenshots, logs, metrics, and city snapshots are ignored by Git. Their generator scripts remain in the repository:

```sh
npx tsx tools/create-regional-fixture.ts
npx tsx tools/inspect-showcase.ts
npx tsx tools/soak-city.ts
npx tsx tools/traffic-audit.ts
```

`regional-fixture.json` is a synthetic fixture included because the regional preview imports it. The soak script creates the snapshots consumed by `profile-city.ts` and `inspect-queues.ts`; check its command-line arguments before running a particular scenario. Never commit an exported personal city or credentials as a test fixture.

For serial test execution on Windows:

```sh
npx tsx --test --test-concurrency=1 src/*.test.ts
```
