# Manzu Pharmacy (mobile)

Expo app for the Manzu pharmacy portal. It talks to the `med-version` branch of `manzu-b`. See [PLAN.md](./PLAN.md) for scope, screen mapping, backend gaps and milestones.

## Run

```sh
cp .env.example .env       # set EXPO_PUBLIC_API_URL to the manzu-b base URL
npm install
npx expo start             # scan the QR code with Expo Go, or press a / i
```

On a phone, `EXPO_PUBLIC_API_URL` must be reachable from the device. Use your machine's LAN IP or a tunnel, not `localhost`.

## Checks

```sh
npm run typecheck
npm run lint               # also fails on forbidden endpoints (PLAN.md §4)
```

## Layout

- `src/app/` — Expo Router routes only
- `src/features/<feature>/` — api, types, hooks, screens per feature
- `src/components/ui/` — design system components
- `src/theme/` — tokens taken from the web portal
- `src/api/` — fetch client, error normalisation, React Query and the offline cache

## Builds (EAS)

`eas.json` has three profiles: `development` (dev client, internal, push flag on), `preview` (internal APK) and `production` (store, auto-incremented version).

1. `npx eas-cli@latest init` once to link an EAS project, then set `EAS_PROJECT_ID` (needed for push tokens).
2. Set build env vars in EAS: `EXPO_PUBLIC_API_URL`, and `GOOGLE_MAPS_API_KEY` for Android maps. `app.config.ts` reads them at build time.
3. `npx eas-cli@latest build --profile development --platform android` (or `preview` / `production`).

Push notifications are behind `EXPO_PUBLIC_PUSH_ENABLED=true` and don't work in Expo Go on Android (SDK 53+). Each device registers with `POST /api/pharmacy/push-tokens` and is removed with `DELETE /api/pharmacy/push-tokens/:token` on logout (G4). The backend sends a push when an order is paid; a tapped notification with `data.orderId` opens that order. Turn the flag on only after the backend with the push endpoints is deployed.
