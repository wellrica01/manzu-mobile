# Manzu Pharmacy Portal — Mobile App Plan

Status: **Approved.** Build one milestone at a time on "go milestone N".

Sources read: `docs/` (03, 04, 05, 08, 02, OPEN_QUESTIONS) and the real code on branch `med-version`: frontend `5c07e7e` (`app/pharmacy/**`, `components/ui/*`, `app/globals.css`, `tailwind.config.js`), backend `37d257a` (`src/routes/pharmacy.js`, `src/routes/auth.js`, `src/middleware/auth.js`, `src/domains/pharmacy/**`, `src/domains/auth/pharmacy/*`, `src/utils/validation.js`, `src/utils/adminValidation.js`, `prisma/schema.prisma`).
Note: `main` on both repos does **not** contain the portal (`app/pharmacy/(dashboard)` and `src/routes/pharmacy.js` only exist on `med-version`). The mobile app targets `med-version`.

Where the docs and the code disagree, this plan follows the code:
- `fetchOrders` also leaves out **CANCELLED** unless you filter by `status=CANCELLED` (`pharmacy-orders.service.js` `baseWhere`). The docs say only CART/PENDING/PENDING_PRESCRIPTION are left out.
- `PATCH /api/pharmacy/orders/:id` **ignores `cancelReason`**. Joi only allows `{orderId,status}`, and the service hard-codes `"Pharmacy rejected order"`. The web dialog sends a reason anyway.
- `PATCH /api/auth/users/:id` **ignores `role`**. The route only passes `{name,email,pin}` to the service, even though `editUserSchema` accepts `role`.

---

## 1. Stack decision

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Expo (managed), latest stable SDK at scaffold time, TypeScript strict** | As requested |
| Navigation | **Expo Router** (file-based) | `(auth)` stack plus `(app)` tabs |
| Server state | **@tanstack/react-query v5** | Same library as the web (`app/layout.js`) |
| Client state | **Zustand** | Session (token, user, pharmacy, role), POS cart, UI prefs |
| Token storage | **expo-secure-store** | Replaces `localStorage.pharmacyToken` |
| Barcode | **expo-camera** (`CameraView` barcode scanning) | Behind a feature flag until the backend can look up barcodes (§4, G5) |
| Push | **expo-notifications** | Behind a feature flag until push is sent server-side (§4, G4) |
| Forms | react-hook-form + zod | Same as the web. Client schemas copy the backend Joi/Zod rules |
| Offline read cache | `@tanstack/query-async-storage-persister` + AsyncStorage + `@react-native-community/netinfo` | Read-only. **Mutations are never queued** |
| Icons | `lucide-react-native` + `react-native-svg` | The web uses `lucide-react` |
| Font | `@expo-google-fonts/inter` (300–800) | The web loads Inter from `globals.css` |
| Gradients | `expo-linear-gradient` | Brand gradients (§3) |
| Charts | `react-native-gifted-charts` (SVG, works in Expo Go) | The web uses `react-chartjs-2` on Analytics |
| Map | `react-native-maps` | Replaces Leaflet on Profile → Location |
| Location | `expo-location` | Register GPS capture (replaces `usePharmacyGPSCapture`) |
| Images | `expo-image-picker` | Logo upload (multipart `logo`) |
| CSV export | `expo-file-system` + `expo-sharing` | Downloads `/sales/export` with the Bearer header, then opens the share sheet |
| Toasts | `react-native-toast-message`, styled like the web Sonner toaster | |
| Styling | `StyleSheet` + typed theme tokens (`src/theme`) | Small, explicit, no extra build steps |
| Lint / types | ESLint (`eslint-config-expo`) + `tsc --noEmit` | Run before every milestone report |

**Deviations:** none from the requested stack. Everything else in the table is an addition, used only where the web feature needs a native equivalent. I chose not to use NativeWind: the web runs on Tailwind v4 with `@theme inline` oklch tokens, and NativeWind doesn't fully support that. Plain tokens make it easier to reproduce the colours exactly.

