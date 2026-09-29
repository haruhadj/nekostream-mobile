# NekoStream Mobile

Standalone React Native client for AniList, MyAnimeList, and Nyaa. The app
stores its library, Nyaa filters, and discovered episodes on the device. It
builds and runs independently from the NekoStream server repository.

## Development and release

See [Running the mobile app](mobile-runbook.md) for prerequisites, the debug
build + Metro workflow, release APK signing, and device troubleshooting.

```bash
npm ci
npm run typecheck
npm run lint
npm run android
```

Expo Go cannot run this app: it requires a custom native binary for the
`nekostream://` OAuth callbacks and native SQLite/SecureStore modules.

## Project layout

- `src/` — application UI, on-device database, authentication, and sync.
- `shared/lib/` — portable domain modules copied from the server project and
  used through the `@shared/*` alias. These are vendored source files, not a
  runtime or build-time dependency on the server checkout.
- `drizzle/` — generated SQLite migrations shipped in the app bundle.

The source of the vendored modules is the server repository's `src/lib/`.
When changing one side, review the corresponding module in the other project
and keep intentional differences documented.
