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
| Mobile M1–M8 | All merged into `main`. Verified end-to-end on 2 Android devices (Tasks 3–5). |
| Mobile CI | `.github/workflows/mobile.yml` runs typecheck, lint and `npx expo-doctor` on `mobile/**` changes (check the Actions tab of `wellrica01/manzu-mobile`) |
| Backend security fixes (Task 1) | Merged into `med-version` and **deployed to Render** (commit `4177ab0` = security PR `9ccba44` + removal of unused `paystack-api`). Smoke tests passed (see log) |
| Web | Unchanged: `med-version` at `5c07e7e` |
| Device testing | **Done for the auth + push + orders flows** on 2 physical Android devices (`095973733N007477` and `14733405AX001861`). Other flows (POS, inventory, analytics, staff, register) not yet tested — Task 9. |
| EAS build | Preview APK built and installed via ADB on both devices. FCM V1 service account bound to EAS project `0cf648d0-50ba-45e7-862f-ce14bcca4f1c`. |

## Task list

| # | Task | Repo | Status |
|---|---|---|---|
| 1 | Backend security fixes (B11, G9, G13, G14 + pharmacy-ADMIN escalation) | backend `med-version` | **Done** (merged + deployed 2026-11-06). Remaining small follow-up: allow role edits in mobile `StaffFormSheet.tsx` (G9 is now live) |
| 2 | Mobile repo hygiene: PRs for M1–M6, CI (typecheck + lint), merge chain into `main` | mobile | **Done**; repo moved to `wellrica01/manzu-mobile` |
| 3 | Push for real (G4): `PushToken` table, register/unregister endpoints, Expo sender on order events; switch the mobile flag on | backend + mobile | **Done** (backend PR #1, mobile PR #1). Verified on 2 devices: both registered tokens, both received push for a real paid order, tap opened order detail. |
| 4 | Refresh tokens + logout (G2) and `GET /api/auth/me` (G1); return pharmacy status at login (G11) | backend + mobile | **Done** (backend PR #3, mobile PR #2). Verified on 2 devices: session persists across force-close, refresh rotates, replay revokes the chain, multi-device logout independent, `/me` works, logout persists. |
| 5 | Orders correctness: single-order PATCH keeps `cancelReason` + restocks (G7), server-side transition graph (G10) | backend (+ mobile simplification) | **Done** (backend PR #4, mobile PR #3). 48/48 backend tests pass (12 new). Logout white-flash bug fixed in the same mobile PR. Verified on device: logout lands cleanly on login screen. |
| 6 | Server-side analytics endpoint (G8) and consistent error shape (G12) | backend + mobile | **G8 Done** (backend PR #5, mobile PR #4). Verified on device against Supabase: totals match SQL. **G12 deferred** (backend-internal refactor, no user-visible impact). |
| 7 | Web portal fixes: stop calling `/api/auth/verify`, real notification bell | web `med-version` | Not started |
| 8 | Unit tests for mobile pure logic (hours formatting, GPS combine, schemas) | mobile | Not started |
| 9 | End-to-end device testing (dev build against staging backend; manager + staff accounts) | all | Partially done: auth + push + orders verified. Remaining: POS, inventory, analytics, staff CRUD, register with GPS, bank setup (manager). |
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
- **Deployed.** Production DB has `PushToken`; mobile registers/unregisters; sender fires on paid orders. Status-change pushes remain a follow-up.

### 4–8
See `mobile/PLAN.md` §4 rows G1, G2, G7, G8, G10, G11, G12 for the exact endpoint shapes already agreed.
- **Task 4 deployed.** `PharmacyRefreshToken` table exists in production. `POST /api/auth/refresh`, `/logout`, `GET /api/auth/me` live. Access tokens remain at 1 day so the web portal is unaffected. `/me` returns pharmacy `status`, `isActive`, `logoUrl`. Verified on device.
- **Task 5 deployed.** Server-side transition graph (`ALLOWED_TRANSITIONS` in `pharmacy-orders.service.js`) and `assertValidTransition()` are enforced in single AND bulk updates. Single PATCH accepts `cancelReason`, restocks unpaid cancels, returns 409 `STATUS_UNCHANGED` on same-status, 404 `ORDER_NOT_FOUND` on missing. Mobile preserves `INVALID_STATUS_TRANSITION` and `STATUS_UNCHANGED` codes through the bulk path. Verified on device: logout lands cleanly on login screen (routing fix bundled with this PR).

### 9. Device testing
Needs: `npx eas-cli@latest init` (sets `EAS_PROJECT_ID`), EAS env vars `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_API_KEY`. Then `eas build --profile development`. Cover login/PIN, orders (all transitions + cancel), POS sale, inventory, analytics, payment/bank (manager), profile/hours/logo/location, staff CRUD, register with GPS.

**Done:** login/PIN, orders transitions + cancel, `/me`, refresh tokens, multi-device logout, push delivery, deep link to order.
**Remaining:** POS, inventory, analytics, payment/bank (manager), profile/hours/logo/location, staff CRUD, register with GPS.

### Housekeeping (owner, any time; none blocks the tasks above)
- ~~Render: turn **off** `SENTRY_DEBUG`~~ ✅ Done 2026-11-10.
- ~~Backend: `app.set('trust proxy', 1)` in `src/app.js`~~ ✅ Done 2026-11-10 (fixes all-users-share-one-rate-limit-bucket bug behind Render's proxy).
- Make `wellrica01/manzu-backend` and `wellrica01/manzu-frontend` **private** (they were public on 2026-11-06), then check that Render and Vercel still have access.
- Frontend: remove the tracked `manzu-frontend/.env.local` (`git rm --cached .env.local`, add to `.gitignore`), and rotate any real key that ever sat in it.
- Backend: `npm audit` reports 36 vulnerabilities in production dependencies (1 critical). Handle in its own PR; do **not** run `npm audit fix --force`.
- Still open from the audit (`OPEN_QUESTIONS.md`): public `POST /api/auth/admin/register` (S1), phone-based guest takeover (S2), prescription IDOR (S3), public prescription image URLs (S4), CORS allowing origin-less requests (S7). Plan these as separate security tasks.
- Backend `main` is 9 commits ahead of and 76 behind `med-version`; reconcile in Task 10.
- **Rotate the Firebase admin service account key**: it was uploaded to EAS but is currently untracked-and-ignored in the repo. Rotate it in Firebase Console → Project Settings → Service Accounts → generate new key, re-upload to EAS, delete the old key. Optional but recommended.
- **`Order.paymentReference` format CHECK constraint**: to prevent a repeat of the checkout bug (see log for 2026-11-10), add a Postgres CHECK constraint that `paymentReference` starts with `order_` or is `NULL`. Prevents future regressions from manually writing `session_*` values.

## Log
- 2026-11-05: M7 → PR #1, M8 → PR #2. This doc written; task 1 started.
- 2026-11-05: Task 1 → [backend PR #1](https://github.com/utmemastery/manzu-backend/pull/1) (not merged; middleware/schema checks run in Node, server not run against a DB). Next: merge + deploy it, then task 2.
- 2026-11-05: Task 2 → mobile PRs #3–#8 opened for M1–M6; CI workflow added to M8 branch. Next: owner approves merging the chain, then task 3.
- 2026-11-06: Repos moved to the owner's account `wellrica01`: mobile `main` pushed to `wellrica01/manzu-mobile`; backend `med-version` fast-forwarded from the archive (`37d257a` → `9ccba44`) plus commit `4177ab0` (remove unused `paystack-api`, 44 packages dropped); frontend unchanged. `utmemastery/*` is now archive-only.
- 2026-11-06: Task 1 deployed to Render (`4177ab0`). Smoke tests on `https://manzu-backend.onrender.com`: `/health` healthy with DB connected; pharmacy token on `/api/admin/dashboard` → 403; `POST /api/pharmacy/change-password` → 410; pharmacy token on `/api/pharmacy/profile` → 200. Still to confirm in the browser: pharmacy portal login and admin console login/dashboard.
- 2026-11-06: Task 2 complete → merged mobile PRs #7, #8, #1, and #2 after #3–#6; all M1–M8 changes are on `main`. Post-merge typecheck + lint workflow passed. Next: continue with Task 3 (real push, G4).
- 2026-11-06: Task 3 in progress → `PushToken` SQL run on local + Supabase; backend branch `feat/push-tokens-g4` verified end to end locally (register + delete, 9/9 unit tests). Mobile branch `feat/push-tokens-g4` switches to the new endpoints and unregisters on logout. Order: merge backend PR → confirm deploy → merge mobile PR → build → set `EXPO_PUBLIC_PUSH_ENABLED=true`. Follow-ups: push on order status changes (needs actor-aware dedupe), Expo receipt check, low-stock and payout pushes.
- 2026-11-10: Task 3 complete → backend PR wellrica01/manzu-backend#1 merged, mobile PR wellrica01/manzu-mobile#1 merged. `PushToken` table on local + Supabase. Both phones registered tokens and received live pushes for real paid orders; tapping opened order detail. Env: `EXPO_PUBLIC_PUSH_ENABLED=true` for `preview`/`development`; FCM V1 service account bound to EAS project `0cf648d0-50ba-45e7-862f-ce14bcca4f1c`. Follow-ups filed: status-change pushes, Expo receipt check, low-stock/payout pushes.
- 2026-11-10: **Bug fixed (pre-existing, not caused by Task 3):** confirmation callback failed with "Orders not found" on legitimate paid orders. Two root causes: (1) `confirmOrder` filtered by request `userIdentifier` (`x-guest-id`) which could differ from the value stored at checkout; (2) `Order.paymentReference` sometimes used `session_*` format while `TransactionReference.orderReferences` used `order_*`. Fixed in backend PR wellrica01/manzu-backend#2 (Copilot): reference-based confirmation now requires `checkoutSessionId` match and queries orders by `checkoutSessionId`; session-only confirmation stays guest-ID scoped. Verified on production with a real checkout.
- 2026-11-10: **Bug fixed (regression):** mobile `main` was missing `src/app/index.tsx` (routing), `extraProguardRules` ProGuard config (R8 crash on launch), and `google-services.json` (FCM). Root cause: 5 commits pushed to `feat/push-tokens-g4` **after** PR #1 merged never reached `main` — the branch was deleted locally but the remote still had them. Fixed by merging `origin/feat/push-tokens-g4` into `main` (commit `4d1082e`). **Lesson: after merging a PR, do not push more commits to the same branch.** Open a fresh one instead.
- 2026-11-10: Task 4 complete → backend PR wellrica01/manzu-backend#3 merged (rotating refresh tokens, `/auth/refresh`, `/auth/logout`, `/auth/me`, pharmacy status at login), mobile PR wellrica01/manzu-mobile#2 merged (SecureStore refresh token, single-flight refresh, 401 retry with one refresh, `/me` on launch, D5 dropped). Verified on 2 Android devices: login persists across force-close, logout revokes only the calling device's chain, push still works after the auth rewrite.
- 2026-11-10: Task 5 complete → backend PR wellrica01/manzu-backend#4 merged (server-side transition graph, `cancelReason` accepted on single PATCH, unpaid cancels restock, 409 on same-status, 404 on missing). Mobile PR wellrica01/manzu-mobile#3 merged (logout routes to login via `+not-found` instead of `index.tsx` redirect — fixes white-flash loop; order transition error codes preserved through the bulk path). 48/48 backend tests pass (12 new).
- 2026-11-10: **Bugs fixed during Task 4/5 verification:** (a) logout white-flash loop — `src/app/index.tsx` re-rendered `<Redirect>` on every session-state change during `signOut()`, racing `Stack.Protected`. Replaced with `+not-found.tsx` fallback (fires once, redirects, stops). (b) `app.set('trust proxy', 1)` added to `src/app.js` — rate limiting now sees real client IPs behind Render's proxy (previously all users shared one login bucket; 5 failed PINs locked everyone out). (c) `SENTRY_DEBUG` removed from Render env vars.
- 2026-11-10: **Deploy fix:** `postinstall: prisma generate` added to backend `package.json`. Root cause of an earlier stale-Prisma-Client bug on Render (endpoints returning `Cannot read properties of undefined (reading 'upsert')`) — `npm install` alone never regenerated the client after `schema.prisma` changes. Now regenerated on every deploy.
- 2026-11-10: Task 6 G8 done → backend PR wellrica01/manzu-backend#5 (new `GET /api/pharmacy/analytics?from&to` with server-side aggregation, 4 new tests) + mobile PR wellrica01/manzu-mobile#4 (Analytics screen now uses the endpoint; removed client-side reduce over 100 paginated orders). Verified on device against Supabase: 30-day totals match a raw `SELECT SUM` on the `Order` table. The "Based on your 100 most recent orders" truncation notice is gone.
- 2026-11-10: **Task 6 G12 (consistent error shape) deferred.** The mobile client already normalizes all error shapes; the backend still sends 5 different shapes (`{error}`, `{message}`, `{errors: [...]}`, `{message, error}`, `{message, stack}`). Standardizing needs middleware touching 30+ route files — no user-visible benefit while only the mobile + web clients exist, both of which normalize. Revisit if a third client or a public API emerges.
