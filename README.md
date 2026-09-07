# Aizkraukles klīnikas digitālā izkārtne

Portrait UHD specialist timetable with an authenticated editor for Vercel.

## URLs

- First signage screen: `/signage?screen=1`
- Second signage screen: `/signage?screen=2`
- Admin: `/signage/admin`
- Public timetable API: `/api/timetable`
- Public advertisement configuration API: `/api/advertisements`

Each screen shows its assigned half of the doctors and reserves the bottom quarter for an image or muted looping video advertisement. The signage checks both APIs every 10 minutes. When no API is available (for example on GitHub Pages), it falls back to `doctors_timetable.json` and `advertisements.json`.

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
2. Create a **public Vercel Blob** store and connect it to the project. Ensure the project receives `BLOB_READ_WRITE_TOKEN`; direct browser uploads use it server-side to issue restricted upload tokens.
3. Add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET` to the Vercel project environment variables.
4. Deploy the project.
5. Route `aizkrauklesklinika.lv/signage` and `/signage/admin` to this project, or add equivalent rewrites in the existing website project.

The first successful admin save initializes Blob configuration from the repository files. Later saves use optimistic concurrency checks so one administrator cannot silently overwrite another administrator's newer changes. Advertisement uploads accept JPEG, PNG, WebP, MP4, and WebM files up to 100 MB.
