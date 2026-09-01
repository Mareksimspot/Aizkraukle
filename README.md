# Aizkraukles klīnikas digitālā izkārtne

Portrait UHD specialist timetable with an authenticated editor for Vercel.

## URLs

- Signage: `/signage`
- Admin: `/signage/admin`
- Public timetable API: `/api/timetable`

The signage checks the API every 10 minutes. When no API is available (for example on GitHub Pages), it falls back to the repository's `doctors_timetable.json`.

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Generate a password hash without committing the password:

```bash
read -s ADMIN_PASSWORD_INPUT
export ADMIN_PASSWORD_INPUT
npm run hash-password
unset ADMIN_PASSWORD_INPUT
```

Copy the generated value to `ADMIN_PASSWORD_HASH` in `.env.local`. Set `ADMIN_USERNAME` and generate `SESSION_SECRET` with at least 32 random characters. Never commit `.env.local`.

Run locally with:

```bash
npm run dev
```

Without Blob credentials, the public API reads `doctors_timetable.json`; saving from admin is intentionally disabled.

## Vercel deployment

1. Import this repository into Vercel.
2. Create a **private Vercel Blob** store and connect it to the project.
3. Add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET` to the Vercel project environment variables.
4. Deploy the project.
5. Route `aizkrauklesklinika.lv/signage` and `/signage/admin` to this project, or add equivalent rewrites in the existing website project.

The first successful admin save initializes the Blob from the repository timetable. Later saves use optimistic concurrency checks so one administrator cannot silently overwrite another administrator's newer changes.
