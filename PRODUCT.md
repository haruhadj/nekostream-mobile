# NekoStream Mobile

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Anime viewers managing a watchlist and episode progress on their phone. The primary development and review device is the user's connected Android phone.

## Product Purpose

Make it easy to browse anime, manage a personal library, see upcoming broadcasts, and find episodes. The user requests a complete modern UI and UX redesign that is easy to use.

## Operating Context

Standalone Expo SDK 57 and React Native app. AniList supplies search, metadata, authentication, and library imports. MyAnimeList is an optional second tracker. The device stores the library, Nyaa filters, and discovered releases in SQLite. Magnet links open an external torrent client.

Development must provide fast visual feedback on the connected Android device. Build the design directly in code, then review it on hardware. Produce a standalone release APK after development is complete.

## Capabilities and Constraints

Preserve library filtering and sorting, progress updates, tracker editing, airing schedules, search and adding titles, Nyaa filter setup, release discovery, and account management. Preserve OAuth callback URLs and the standalone shared domain modules. The existing installed release's device data must survive development setup.

## Brand Commitments

Keep the NekoStream name. The user requests a modern anime experience with simple navigation. The existing application is dark themed; the new visual identity is open.

## Evidence on Hand

README.md, mobile-runbook.md, src/app/, src/components/, src/ui/, and a baseline capture from the connected phone. The installed library has 855 titles in the observed capture. Anime artwork comes from actual AniList records, not invented promotional data.

## Product Principles

- Make everyday anime tasks easy to find and quick to complete.
- Keep real artwork and readable anime titles central.
- Clearly distinguish watched progress, airing times, and available releases.
- Keep local saves useful when tracker sync fails.

## Open Decisions

The user has not selected one primary daily task; give library, discovery, and airing schedules equal priority until directed otherwise.
