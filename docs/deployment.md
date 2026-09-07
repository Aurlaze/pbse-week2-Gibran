# Deploying

Neon for Postgres, Render for the service. Both free, both driven from the
browser. Anyone with the repository can repeat these steps.

## 1. Database (Neon)

1. Sign up at <https://neon.tech> with GitHub.
2. **Create project** - name it `badminton-booking`, region **Singapore**.
3. Copy the connection string from the dashboard. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

   Treat it as a password. It never goes in the repository.

## 2. Build the schema

From your machine, with that string:

```bash
cd service
DATABASE_URL='postgresql://...' npm run db:setup
```

Expected output:

```
applying schema.sql ... ok
applying seed.sql ... ok
tables: bookings, courts, idempotency_keys
```

If all three tables are not listed, stop here. The service cannot work until
they exist, and a missing `bookings` table shows up as a 500 on every write.

## 3. Service (Render)

1. Sign up at <https://render.com> with GitHub.
2. **New > Blueprint**, pick this repository. Render reads `render.yaml` and
   proposes one web service.
3. When prompted for `DATABASE_URL`, paste the Neon string.
4. **Apply**. The first build takes a few minutes.

Do not set `PORT`. Render provides it, and `src/server.js` already reads it.

## 4. Check it

```bash
BASE=https://<your-service>.onrender.com

curl -s "$BASE/health"
curl -s "$BASE/v1/courts"
curl -s -o /dev/null -w '%{http_code}
' "$BASE/v1/courts/BAD-ID"   # 400
curl -s -o /dev/null -w '%{http_code}
' "$BASE/v1/courts/crt_zzz"  # 404
```

Then the idempotency rule, end to end:

```bash
KEY=$(uuidgen)
for i in 1 2; do
  curl -s -o /tmp/r$i.json -w '%{http_code}
'     -X POST "$BASE/v1/bookings"     -H "Idempotency-Key: $KEY" -H 'Content-Type: application/json'     -d '{"courtId":"crt_51Fa93cD","startTime":"2026-08-29T19:00:00+07:00","endTime":"2026-08-29T20:00:00+07:00"}'
done
diff /tmp/r1.json /tmp/r2.json && echo "identical responses"
```

Two `201`s and identical bodies. Then **Manual Deploy > Restart** in Render and
`GET` the booking again: it must still be there.

## 5. Record it

- Deployment URL into the root `README.md`.
- Replace the `https://api.example.com/v1` placeholder in `openapi.yaml`
  `servers:` with the real URL, and delete `no-server-example.com: off` from
  `spec/redocly.yaml`.
- Run the contract check against it:

  ```bash
  BASE=https://<your-service>.onrender.com/v1 ./tests/contract/run.sh
  ```

## Notes

The free Render instance sleeps after inactivity, so the first request after a
quiet period takes ~30 seconds. Wake it before demonstrating.

Configuration lives only in Render's dashboard. `DATABASE_URL` is the single
secret; everything else is committed and identical everywhere.
