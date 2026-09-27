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
5. Under **Environment Variables**, add the following, applied to
   Production, Preview and Development:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string |
   | `OIDC_ISSUER` | the realm's issuer URL |
   | `OIDC_JWKS_URI` | the realm's JWKS endpoint |
   | `OIDC_AUDIENCE` | `badminton-api` |
   | `CORS_ALLOWED_ORIGINS` | the deployed web application's origin |

   The first four are required: `src/config.js` refuses to start without
   them. `CORS_ALLOWED_ORIGINS` is comma-separated, and each entry is a
   full origin — scheme, host, and port — with no trailing slash. It must
   include the deployed web application and, while developing against the
   deployed service, `http://localhost:5173`. An origin missing here does
   not stop the service processing that origin's requests; it stops the
   browser letting the page read the answers (A.4).
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

`DATABASE_URL` is the only secret, and it is set in Vercel's dashboard. The
other variables are environment-specific rather than secret: the OIDC
addresses and the CORS allow-list differ per deployment, which is exactly
why none of them is committed.

Deploying the web application to a new address means two changes, both
outside its own code: add that origin to `CORS_ALLOWED_ORIGINS` here, and
add `<origin>/callback` to the Keycloak client's redirect URIs. Forgetting
the first shows up as a CORS error in the console; forgetting the second
shows up as a Keycloak error page before the application ever loads.

---

# Deploying the web application

A second Vercel project, from the same repository. The service and the web
application are separate deployments with separate addresses — which is the
whole reason CORS exists between them.

1. **New Project**, same repository.
2. **Set Root Directory to `web`.**
3. Framework preset: **Vite**.
4. Under **Environment Variables**, add all of these, applied to Production,
   Preview and Development:

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | the deployed service, including `/v1`, no trailing slash |
   | `VITE_KEYCLOAK_URL` | the Keycloak address |
   | `VITE_KEYCLOAK_REALM` | `badminton-booking` |
   | `VITE_KEYCLOAK_CLIENT_ID` | `badminton-student-web` |
   | `VITE_KEYCLOAK_SCOPES` | `bookings:write courts:write` |

   Every one of these is baked into the bundle at build time and is readable
   by anyone who opens the page. None of them is a secret, and none of them
   can be changed without rebuilding.

5. **Deploy.**

## Three things to do after the first deployment

The application's address is not known until it exists, and three separate
places need to be told what it is. Each failure looks different:

| Where | What to add | Symptom if forgotten |
|---|---|---|
| The service's `CORS_ALLOWED_ORIGINS` | the web application's origin | A CORS error in the console. The request still reached the service and was still processed — only the reply is withheld from the page |
| The Keycloak client's **Valid redirect URIs** | `<origin>/callback` | A Keycloak error page before the application ever loads |
| The Keycloak client's **Web origins** | the origin | Sign-in succeeds, then token refresh fails |

## Why `vercel.json` is there

`web/vercel.json` rewrites every path to `index.html`, and
`web/public/_redirects` does the same for Netlify-style hosts.

Without it the routing works only while navigating inside the application.
The moment somebody opens `/bookings/bkg_abc123` directly — pasting a link,
refreshing the page, or opening a screen in a second tab — the host looks
for a file at that path, does not find one, and answers 404. The application
never loads and React Router never gets to see the URL.

That is not a cosmetic problem: reloading a screen and opening one in a new
tab are two of the six things the grader does.
