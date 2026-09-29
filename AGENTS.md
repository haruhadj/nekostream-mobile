# NekoStream Mobile

Read `README.md` before running, building, or installing this app. This is a
standalone Expo repository; it does not depend on a checkout of the server
repository.

Portable domain modules used by the app live in `shared/lib/`. They were
copied from the server repository when this project was separated. Keep the
copies aligned when changing shared behavior, and keep the standalone module
set free of imports from the server's app, server, database, or environment
configuration.

Expo SDK 57 has breaking changes. Read the versioned Expo 57 documentation
before changing Expo APIs. Use `npm run db:generate` for schema changes; never
hand-edit generated files under `drizzle/`.
