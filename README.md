# Castaway

Castaway is a self-hosted **music streaming API**. It manages a library of
artists, albums, tracks and playlists, streams audio from S3-compatible object
storage, and serves an invite-only user base with per-device JWT sessions.

Built with [NestJS](https://nestjs.com) 11, [Prisma](https://www.prisma.io) 7,
PostgreSQL and [MinIO](https://min.io) (S3), and packaged to run entirely via
Docker Compose in both development and production.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Dev / Prod commands](#dev--prod-commands)
- [Environment variables](#environment-variables)
- [Data model](#data-model)
- [API documentation](#api-documentation)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Related projects](#related-projects)

## Features

- **Catalog** — artists, albums and tracks with many-to-many relations
  (featured artists, album/track credits) and admin-editable annotations.
- **Playlists** — user-owned and system playlist types, with ordered tracks.
- **Streaming & uploads** — audio and images stored in S3 buckets, served via
  presigned URLs; audio metadata parsed on upload with `music-metadata`.
- **Auth** — email/password with Argon2 hashing, JWT access + refresh tokens,
  per-device sessions, and an email whitelist for invite-only signup.
- **Interactions** — likes/saves and play-history style interactions across
  albums, artists and playlists.
- **Search** — query endpoints across the catalog.
- **Admin** — privileged endpoints for managing the catalog and whitelist.
- **Ops** — rate limiting (`@nestjs/throttler`), health checks
  (`@nestjs/terminus`) and Swagger API docs.

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 24 (ESM) |
| Framework | NestJS 11 |
| ORM | Prisma 7 (`@prisma/adapter-pg` driver adapter) |
| Database | PostgreSQL 16 |
| Object storage | MinIO / any S3-compatible service (AWS SDK v3) |
| Auth | `@nestjs/jwt`, Argon2 |
| Docs | Swagger (`@nestjs/swagger`) |
| Ingress (prod) | Cloudflare Tunnel (`cloudflared`) |
| Container | Docker Compose |

## Architecture

Both environments run the same set of services via Compose:

| Service | Role | Notes |
| --- | --- | --- |
| `app` | NestJS API | Port `3000` |
| `worker` | Ingest worker (same image, `node dist/src/worker/main.js`) | Consumes the album-ingest queue; internal `/health` only, no public routes |
| `db` | PostgreSQL 16 | Port `5432` (exposed in dev only) |
| `storage` | MinIO (S3) | API `9000`, console `9001` |
| `redis` | Redis 7 (BullMQ transport) | Port `6379` (exposed in dev only); `noeviction`, AOF |
| `migrate` | One-shot `prisma migrate deploy` | Runs to completion before `app` starts |
| `cloudflared` | Cloudflare Tunnel | Public ingress for prod |

On startup the `app` service waits for `db` to be healthy and for `migrate` to
finish, so pending migrations are always applied before the API comes up. In
production the app is bound to `127.0.0.1:3000` and exposed to the internet only
through the Cloudflare tunnel.

## Getting started

**Prerequisites:** Docker + Docker Compose, and `make`.

1. **Create your `.env`** at the repo root with the variables listed under
   [Environment variables](#environment-variables). Compose uses it for
   `${VAR}` substitution across all services.

2. **Start the dev stack:**

   ```bash
   make up
   ```

   This builds the images (first run) and starts `app`, `db`, `storage` and
   `cloudflared`. Migrations are applied automatically by the `migrate` service.

3. **Seed baseline data** (admin user, whitelist, sample catalog):

   ```bash
   make seed
   ```

4. The API is now at **http://localhost:3000**, with docs at
   **http://localhost:3000/docs** (dev only). Prisma Studio is available via
   `make studio` on port `5555`, and the MinIO console at
   **http://localhost:9001**.

When you change the Prisma schema, create and apply a migration with
`make migrate`.

## Dev / Prod commands

Common database and stack tasks are wrapped in the [`Makefile`](Makefile).
Run `make help` to list every target. **Bare targets act on dev**; the
**`prod-` prefix acts on production**.

### Development (`docker-compose.dev.yml`)

| Command | Does |
| --- | --- |
| `make up` | Start the dev stack (detached) |
| `make down` | Stop the dev stack |
| `make restart` | Restart the dev stack |
| `make rebuild` | Rebuild dev images from scratch (no cache) |
| `make seed` | Seed the dev database (`prisma db seed`) |
| `make migrate` | Create + apply a dev migration (interactive) |
| `make studio` | Open Prisma Studio on `:5555` |
| `make logs` | Tail dev app logs |
| `make shell` | Shell into the dev app container |

### Production (`docker-compose.prod.yml`)

| Command | Does |
| --- | --- |
| `make prod-up` | Start the prod stack (applies pending migrations on boot) |
| `make prod-down` | Stop the prod stack |
| `make prod-restart` | Restart the prod stack |
| `make prod-rebuild` | Rebuild prod images from scratch (no cache) |
| `make prod-migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `make prod-seed` | Seed the prod database (compiled seed) |
| `make prod-logs` | Tail prod app logs |
| `make prod-shell` | Shell into the prod app container |

**Notes**

- Dev and prod use different migrate/seed mechanisms: prod runs
  `migrate deploy` via the dedicated `migrate` service (the prod app image is
  built without dev dependencies, so it has no Prisma CLI), and seeds through
  `npm run seed:prod`.
- `make migrate` is interactive — it prompts for a migration name.
- Prisma Studio and Swagger docs are dev-only; prod publishes just
  `127.0.0.1:3000`.

## Environment variables

Define these in a `.env` file at the repo root. Do **not** commit it.

### Database

| Variable | Description |
| --- | --- |
| `POSTGRES_DB` | Postgres database name |
| `POSTGRES_USER` | Postgres user |
| `POSTGRES_PASSWORD` | Postgres password |
| `DATABASE_URL` | Prisma connection string, e.g. `postgresql://<user>:<pass>@db:5432/<db>` |
| `REDIS_URL` | BullMQ/Redis connection (required), e.g. `redis://redis:6379`. The app fails fast at startup if unset. |

### Auth

| Variable | Description |
| --- | --- |
| `JWT_ACCESS_SECRET` | Signing secret for access tokens |
| `JWT_ACCESS_EXPIRATION` | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL (e.g. `30d`) |

### Object storage (S3 / MinIO)

| Variable | Description |
| --- | --- |
| `STORAGE_ENDPOINT` | S3 endpoint used by the server |
| `STORAGE_PRESIGNED_ENDPOINT` | Endpoint baked into presigned URLs (client-reachable) |
| `STORAGE_REGION` | S3 region |
| `STORAGE_ACCESS_KEY` | Access key (also the MinIO root user) |
| `STORAGE_SECRET_ACCESS_KEY` | Secret key (also the MinIO root password) |
| `STORAGE_TRACKS_BUCKET` | Bucket for audio files (defaults to `tracks`) |
| `STORAGE_ALBUM_ART_BUCKET` | Bucket for album artwork (defaults to `album-art`) |
| `STORAGE_ARTIST_IMAGE_BUCKET` | Bucket for artist images (defaults to `artist-image`) |
| `STORAGE_STAGING_BUCKET` | Bucket for in-flight upload staging (defaults to `upload-staging`) |

Bucket names are optional: when unset they fall back to the conventional
names above, and all four are created automatically at startup.

### Admin, docs & ingress

| Variable | Description |
| --- | --- |
| `ADMIN_EMAIL` | Seeded admin account email |
| `ADMIN_USERNAME` | Seeded admin username |
| `ADMIN_PASSWORD` | Seeded admin password |
| `SWAGGER_USERNAME` | Basic-auth user for `/docs` (dev) |
| `SWAGGER_PASSWORD` | Basic-auth password for `/docs` (dev) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel token (prod ingress) |
| `UPLOAD_TMP_DIR` | Scratch dir for uploads (defaults to `/mnt/data/castaway/tmp`) |
| `UPLOAD_PART_SIZE_BYTES` | Multipart part size for upload sessions (defaults to 64 MiB) |
| `UPLOAD_PRESIGN_TTL_SECONDS` | Lifetime of presigned upload URLs (defaults to `21600` = 6h) |

## Data model

Managed with Prisma (`prisma/schema.prisma`). Core entities:

- **User**, **Device**, **RefreshToken**, **EmailWhitelist** — accounts,
  per-device sessions and invite-only access.
- **Artist**, **Album**, **Track** — the catalog, joined many-to-many via
  **AlbumArtist** and **TrackArtist** for credits/features.
- **Playlist**, **PlaylistTrack** (+ `PlaylistType` enum) — ordered playlists.
- **AlbumInteraction**, **ArtistInteraction**, **PlaylistInteraction** — user
  engagement records.
- **TrackAnnotation**, **AlbumAnnotation**, **ArtistAnnotation** — editorial
  metadata.
- **ImportSession**, **ImportFile** (+ `ImportSessionStatus` / `ImportPhase`
  enums) — async album upload sessions and their staged files. Postgres is the
  source of truth for ingest status; the queue is transport only.

## API documentation

Interactive Swagger UI is served at **`/docs`** (with `/docs-json` and
`/docs-yaml`) when `NODE_ENV=development`. It is protected by HTTP basic auth
using `SWAGGER_USERNAME` / `SWAGGER_PASSWORD`. Endpoints authenticate with a
bearer access token.

A liveness/readiness endpoint is exposed at **`/health`** via Terminus.

### Admin upload sessions

Album uploads use a presigned, direct-to-storage flow (all under
`/admin/upload-sessions`, admin only):

1. `POST /admin/upload-sessions` — declare the files; receive presigned upload
   targets (a single PUT for small files, multipart part URLs for large ones).
2. Upload the bytes directly to storage using those URLs.
3. `POST /admin/upload-sessions/:id/files/:fileId/complete` — per file: finish
   the multipart upload (or verify the single PUT) and confirm the stored size.
4. `GET /admin/upload-sessions/:id` — poll status/phase/progress; `DELETE
   /admin/upload-sessions/:id` — abort a session that hasn't started processing.

Finalizing a session (enqueueing it for the ingest worker) is added in a later
change.

## Project structure

```
src/
  app.module.ts     Root module wiring
  main.ts           Bootstrap: validation pipe, Swagger, filters
  auth/             Login, JWT strategy, guards, decorators
  users/            User accounts
  device/           Per-device sessions
  refresh-token/    Refresh token issuance/rotation
  whitelist/        Email whitelist (invite-only signup)
  artists/          Artist catalog
  albums/           Album catalog
  tracks/           Track catalog + uploads
  playlists/        Playlists
  interactions/     Likes/saves/engagement
  search/           Catalog search
  storage/          S3 client + presigned URLs
  admin/            Admin-only endpoints
  upload-sessions/  Presigned direct-to-storage upload sessions
  ingest/           Shared album ingest (planning, persistence, worker processor)
  queue/            BullMQ queue wiring
  worker/           Ingest worker entry point (separate process, same image)
  health/           Terminus health checks
  common/           Shared DTOs/entities
  prisma/           Prisma service + exception filter
  generated/prisma/ Generated Prisma client
prisma/
  schema.prisma     Data model
  migrations/       Migration history
  seed.ts           Database seed
```

## Testing

```bash
npm test          # unit tests (Jest)
npm run test:watch
npm run test:cov  # coverage
npm run test:e2e  # end-to-end tests
```