### Folder layout (feature-based)
```
mobile/
  app/                         # Expo Router routes only (thin)
    (auth)/login.tsx  register.tsx
    (app)/(tabs)/dashboard.tsx orders/index.tsx pos/index.tsx inventory/index.tsx more.tsx
    (app)/orders/[id].tsx  inventory/[medicationId].tsx  inventory/add.tsx  sales-history.tsx
    (app)/analytics.tsx  payment.tsx  profile.tsx  staff.tsx  scanner.tsx
  src/
    api/        client.ts (fetch + Bearer + error normalisation), endpoints.ts, queryClient.ts, persist.ts
    theme/      colors.ts typography.ts spacing.ts radius.ts shadows.ts
    components/ Button Card Badge Input Select Sheet Dialog StatusBadge EmptyState ErrorState OfflineBanner Skeleton StatCard
    features/
      auth/       api.ts types.ts store.ts hooks.ts screens/
      dashboard/  orders/  inventory/  pos/  sales/  analytics/  payouts/  profile/  staff/  push/
    lib/        format.ts (₦, dates), jwt.ts (decode exp only), roles.ts (isManager), netinfo.ts
```

---

## 2. Screen-by-screen mapping

Navigation: the web sidebar (`SidebarNav.jsx`) becomes a **bottom tab bar** with Dashboard · Orders · POS · Inventory · More. "More" lists Sales History, Analytics, Payment, Profile, Staff (manager only) and Logout. The web Topbar bell uses hard-coded fake notifications, so I'll leave it out until push exists.

Every screen has loading (skeletons), empty, error (retry) and offline states. Offline shows the cached data read-only, with an "Offline — last updated hh:mm" banner. **All mutating buttons are disabled when offline.**

Manager gating: `isManager = user.role === 'MANAGER'`, using the role from the login response or from `GET /api/pharmacy/profile` → `user.role`. The web shows these controls to everyone and relies on 403s. Mobile **hides** them.

