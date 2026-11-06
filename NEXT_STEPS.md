# Manzu Pharmacy: next steps (handoff)

This is the working plan after the mobile app (M1–M8) was built. Work the tasks **in order**. Each task says which repo/branch, what to change, and how to check it. Update the **Status** column and the log at the bottom when a task moves. A new session can pick up from the first task that isn't `Done`.

Repos and branches (**the owner's own GitHub account `wellrica01` is the source of truth**; the `utmemastery/*` repos are a read-only archive of where the work was built and must not be used):
- Backend: `wellrica01/manzu-backend`, branch **`med-version`** (not `main`). Hosted on Render, which deploys `med-version` (`https://manzu-backend.onrender.com`)
- Web: `wellrica01/manzu-frontend`, branch **`med-version`** (not `main`). Hosted on Vercel
- Mobile: `wellrica01/manzu-mobile` (private), branch **`main`**, app in `mobile/`. The detailed app plan, backend gaps (G1–G14) and decisions (D0–D6) are in `mobile/PLAN.md`

## Rules for every task (read first)
1. **Never run `prisma migrate dev`, `prisma migrate reset`, `prisma db push --force-reset` or any Prisma command that talks to a real database.** The production database has drifted from the one committed migration (35 models in `schema.prisma`, 24 tables in the migration), so `migrate dev` would ask to reset it and wipe data. For schema changes: edit `prisma/schema.prisma`, run `npx prisma generate` only, and write the SQL by hand as an idempotent file in `prisma/sql/` (`CREATE TABLE IF NOT EXISTS ...`). **The owner runs the SQL on the database before the PR is merged.**
2. Backend and web work: branch off `med-version`, open a PR back into `med-version`. Never touch `main`. Mobile work: branch off `main`, PR into `main`. Never force-push.
3. **Merging into backend `med-version` deploys to production on Render.** Run any required SQL first, and keep each PR small.
4. Never commit secrets, `.env` files or tokens, and never print tokens in logs, PR text or chat.
5. Do only the task you were given. List anything else you notice instead of changing it.

## Where things stand

| Item | State |
|---|---|
| Mobile M1–M8 | All merged into `main` (built and reviewed as PRs #3–#8, #1, #2 in the archived `utmemastery/manzu-mobile`). `main` was pushed to `wellrica01/manzu-mobile` on 2026-11-06 at `bb2ea36` |
| Mobile CI | `.github/workflows/mobile.yml` runs typecheck, lint and `npx expo-doctor` on `mobile/**` changes (check the Actions tab of `wellrica01/manzu-mobile`) |
| Backend security fixes (Task 1) | Merged into `med-version` and **deployed to Render** (commit `4177ab0` = security PR `9ccba44` + removal of unused `paystack-api`). Smoke tests passed (see log) |
| Web | Unchanged: `med-version` at `5c07e7e` |
| Device testing | Not done (deferred until the build was finished) |

## Task list

| # | Task | Repo | Status |
|---|---|---|---|
| 1 | Backend security fixes (B11, G9, G13, G14 + pharmacy-ADMIN escalation) | backend `med-version` | **Done** (merged + deployed 2026-11-06). Remaining small follow-up: allow role edits in mobile `StaffFormSheet.tsx` (G9 is now live) |
| 2 | Mobile repo hygiene: PRs for M1–M6, CI (typecheck + lint), merge chain into `main` | mobile | **Done**; repo moved to `wellrica01/manzu-mobile` |
| 3 | Push for real (G4): `PushToken` table, register/unregister endpoints, Expo sender on order events; switch the mobile flag on | backend + mobile | Not started |
| 4 | Refresh tokens + logout (G2) and `GET /api/auth/me` (G1); return pharmacy status at login (G11) | backend + mobile | Not started |
| 5 | Orders correctness: single-order PATCH keeps `cancelReason` + restocks (G7), server-side transition graph (G10) | backend (+ mobile simplification) | Not started |
| 6 | Server-side analytics endpoint (G8) and consistent error shape (G12) | backend + mobile | Not started |
| 7 | Web portal fixes: stop calling `/api/auth/verify`, real notification bell | web `med-version` | Not started |
| 8 | Unit tests for mobile pure logic (hours formatting, GPS combine, schemas) | mobile | Not started |
| 9 | End-to-end device testing (dev build against staging backend; manager + staff accounts) | all | Not started |
| 10 | Release prep: `med-version` → `main`, deploy, Sentry, `expo-updates`, store listings, privacy policy | all | Not started |

### 1. Backend security fixes

Branch off backend `med-version`, one PR back into `med-version`.
- **G13**: `src/app.js` "DEBUG HEADER LOGGING" middleware prints every request's headers, including `Authorization` Bearer tokens. Remove it.
- **G14 (+ escalation)**: `middleware/auth.js` `authenticate` accepts any valid JWT. Pharmacy tokens carry `{userId, pharmacyId, role}`, admin tokens `{adminId, role}`.
  - An admin token on pharmacy routes has no `pharmacyId`, so queries run with `pharmacyId: undefined`.
  - `PharmacyUserRole` includes `ADMIN`, so a pharmacy user with role `ADMIN` passes `authorizeRoles('ADMIN','SUPER_ADMIN')` on `/api/admin/*`.
  - Fix: add `authenticatePharmacy` (requires `userId` + `pharmacyId`) and `authenticateAdmin` (requires `adminId`). Use them in `routes/pharmacy.js`, the pharmacy routes in `routes/auth.js`, and `routes/admin.js`.
- **G9**: `POST /api/auth/add-user` accepts any role (MANAGER/OWNER/ADMIN). Restrict it to `PHARMACIST | STAFF | TECHNICIAN` (decision D3). Let `PATCH /api/auth/users/:id` change `role` within the same set (it's dropped today).
- **B11**: `POST /api/pharmacy/change-password` overwrites the PIN hash with an 8+ char "password", which locks the user out of PIN login. Nothing calls it (web and mobile use `PATCH /api/auth/change-password`). Return `410 Gone` pointing to the right endpoint.
- Check: `node -e "require('./src/app')"`-style load check / start the server, then exercise login, profile and an admin route with each token type.
- Mobile follow-up (small): once G9 is deployed, allow role edits in `features/staff/components/StaffFormSheet.tsx`.

### 2. Mobile repo hygiene
- **Complete:** the milestone PR chain was merged into `main` with merge commits in order #3 → #4 → #5 → #6 → #7 → #8 → #1 → #2 (in the archived repo).
- `.github/workflows/mobile.yml` (Node 22, `npm ci`, `npm run typecheck`, `npm run lint`, `npx expo-doctor` in `mobile/`) passed on `main` before the move. Confirm it is green on the first run in `wellrica01/manzu-mobile`.

### 3. Push for real (G4)
- **Follow the "Rules for every task" above.** The new table's SQL goes in `prisma/sql/` and is run by the owner **before** the backend PR is merged. The existing `Pharmacy.devicetoken` column and `POST /api/pharmacy/notifications/register` stay working until the mobile app has moved to the new endpoints.
- Use `authenticatePharmacy` (from `middleware/auth.js`) on the new routes.
- Sending a push must never break payments or order updates: wrap it in try/catch and do not let it fail `confirmOrder`, the Paystack webhook or the pharmacy order update. `confirmOrder` and the `charge.success` webhook can both mark the same order PAID, so send **once per order**.
- Never log device tokens. Keep push text free of customer name and phone.
- Order of delivery: backend PR first (SQL run, merged, deployed, tested with a real token), then the mobile PR. Do not switch `EXPO_PUBLIC_PUSH_ENABLED=true` before the backend is live. Android delivery also needs Firebase/FCM credentials set up in EAS by the owner.
- Prisma: `PushToken { id, userId, pharmacyId, token @unique, platform, createdAt, lastSeenAt }`.
- `POST /api/pharmacy/push-tokens {token, platform}` (upsert), `DELETE /api/pharmacy/push-tokens/:token` (on logout).
- Sender via Expo Push API (`expo-server-sdk`) when an order becomes PAID/ready for the pharmacy and on status changes. Payload `data: { orderId }` (the mobile app already opens `/orders/[id]` from that). Prune tokens Expo reports as `DeviceNotRegistered`.
- Mobile: point `features/push/api.ts` at the new endpoint, unregister in `signOut`, set `EXPO_PUBLIC_PUSH_ENABLED=true`.

### Housekeeping (owner, any time; none blocks the tasks above)
- Render: turn **off** `SENTRY_DEBUG` (the deploy log warns it is on in production and floods the logs).
- Make `wellrica01/manzu-backend` and `wellrica01/manzu-frontend` **private** (they were public on 2026-11-06), then check that Render and Vercel still have access.
- Frontend: remove the tracked `manzu-frontend/.env.local` (`git rm --cached .env.local`, add to `.gitignore`), and rotate any real key that ever sat in it.
- Backend: `npm audit` reports 36 vulnerabilities in production dependencies (1 critical). Handle in its own PR; do **not** run `npm audit fix --force`.
- Still open from the audit (`OPEN_QUESTIONS.md`): public `POST /api/auth/admin/register` (S1), phone-based guest takeover (S2), prescription IDOR (S3), public prescription image URLs (S4), CORS allowing origin-less requests (S7). Plan these as separate security tasks.
- Backend `main` is 9 commits ahead of and 76 behind `med-version`; reconcile in Task 10.

### 4–8
See `mobile/PLAN.md` §4 rows G1, G2, G7, G8, G10, G11, G12 for the exact endpoint shapes already agreed.

### 9. Device testing
Needs: `npx eas-cli@latest init` (sets `EAS_PROJECT_ID`), EAS env vars `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_API_KEY`. Then `eas build --profile development`. Cover login/PIN, orders (all transitions + cancel), POS sale, inventory, analytics, payment/bank (manager), profile/hours/logo/location, staff CRUD, register with GPS.

## Log
- 2026-11-05: M7 → PR #1, M8 → PR #2. This doc written; task 1 started.
- 2026-11-05: Task 1 → [backend PR #1](https://github.com/utmemastery/manzu-backend/pull/1) (not merged; middleware/schema checks run in Node, server not run against a DB). Next: merge + deploy it, then task 2.
- 2026-11-05: Task 2 → mobile PRs #3–#8 opened for M1–M6; CI workflow added to M8 branch. Next: owner approves merging the chain, then task 3.
- 2026-11-06: Repos moved to the owner's account `wellrica01`: mobile `main` pushed to `wellrica01/manzu-mobile`; backend `med-version` fast-forwarded from the archive (`37d257a` → `9ccba44`) plus commit `4177ab0` (remove unused `paystack-api`, 44 packages dropped); frontend unchanged. `utmemastery/*` is now archive-only.
- 2026-11-06: Task 1 deployed to Render (`4177ab0`). Smoke tests on `https://manzu-backend.onrender.com`: `/health` healthy with DB connected; pharmacy token on `/api/admin/dashboard` → 403; `POST /api/pharmacy/change-password` → 410; pharmacy token on `/api/pharmacy/profile` → 200. Still to confirm in the browser: pharmacy portal login and admin console login/dashboard.
- 2026-11-06: Task 2 complete → merged mobile PRs #7, #8, #1, and #2 after #3–#6; all M1–M8 changes are on `main`. Post-merge typecheck + lint workflow passed. Next: continue with Task 3 (real push, G4).
