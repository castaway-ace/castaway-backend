# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Castaway, please report it privately rather than opening a public issue.

**How to report:**

- Email: `<your preferred contact email>`
- Or: open a private security advisory via GitHub's Security Advisories feature on this repository.

Please include:

- A description of the vulnerability
- Steps to reproduce
- The version or commit hash affected
- Any relevant logs or proof-of-concept

I will acknowledge receipt within a reasonable timeframe and work with you on coordinated disclosure. Castaway is a personal portfolio project with no SLA; please be patient.

## Supported Versions

This project tracks `main`. Security fixes are applied to `main` and the most recent tagged release, if any. Older releases are not maintained.

## Known Advisories and Accepted Risks

This section documents security advisories surfaced by `npm audit` that have been investigated and consciously accepted rather than silently ignored.

### `@hono/node-server` in `@prisma/dev`

**Status:** accepted, not reachable in production runtime.

Running `npm audit` on this project reports vulnerabilities in `@hono/node-server`, a transitive dependency brought in via:

`prisma` → `@prisma/dev` → `@hono/node-server`

`@prisma/dev` is Prisma's local development tooling. It is a `devDependency`, not present in the production build. The vulnerable code path is Hono's `serveStatic` middleware, which is only exercised by Prisma's local dev server when Prisma Postgres is in use.

**This project does not use Prisma Postgres.** It uses Supabase (managed PostgreSQL) in production and a local Postgres container in development. The `@prisma/dev` server is not invoked in either environment.

**Why `npm audit fix --force` is not run:** the suggested fix downgrades Prisma from version 7 to version 6, which is a major version rollback and would require reverting this project's `prisma.config.ts` setup and driver-adapter-based client instantiation. The risk of the downgrade outweighs the risk of the advisory.

**Upstream tracking:**

- [prisma/prisma#28568](https://github.com/prisma/prisma/issues/28568)
- [prisma/prisma#29027](https://github.com/prisma/prisma/issues/29027)

This advisory will be cleared once Prisma publishes a version of `@prisma/dev` that depends on a patched `@hono/node-server`.

**Last reviewed:** April 22nd 2026