| Web page (file) | Mobile screen | Endpoints (exact) | What changes for mobile |
|---|---|---|---|
| `(auth)/login/page.jsx` | `(auth)/login` | POST `/api/auth/login {email, pin}` → `{message, token, user{id,email,name,role}, pharmacy{id,name}}` | 6-digit numeric PIN pad. Token goes to SecureStore. On launch: decode `exp` locally, then GET `/api/pharmacy/profile` to validate the session (instead of the missing `/api/auth/verify`). 401 `NO_TOKEN/INVALID_FORMAT/TOKEN_EXPIRED/INVALID_TOKEN` → clear session → login with a message. Shows 429 `AUTH_RATE_LIMIT_EXCEEDED` with `retryAfter` |
| `(auth)/register/page.jsx` + `PharmacyGPSCaptureUI.jsx` | `(auth)/register` (multi-step) | POST `/api/auth/register {pharmacy{name,licenseNumber,phone,address,state,lga,ward?,latitude,longitude,locationAccuracy?,pharmacyType?,operatingHours?,deliveryAvailability?}, user{name,email,pin}}` | expo-location high-accuracy capture with the same low-accuracy "Continue Anyway" flow. State/LGA from the same geo data as the web (`public/data`). Client validation copied from `registerSchema`: phone `^(\+234\|0)[789]\d{9}$`, address 10–500, lat 4–14, lng 3–15, PIN 6 digits |
| `(dashboard)/dashboard/page.jsx` + `PayoutSummaryWidget.jsx` | Tab **Dashboard** | GET `/api/pharmacy/dashboard` → `{ordersToday, ordersTrend, posSalesToday, posSalesTrend, revenueToday, revenueTrend, posRevenueToday, posRevenueTrend, pendingOrders(=CONFIRMED), processingOrders, readyOrders, completedOrders, inventoryAlerts, expiringMeds, topSellingMeds[{name,quantity,revenue,orders}], recentActivity[{id,type:'ORDER'\|'SALE',name,status,amount,time}], lowStockMeds[{name,form,stock,price}]}`; GET `/api/pharmacy/payouts/summary` → `{pending{amount,count}, processing{…}, completed{…}, failed{…}, bankingConfigured}` | Vertical stack of stat cards, pull-to-refresh. Quick actions go to POS and Orders. A pharmacy status banner (from profile) appears when not VERIFIED |
| `(dashboard)/orders/page.jsx` | Tab **Orders** (list) | GET `/api/pharmacy/orders?page&limit(≤100, web 20)&search&status&date(YYYY-MM-DD)&deliveryMethod(PICKUP\|COURIER)` → `{orders[{id,sn,name,phone,email,createdAt,trackingCode,userIdentifier,deliveryMethod,address,status,totalPrice,pharmacyAmount,prescription,items[]}], pagination{page,limit,total,pages}}`; PATCH `/api/pharmacy/orders/bulk {orderIds(≤50), status, cancelReason (required if CANCELLED)}` → `{message, results{successful[],failed[{orderId,reason}]}}` | Infinite list (`useInfiniteQuery`), filter sheet (status, delivery, date), search. Long-press selects orders for bulk actions, using the same 6 actions as the web. CONFIRMED is shown as "Pending", like the web. Per-order failures from `results.failed` are listed |
| `orders/components/OrderDetailsDialog.jsx` | `orders/[id]` (full screen) | GET `/api/pharmacy/orders/:orderId`; PATCH `/api/pharmacy/orders/:orderId {status}` | Status actions filtered by delivery method exactly like `STATUS_OPTIONS` (PROCESSING both; SHIPPED/DELIVERED courier; READY_FOR_PICKUP pickup; COMPLETED/CANCELLED both). Cancel needs a reason (see decision D2). Tap to call or WhatsApp the customer phone. Prescription image viewer |
| `(dashboard)/inventory/page.jsx` | Tab **Inventory** | GET `/api/pharmacy/medications/catalog?page&limit&search&status(all\|stocked\|not_stocked\|low_stock\|out_of_stock\|expiring_soon)&prescriptionRequired` → `{medications[{medicationId,brandName,form,packSizeExpression,packSizeUnit,regulatoryClass,prescriptionRequired,ingredients,activeSubstances,displayName,manufacturer,manufacturerName,isStocked,pharmacyId,stock,price,expiryDate,receivedDate,batchNumber}], pagination, summary{totalItems,lowStockCount,outOfStockCount,expiringSoonCount,totalValue,catalogSize,stockedCount,…}}`; DELETE `/api/pharmacy/medications/:id` | Card rows instead of a table. Status chips match the backend thresholds: low = 0<stock<10, out = 0, expiring ≤ 30 days. Summary cards on top. Swipe to edit or delete (delete asks for confirmation) |
| `inventory/components/InventoryForm.jsx` | `inventory/add`, `inventory/[medicationId]` | GET `/api/medication-suggestions?q=`; POST `/api/pharmacy/medications {medicationId, stock>0, price>0, batchNumber (req), receivedDate?, expiryDate?}`; PATCH `/api/pharmacy/medications/:id {stock≥0, price≥0, receivedDate?, expiryDate?, batchNumber?}` | Native date pickers. Warns when stock < 10 (same as the web). 403 "cannot stock this medication" is shown inline. A "Scan" button appears only when the barcode flag is on (G5) |
| `pos/new-sale/page.jsx` | Tab **POS** | Inventory picker uses `pharmacyMedicationsAPI` → GET `/api/pharmacy/medications` (stocked); POST `/api/pharmacy/sales {items[{medicationId, quantity, price, name}], total, paymentMethod:'CASH'\|'CARD'}` → `201 {message, sale}` | Search, add to cart, quantity capped at stock, CASH/CARD toggle, receipt sheet (the web shows a receipt modal). **Online-only.** The cart lives in Zustand, but checkout is never queued. Scan to add appears only with flag G5. |
| `pos/sales-history/page.jsx` | More → **Sales History** | GET `/api/pharmacy/sales?date\|startDate&endDate&paymentMethod&minAmount&maxAmount&page&limit` → `{sales[{id,pharmacyId,items(JSON),total,paymentMethod,createdAt}], pagination{page,limit,total,pages}, stats{totalRevenue,cashSales,cardSales}}`; GET `/api/pharmacy/sales/export` (CSV) | The sale detail sheet uses the row already loaded in the list. **`/sales/:saleId` is never called** (no route). Export is saved to a file and opened in the share sheet |
| `(dashboard)/analytics/page.jsx` | More → **Analytics** | GET `/api/pharmacy/orders?…` and GET `/api/pharmacy/medications` (computed on the device, like the web) | Ranges 7d/30d/90d/all/custom. Revenue and units charts computed on the device exactly as the web does. Low stock = 0<stock<10. Same truncation limits as the web (see G8) |
| `(dashboard)/payment/page.jsx` | More → **Payment** (tabs: Earnings · Payouts · Bank) | GET `/banking/status` → `{hasSetup, bankName, accountNumber(masked), accountName}`; GET `/banking/banks` → `{banks}`; POST `/banking/verify {accountNumber, bankCode}` (MANAGER); POST `/banking/setup` / PUT `/banking/update {accountNumber, bankCode, bankName}` (MANAGER); GET `/payouts/summary`; GET `/payouts/history?page&limit` → `{payouts, pagination{page,limit,total,totalPages}}`; GET `/orders/pending-payout` → `{orders, summary{totalOrders,totalAmount}}`; GET `/earnings/analytics?period=week\|month\|year` → `{period,totalEarnings,totalPaid,pendingPayout,orderCount,payoutCount}` | Bank setup/update/verify **hidden for non-managers** (read-only status card instead). Shows the 8% commission and the daily 23:00 payout note, like the web |
| `(dashboard)/profile/page.jsx` | More → **Profile** (sections: General, Location, Hours, Security) | GET `/api/pharmacy/profile` → `{user{id,name,email,role,lastLogin}, pharmacy{id,name,address,lga,state,ward,phone,licenseNumber,status,logoUrl,latitude,longitude,deliveryAvailability,pharmacyType,isActive,createdAt,verifiedAt,OperatingHour[]}}`; PATCH `/api/pharmacy/profile` (MANAGER, `editProfileSchema`); GET `/api/pharmacy/operating-hours` → `{operatingHours[{dayOfWeek,openTime,closeTime}]}`; POST `/api/pharmacy/operating-hours {hours[{dayOfWeek,openTime,closeTime,isClosed}]}` (MANAGER); POST `/api/pharmacy/profile/logo` multipart `logo` ≤5 MB (MANAGER); PATCH `/api/auth/change-password {currentPin,newPin}` | Edit, hours and logo **hidden for non-managers**. Change PIN is available to all, through **`PATCH /api/auth/change-password` only (never `POST /api/pharmacy/change-password`)**. Status badges: VERIFIED/PENDING/REJECTED like the web, plus SUSPENDED/CLOSED (the enum values exist; the web just doesn't render them). Days with no row in GET hours are shown as closed |
| — (no web page) | More → **Staff** (MANAGER only) | GET `/api/pharmacy/users` → `{message, users[{id,name,email,role}]}`; POST `/api/auth/add-user {name,email,pin,role}`; PATCH `/api/auth/users/:userId {name,email,pin?}`; DELETE `/api/auth/users/:userId` | New for mobile. The endpoints exist but the web never calls them. Role is not editable after creation (the backend ignores it, G9). The manager can't edit or delete themselves (backend 403). Role choices depend on decision D3 |
| — | `scanner` (modal) | none until G5 | Hidden behind a flag |

---

## 3. Design system (taken from the web)

**Brand & semantic colours.** Hex values are from the counts in the pharmacy pages. oklch values are from `globals.css` and are converted to hex exactly at M1 (the values below are approximations).

| Token | Value | Web usage |
|---|---|---|
| `primary` | `#1ABA7F` | 132 uses: buttons, active nav, spinners, focus ring |
| `primaryDark` | `#159E6A` | hover/pressed |
| `brandBlue` | `#225F91` | 77 uses: headings, active nav text, logout |
| `brandBlueDark` | `#1A4971` | logout gradient end |
| `gradientBrand` | `#1ABA7F → #225F91` | logo tile, avatar, title text |
| `gradientLogout` | `#225F91 → #1A4971` | logout button |
| `appBg` | gray-50 `#F9FAFB` → gray-100 `#F3F4F6` (vertical) | dashboard layout background |
| `card` | `#FFFFFF`, border gray-200 `#E5E7EB` (60% alpha) | cards |
| `text` | gray-900 `#111827` / 700 `#374151` / 600 `#4B5563` / 500 `#6B7280` | headings / body / secondary / muted |
| `success` | `#10B981` (text green-600 `#16A34A`, bg green-100 `#DCFCE7`, green-800 `#166534`) | DELIVERED/COMPLETED |
| `danger` | `#EF4444` (red-600 `#DC2626`) | CANCELLED, errors |
| `warning` | `#F59E0B`, orange-600 `#EA580C` | low stock / expiring |
| `info` | `#3B82F6` (blue-600 `#2563EB`) | PROCESSING |
| `cyan` | `#06B6D4` | SHIPPED |
| `violet` | `#8B5CF6` | READY_FOR_PICKUP |
| shadcn tokens | background ≈`#F7F9FB` (oklch .98 .005 240), foreground ≈`#0F172A` (oklch .15 .05 260), border ≈`#E2E8F0` (oklch .92 .01 255), muted-fg ≈`#64748B` (oklch .55 .05 255), secondary/gold ≈`#D9A066` (oklch .75 .1 50), destructive ≈`#E5322D` (oklch .6 .25 25) | `components/ui/*` |

Order status palette: exactly `STATUS_OPTIONS` in `OrderDetailsDialog.jsx` (above), with CONFIRMED displayed as "Pending".

**Typography:** Inter 400/500/600/700/800. Sizes follow the Tailwind scale used on the pages: xs 12, sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30. Page titles are `text-2xl/3xl font-bold text-gray-900`. Card titles are `font-semibold`.
**Spacing:** 4-pt Tailwind scale. Screen padding 16 (`p-4` on mobile web). Card padding 24 (`py-6 px-6`), compact cards 16. Stack gaps 12/16/24.
**Radius:** `--radius` = 12. sm 8, md 10, lg 12 (most used, 271×), xl 16, 2xl 16, full for avatars and chips.
**Shadows:** sm (cards), md (hover/selected), lg (sheets, sidebar), as iOS shadow + Android elevation 1/3/6.
**Icons:** lucide, same glyphs as the web: Home, CreditCard, Package, ClipboardList, BarChart2, User, LogOut, Pill, Truck, CheckCircle, XCircle, Bell, Loader2.
**Components:** Button (default/destructive/outline/secondary/ghost/link). Web heights are 32/36/40; mobile uses a minimum of 44 (the web's own mobile rule in `globals.css`). Card (white, rounded 12, border, shadow-sm). Badge (rounded 8, xs medium). Input (rounded 10, border, focus ring primary at 30%). Select becomes a bottom sheet. Dialog becomes a modal sheet. Toast is white at 95%, rounded 16, padding 20, soft shadow (from the web `Toaster` style). Spinner is `Loader2` in primary.

---

## 4. Backend gaps for mobile (NOT changing the backend; for approval)

| # | Gap | Exactly what to add | Where | Needed by |
|---|---|---|---|---|
| G1 | No session check / "me" (`/api/auth/verify` called by the web, no route) | `GET /api/auth/me` → `{user{id,name,email,role}, pharmacy{id,name,status,isActive}}` | `src/routes/auth.js` + `pharmacy-auth.service.js` | M1 (workaround: GET `/api/pharmacy/profile`) |
| G2 | No refresh tokens / logout / revocation; JWT is 1 day | `POST /api/auth/refresh {refreshToken}` → `{token, refreshToken}` (rotating); `POST /api/auth/logout {refreshToken}`; new model `PharmacyRefreshToken{id,userId,tokenHash,expiresAt,revokedAt,deviceInfo}`; login returns `refreshToken` | `routes/auth.js`, `domains/auth/pharmacy/*`, `prisma/schema.prisma` | M1 (until then: re-login once a day) |
| G3 | Bearer auth | **Already supported** (`middleware/auth.js`). Requests with no Origin header pass CORS. No change | — | — |
| G4 | Push: `POST /api/pharmacy/notifications/register` saves **one** `Pharmacy.devicetoken` (each new device overwrites it; not tied to a user; no unregister), and **nothing sends pushes** | Model `PushToken{id,userId,pharmacyId,token @unique,platform,createdAt,lastSeenAt}`; `POST /api/pharmacy/push-tokens {token,platform}`, `DELETE /api/pharmacy/push-tokens/:token`; a sender using the Expo Push API, triggered when an order becomes CONFIRMED (`services/confirmationService.js`, `routes/confirmation.js` charge.success), on low stock after a sale or checkout, and on payout status changes | `routes/pharmacy.js`, new `domains/pharmacy/push/*`, `utils/notifications.js`, schema | M8 |
| G5 | Barcode lookup: `Medication` has **no barcode/GTIN field**. `nafdacCode` is a registration number, not a scannable GTIN | `Medication.barcode String? @unique` (+ admin edit field) and `GET /api/pharmacy/medications/barcode/:code` → same item shape as `/medications/catalog` with this pharmacy's stock | schema, `domains/pharmacy/medications/*`, `routes/pharmacy.js`, admin medication form | M4/M5 scan (flagged off until then) |
| G6 | Sale detail `GET /api/pharmacy/sales/:saleId` missing | Optional. Mobile uses the list row | `routes/pharmacy.js` | — (not needed) |
| G7 | Single-order PATCH drops `cancelReason` and **doesn't restock unpaid cancels**, while bulk does both (OQ C3) | Accept `cancelReason` in `validateUpdateOrder`; same restock rules as bulk | `utils/validation.js`, `pharmacy-orders.service.js` | M3 (see D2) |
| G8 | Analytics is computed on the device from paginated `/orders` (max 100 per page) and gets truncated | `GET /api/pharmacy/analytics?from&to` with server-side totals (or extend `/analytics/weekly`) | `pharmacy-dashboard.service.js` | M6 (optional; mobile matches the web first) |
| G9 | Staff: `PATCH /auth/users/:id` ignores `role`; `add-user` accepts any role including MANAGER/OWNER/ADMIN (OQ C9) | Pass `role` through; restrict allowed roles | `routes/auth.js`, `adminValidation.js` | M7 |
| G10 | No server-side order transition graph (OQ C4) | Enforce the graph in `pharmacy-orders.service.js` | backend | M3 (mobile enforces the web UI graph meanwhile) |
| G11 | Pharmacy status not checked at login (OQ C8) | Return `pharmacy.status` in the login response (or block) | `pharmacy-auth.service.js loginUser` | M1 |
| G12 | Inconsistent error shapes | Standard `{error, message, details?}` | backend-wide | M1 (client normalises meanwhile) |
| G13 | `Authorization` headers logged to stdout (OQ S6) | Remove the debug header logger | `src/app.js` 159–162 | Security, before rollout |
| G14 | Token type not checked: an admin JWT reaches pharmacy routes (OQ S9) | Require `pharmacyId` claim / `typ:'pharmacy'` | `middleware/auth.js` | Security |

Mobile will **never call** `/api/pharmacy/change-password`, `/api/auth/verify` or `/api/pharmacy/sales/:id`. An ESLint `no-restricted-syntax` rule will fail the build if these strings appear.

---

## 5. Build order (milestones)

Each milestone: read the web page and backend route/service first, write TS types from the real shapes, build, `tsc --noEmit` + `eslint` clean, then report what was built, assumptions and how to test (Expo Go QR / `npx expo start`).

1. **Setup + design system + API client + auth.** Expo app, Router skeleton (auth stack, tabs, More), theme tokens + base components, `api/client.ts` (Bearer, error normalisation, 401 → logout, 429 handling, timeout), React Query + persister + NetInfo offline banner, Zustand session, SecureStore. Login screen. Session restore through `/api/pharmacy/profile`. Role helper. Restricted-endpoint lint rule. `EXPO_PUBLIC_API_URL` config.
2. **Dashboard:** stats, trends, recent activity, low stock, payout widget, status banner, quick actions.
3. **Orders:** list, filters, search, infinite scroll, details, single status change (web graph), bulk actions with results, cancel reason (D2).
4. **Inventory:** catalogue with filters and summary, add (suggestions picker), edit, delete, 403 handling. Scanner UI behind flag G5.
5. **POS:** new sale (online-only), receipt; Sales History with filters, stats, CSV export/share.
6. **Analytics + Payouts:** analytics ranges and charts (computed on device like the web); Payment tabs (earnings by period, summary, history, pending-payout orders, bank status; manager-only setup/update/verify).
7. **Profile + Staff + Register:** profile sections, manager-only edit/hours/logo/map, change PIN; Staff CRUD (manager); Register with GPS. Maps use `react-native-maps` (works in Expo Go; Android standalone builds need a Google Maps API key via the plugin config in M8). Staff role is fixed after creation until G9.
8. **Push, offline, polish:** expo-notifications permission + token (needs G4 or approval to use the existing single-token endpoint), deep link from a notification to an order, offline cache audit (TTL, purge on logout), accessibility, haptics, app icon/splash in brand colours, EAS build profiles. Built: push behind `EXPO_PUBLIC_PUSH_ENABLED`; token registered once per signed-in user per launch; the payload contract for a future G4 sender is `data: { orderId }` (opens `/orders/[id]`, received pushes refresh orders/dashboard). Staff and banking-status queries are no longer persisted offline, and the cache is purged on logout and on a signed-out launch. Brand icon, adaptive icon, splash and notification icon are generated from `assets/logo.png`. `app.config.ts` injects `GOOGLE_MAPS_API_KEY` / `EAS_PROJECT_ID`.

---

## 6. `OPEN_QUESTIONS.md` classification (pharmacy mobile app)

Legend: **B** = blocking (a decision or fix is needed before that milestone ships) · **A** = affects (handle or work around in the client) · **I** = irrelevant.

| Item | Class | Milestone | Handling |
|---|---|---|---|
| A1 no migrations | I | — | — |
| A2 hosting / portal domain | A | M1 | Need the production API base URL. Native apps don't depend on the `pharmacy.manzu.ng` rewrite |
| A3 dayjs undeclared | I | — | — |
| A4 jest setup | I | — | — |
| A5 OpenCage/WhatsApp | I | — | — |
| A6 webhook HMAC over parsed body | A | M3 | Paid orders may not reach CONFIRMED, so pharmacies may not see them. Display only |
| B1 payout webhooks never handled | A | M6 | Payouts may stay PROCESSING. Show them as "Processing" without assuming completion |
| B2 refunds routes broken | I | — | The pharmacy cancel flow calls `refundService` directly |
| B3 prescription `/status` shadowed | I | — | — |
| B4 `ADMIN_undefined` | I | — | — |
| B5 cart remove | I | — | — |
| B6 payment verify | I | — | — |
| B7 `/auth/verify`, `/sales/:id` missing | A | M1, M5 | Never called. Profile is used for the session check; the list row is used for sale detail |
| B8 admin create pharmacy | I | — | — |
| B9 notification links | I | — | — |
| B10 stack in 500s | I | — | — |
| B11 `POST /pharmacy/change-password` corrupts PIN | A | M1, M7 | Never called (lint rule). Login error copy mentions the PIN |
| C1 abandoned-checkout race | A | M3 | A cancelled order can come back as CONFIRMED. The list always refetches; no assumptions |
| C2 cron restocks PENDING_PRESCRIPTION | A | M4 | Inventory can inflate. Display only |
| C3 unpaid cancel doesn't restock (single PATCH) vs bulk restocks | **B** | **M3** | Decision D2 |
| C4 no server transition graph | **B** | **M3** | Confirm mobile copies the web dialog graph exactly (D1) |
| C5 COMPLETED has no `filledAt` → earnings undercount | A | M6 | Show as the backend returns it; footnote |
| C6 webhook path sets no tracking code | A | M3 | `trackingCode` may be null; the UI handles null |
| C7 no amount check | I | — | — |
| C8 login ignores pharmacy status | **B** | **M1** | Decision D4 |
| C9 managers can create any role | **B** | **M7** | Decision D3 |
| C10 admin SUPPORT role | I | — | — |
| C11 POS decrement not transactional | A | M5 | No auto-retry after a failed sale. Refetch inventory after any error |
| C12 Zod enums narrower than Prisma | A | M4 | Map every Prisma `DosageForm`/`PackSizeUnit` value for display |
| C13 rate limits per IP, in memory | A | M1 | Carrier NAT can share IPs. Clear 429 messaging |
| C14 duplicate sanitizers | I | — | — |
| D dead/legacy code | I | — | — |
| S1 public admin register | I | — | — |
| S2 guest takeover | I | — | — |
| S3 prescription IDOR | I | — | — |
| S4 public prescription URLs | A | M3 | Prescription images are shown in order details. Don't cache them to disk |
| S5 committed `.env.local` | A | M1 | Only `EXPO_PUBLIC_API_URL` goes into the app. No Supabase keys |
| S6 auth headers logged | A | M1 | Backend fix G13 recommended before rollout |
| S7 origin-less CORS allowed | I | — | Native requests carry no Origin |
| S8 unauth validity endpoint | I | — | — |
| S9 admin token reaches pharmacy routes | A | M1 | Only tokens from `/api/auth/login` are stored. G14 |
| S10 6-digit PIN, weak lockout | A | M1 | Rate-limit messaging. Biometric unlock of the stored token later |
| S11 no refresh/revocation, 1-day JWT | **B** | **M1** | Decision D5 |
| S12 Sentry PII | I | — | — |
| S13 error message leaks | A | M1 | The client shows normalised, friendly messages |
| F1 customer OTP accounts | I | — | — |
| F2 customer order history | I | — | — |
| F3 no push sending; single device token | **B** | **M8** | G4 |
| F4 native payments | I | — | — |
| F5 customer refunds | I | — | — |
| F6 inconsistent errors | A | M1 | Client normalisation |
| F7 no API versioning | A | M1 | Pin the app to `med-version` shapes; send an `X-App-Version` header? (only if approved; no backend change) |
| F8 verify/me, sale detail, payout webhook | A | M1, M5, M6 | See B7, B1, G1 |
| F9 Expo origin in CORS; prod `ALLOWED_ORIGINS` unclear | A | M1 | Not needed for native; needs the API URL |

Blocking items by milestone: **M1** → C8, S11 · **M3** → C3, C4 · **M7** → C9 · **M8** → F3.

---

## 7. Decisions (approved)

- **D0** — the app lives in its own repo, `utmemastery/manzu-mobile`, under `mobile/`.
- **D1** — order transitions copy the web exactly: every status allowed for the delivery method is offered, whatever the current status.
- **D2** — single-order cancel uses `PATCH /api/pharmacy/orders/bulk {orderIds:[id], status:'CANCELLED', cancelReason}`, so the reason is kept and unpaid orders are restocked.
- **D3** — managers can assign PHARMACIST, STAFF and TECHNICIAN only.
- **D4** — non-VERIFIED pharmacies get the same access as on the web, plus a status banner.
- **D5** — daily re-login (1-day JWT) until refresh tokens (G2) exist. The app signs out when `exp` passes.
- **D6** — *(superseded by Task 3 / G4)* push originally used the single-token `POST /api/pharmacy/notifications/register {deviceToken}`. The app now uses `POST /api/pharmacy/push-tokens {token, platform}` (one row per device) and `DELETE /api/pharmacy/push-tokens/:token` on logout; the backend sends a push when an order is paid.
