# Castaway

Castaway is a self-hosted **music streaming API**. It manages a library of
artists, albums, tracks and playlists, streams audio from S3-compatible object
storage, and serves an invite-only user base with per-device JWT sessions.

Built with [NestJS](https://nestjs.com) 11, [Prisma](https://www.prisma.io) 7,
PostgreSQL and [RustFS](https://rustfs.com) (S3), and packaged to run entirely via
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
- **Access control (RBAC)** — users hold one or more roles (`ADMIN`, `USER`),
  each granting a set of code-defined permissions; privileged endpoints are
  gated on permissions rather than a hardcoded admin flag.
- **Interactions** — likes/saves and play-history style interactions across
  albums, artists and playlists.
- **Search** — query endpoints across the catalog.
- **Admin** — permission-gated endpoints for managing the catalog, whitelist,
  uploads and user roles.
- **Ops** — rate limiting (`@nestjs/throttler`), health checks
  (`@nestjs/terminus`) and Swagger API docs.

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 24 (ESM) |
| Framework | NestJS 11 |
| ORM | Prisma 7 (`@prisma/adapter-pg` driver adapter) |
| Database | PostgreSQL 16 |
| Object storage | RustFS / any S3-compatible service (AWS SDK v3) |
| Auth | `@nestjs/jwt`, Argon2 |
| Docs | Swagger (`@nestjs/swagger`) |
| Ingress (prod) | Cloudflare Tunnel (`cloudflared`) |
| Container | Docker Compose |

## Architecture

Both environments run the same set of services via Compose:

| Service | Role | Notes |
| --- | --- | --- |
| `app` | NestJS API | Port `3000` |
| `db` | PostgreSQL 16 | Port `5432` (exposed in dev only) |
| `storage` | RustFS (S3) | API `9000`, console `9001` |
| `storage-perms` | One-shot `chown` of the storage data dir to uid `10001` | Runs to completion before `storage` starts |
| `migrate` | One-shot `prisma migrate deploy` | Runs to completion before `app` starts |
| `cloudflared` | Cloudflare Tunnel | Public ingress for prod |

On startup the `app` service waits for `db` to be healthy and for `migrate` to
finish, so pending migrations are always applied before the API comes up. In
production the app is bound to `127.0.0.1:3000` and exposed to the internet only
through the Cloudflare tunnel.

## Getting started

**Prerequisites:** Docker + Docker Compose, and `make`.

1. **Create your `.env`** by copying the template and filling in real values:

   ```bash
   cp .env.example .env
   ```

   Every variable is documented under
   [Environment variables](#environment-variables); Compose uses `.env` for
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
   `make studio` on port `5555`, and the RustFS console at
   **http://localhost:9001/rustfs/console/**. Studio runs on the host rather than in a
   container, so it needs host dependencies installed (`npm ci`).

When you change the Prisma schema, create and apply a migration with
`make migrate`.

## Dev / Prod commands

Common database and stack tasks are wrapped in the [`Makefile`](Makefile).
Run `make help` to list every target. **Bare targets act on dev**; the
**`prod-` prefix acts on production**.

### Development (`compose.yaml` + `compose.override.yaml`)

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

### Production (`compose.yaml` + `compose.production.yaml`)

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
- **Host directory ownership.** The prod stack bind-mounts
  `/mnt/data/castaway/tmp` for uploads, and the app container runs as `node`
  (uid 1000). A bind mount carries the *host* directory's ownership, so the
  image's own `chown` does not apply — if that directory is root-owned (e.g.
  created with `sudo mkdir`), uploads fail with `EACCES`. Check with
  `stat -c '%u:%g' /mnt/data/castaway/tmp` and `chown 1000:1000` if needed.
  `db_data` is fine: Postgres chowns its own data directory on first start.
  `storage_data` is fine too: RustFS runs as uid 10001 and does not chown its
  data directory, so the `storage-perms` service chowns it before every start.

## Environment variables

Define these in a `.env` file at the repo root. Do **not** commit it.

Secrets (passwords, keys, `DATABASE_URL`, the tunnel token) still live in `.env`,
but Compose hands them to containers as [secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
mounted under `/run/secrets/` rather than as environment variables, so they stay out
of `docker inspect` and `docker compose config`. Services receive a `<NAME>_FILE`
path instead of `<NAME>`; app code reads these through `readEnvOrFile` /
`ConfigService` (see `src/common/env.ts`). On the prod host, keep `.env` at `chmod 600`.

### Database

| Variable | Description |
| --- | --- |
| `POSTGRES_DB` | Postgres database name |
| `POSTGRES_USER` | Postgres user |
| `POSTGRES_PASSWORD` | Postgres password |
| `DATABASE_URL` | Prisma connection string, e.g. `postgresql://<user>:<pass>@db:5432/<db>` |

### Auth

| Variable | Description |
| --- | --- |
| `JWT_ACCESS_SECRET` | Signing secret for access tokens |
| `JWT_ACCESS_EXPIRATION` | Access token TTL (e.g. `15m`) |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL (e.g. `30d`) |

### Object storage (S3 / RustFS)

| Variable | Description |
| --- | --- |
| `STORAGE_ENDPOINT` | S3 endpoint used by the server |
| `STORAGE_PRESIGNED_ENDPOINT` | Endpoint baked into presigned URLs (client-reachable) |
| `STORAGE_REGION` | S3 region |
| `STORAGE_ACCESS_KEY` | Access key (also the RustFS admin access key) |
| `STORAGE_SECRET_ACCESS_KEY` | Secret key (also the RustFS admin secret key) |
| `STORAGE_VOLUMES` | **Required.** RustFS data path inside the container; must match the storage volume mount (`/data`) |
| `STORAGE_ADDRESS` | **Required.** RustFS S3 API listen address; must match `STORAGE_ENDPOINT`'s port (`:9000`) |
| `STORAGE_CONSOLE_ADDRESS` | **Required.** RustFS console listen address (`:9001`) |
| `STORAGE_CONSOLE_ENABLE` | **Required.** `true` to serve the RustFS console |
| `STORAGE_TRACKS_BUCKET` | Bucket for audio files (defaults to `tracks`) |
| `STORAGE_ALBUM_ART_BUCKET` | Bucket for album artwork (defaults to `album-art`) |
| `STORAGE_ARTIST_IMAGE_BUCKET` | Bucket for artist images (defaults to `artist-image`) |

Bucket names are optional: when unset they fall back to the conventional
names above, and all three are created automatically at startup.

Album cover art and artist images are served as **stable, unsigned public URLs**
(`<STORAGE_PRESIGNED_ENDPOINT>/<bucket>/<id>/cover.jpg?v=<updatedAt>`) so they can be
cached at a CDN/edge. The `album-art` and `artist-image` buckets are made anonymous-read
automatically at startup, objects are written with a long `immutable`
`Cache-Control`, and the `?v=` timestamp busts the cache when an image is
replaced. The `tracks` bucket stays private. To turn on
edge caching, front `STORAGE_PRESIGNED_ENDPOINT` with a Cloudflare cache rule covering
`/album-art/*` and `/artist-image/*` (keep the `v` query param in the cache
key). Audio streaming is unaffected — it still proxies through the API with HTTP
Range support.

### Admin, docs & ingress

| Variable | Description |
| --- | --- |
| `ADMIN_EMAIL` | Seeded admin account email |
| `ADMIN_USERNAME` | Seeded admin username |
| `ADMIN_PASSWORD` | Seeded admin password |
| `SWAGGER_USERNAME` | Basic-auth user for `/docs` (dev) |
| `SWAGGER_PASSWORD` | Basic-auth password for `/docs` (dev) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel token (prod ingress) |
| `UPLOAD_TMP_DIR` | Scratch dir for artist-image and album uploads (defaults to `/mnt/data/castaway/tmp`) |

### Development

| Variable | Description |
| --- | --- |
| `DOCKER_UID` | **Required for dev.** uid the dev app container runs as, so files written through the bind mount stay owned by you. Set to `id -u` |
| `DOCKER_GID` | **Required for dev.** gid to match. Set to `id -g` |

## Data model

Managed with Prisma (`prisma/schema.prisma`). Core entities:

- **User** (with a `roles` list backed by the `Role` enum), **Device**,
  **RefreshToken**, **EmailWhitelist** — accounts, role assignments, per-device
  sessions and invite-only access.
- **Artist**, **Album**, **Track** — the catalog, joined many-to-many via
  **AlbumArtist** and **TrackArtist** for credits/features.
- **Playlist**, **PlaylistTrack** (+ `PlaylistType` enum) — ordered playlists.
- **AlbumInteraction**, **ArtistInteraction**, **PlaylistInteraction** — user
  engagement records.
- **TrackAnnotation**, **AlbumAnnotation**, **ArtistAnnotation** — editorial
  metadata.

## Access control (RBAC)

Authorization is role-based. Each **User** carries a `roles` list (the `Role`
enum: `ADMIN`, `USER`). Roles map to a set of granular **permissions** defined
in code (`src/auth/rbac/permissions.ts`) — e.g. `catalog:write`,
`catalog:delete`, `upload:manage`, `whitelist:manage`, `role:manage`. `ADMIN`
implicitly holds every permission; `USER` is the default for self-registered
accounts.

- **Enforcement** — a global `AuthGuard` verifies the JWT (which carries the
  caller's roles), then a global `PermissionsGuard` runs. Endpoints opt in with
  `@RequirePermissions(...)`; those without it only require authentication.
  Adding a role, or changing what it grants, is a one-line change to the code
  map — no schema migration.
- **Whitelist vs. roles** — the email whitelist is admission control (who may
  sign in); roles are authorization (what they may do). Accounts with the
  `ADMIN` role bypass the whitelist; everyone else must be whitelisted.
- **Managing roles** (requires `role:manage`): `GET /admin/roles` returns the
  role→permission catalog, `GET /admin/users` lists users with their roles, and
  `PUT /admin/users/:id/roles` sets a user's roles. Changing a user's roles
  revokes their active sessions so it takes effect on next login, and the last
  remaining `ADMIN` cannot be demoted.

## API documentation

Interactive Swagger UI is served at **`/docs`** (with `/docs-json` and
`/docs-yaml`) when `NODE_ENV=development`. It is protected by HTTP basic auth
using `SWAGGER_USERNAME` / `SWAGGER_PASSWORD`. Endpoints authenticate with a
bearer access token.

A liveness/readiness endpoint is exposed at **`/health`** via Terminus.

### Admin album upload

Albums are imported synchronously through a single multipart request:

`POST /admin/albums` — send the album's audio files as `files[]` (up to 200 per
request, 2 GiB each). Requires the `catalog:write` permission.

The request must describe exactly one album: every file's album title and album
artist tags have to agree, and disc/track numbers must be unique. All artists
named in the tags must already exist — create them with `POST /admin/artists`
first. The handler parses tags with `music-metadata`, uploads the cover and
tracks (four at a time), then writes the album and its tracks in one
transaction. If any upload or the transaction fails, the objects already
written are removed before the error is returned, so storage is never left with
orphans. Re-importing an album that already exists returns `409`.

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
