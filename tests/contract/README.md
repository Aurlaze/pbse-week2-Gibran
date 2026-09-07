# Contract tests

These check that the running service answers what `openapi.yaml` promises:
every documented status code, in the documented shape, including the failure
cases.

## Running them

Against a local service:

```bash
pip install schemathesis
cd service && npm start &
BASE=http://localhost:3000/v1 ./tests/contract/run.sh
```

Against the deployed service:

```bash
BASE=https://your-deployment/v1 ./tests/contract/run.sh
```

Against the Session 2 mock, which should pass by construction:

```bash
cd spec && npm run mock &
BASE=http://127.0.0.1:4010 ./tests/contract/run.sh
```

Only the base URL changes between the three.

## When a check fails

There are exactly two lawful fixes:

1. **Fix the implementation.** This is the right answer in most cases. A `500`
   on invalid input tells a client to retry a request that will never succeed.
2. **Revise the contract deliberately**, bump its version, and record the
   reason in `CHANGELOG.md`.

Deleting a field from a `required` list, or removing a response, so that the
check goes green is not a fix. Every client already reading that field breaks
silently, and nobody finds out until Session 7.

Ask which behaviour the client should be able to rely on. That answer decides
which of the two fixes applies.
