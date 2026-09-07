# Deploying

Neon for Postgres, Vercel for the service. Both free, both driven from the
browser. Anyone with the repository can repeat these steps.

## 1. Database (Neon)

1. Sign up at <https://neon.tech> with GitHub.
2. **Create project**, region **Singapore** (`ap-southeast-1`).
3. Copy the **pooled** connection string, the one whose host contains
   `-pooler`. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```

   The pooled endpoint matters here: each serverless invocation keeps its own
   connection, and the direct endpoint runs out of them quickly.

   Treat the string as a password. It never goes in the repository.

## 2. Build the schema

```bash
cd service
DATABASE_URL='postgresql://...' npm run db:setup
```

Expected:

```
applying schema.sql ... ok
applying seed.sql ... ok
tables: bookings, courts, idempotency_keys
```

If all three tables are not listed, stop. A missing `bookings` table shows up
later as a 500 on every write.

## 3. Service (Vercel)

1. Sign up at <https://vercel.com> with GitHub.
2. **Add New > Project**, import this repository.
3. **Set Root Directory to `service`.** This is the one setting that is easy to
   miss and breaks the build if wrong: the app's `package.json` lives in
   `service/`, not at the repository root.
4. Framework preset: **Other**. The build needs no configuration beyond that,
   because `service/vercel.json` routes every path to `service/api/index.js`.
5. Under **Environment Variables**, add `DATABASE_URL` with the Neon string.
   Apply it to Production, Preview and Development.
6. **Deploy.**

Do not set `PORT`. There is no long-running process to bind one; `api/index.js`
exports the app and Vercel invokes it per request.

## 4. Check it

```bash
BASE=https://<your-project>.vercel.app

curl -s "$BASE/health"
curl -s "$BASE/v1/courts"
curl -s -o /dev/null -w '%{http_code}
' "$BASE/v1/courts/BAD-ID"    # 400
curl -s -o /dev/null -w '%{http_code}
' "$BASE/v1/courts/crt_zzz"   # 404
```

Then the idempotency rule, end to end:

```bash
KEY=$(uuidgen)
for i in 1 2; do
  curl -s -o /tmp/r$i.json -w '%{http_code}
'     -X POST "$BASE/v1/bookings"     -H "Idempotency-Key: $KEY" -H 'Content-Type: application/json'     -d '{"courtId":"crt_51Fa93cD","startTime":"2027-03-01T19:00:00+07:00","endTime":"2027-03-01T20:00:00+07:00"}'
done
diff /tmp/r1.json /tmp/r2.json && echo "identical responses"
```

Two `201`s, identical bodies, one new row.

For the restart demonstration there is no process to restart, so redeploy from
the Vercel dashboard instead and read the booking back. The point of the check
is that the data lives outside the process, which a redeploy shows just as well.

## 5. Record it

- Deployment URL into the root `README.md`.
- Replace the `https://api.example.com/v1` placeholder in `openapi.yaml`
  `servers:` with the real URL, and delete `no-server-example.com: off` from
  `spec/redocly.yaml`.
- Run the contract check against it:

  ```bash
  BASE=https://<your-project>.vercel.app/v1 ./tests/contract/run.sh
  ```

## Notes

The first request after a quiet period pays a cold start of a second or two.
Wake it before demonstrating.

`DATABASE_URL` is the only secret, and it is set in Vercel's dashboard.
Everything else is committed and identical in every environment.
