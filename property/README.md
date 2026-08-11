# Smart Property Management

A scalable B2B SaaS platform with separate frontend and backend applications for HOA administration and resident self-service.

## Structure
- frontend/: React + TypeScript + Vite + Tailwind-based admin and resident portal
- backend/: Node.js + Express + TypeScript + Prisma modular monolith
- docs/: architecture and product documentation

## Local development

```powershell
docker compose up -d postgres redis
cd backend
npm install
npm run prisma:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Run the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The API runs at `http://localhost:3001`; the Vite app uses
`http://localhost:5174` by default. Copy the relevant `.env.example` files
when environment-specific values are required.

### Development accounts

All seeded accounts use the password `HomeLink123!`.

- `superadmin@homelink.mn`
- `manager@homelink.mn`
- `nyarav@homelink.mn`
- `staff@homelink.mn`
- `resident@homelink.mn`

Login and registration use PostgreSQL-backed users, scrypt password hashes,
and signed JWT access tokens. Protected API routes require the token through
the `Authorization: Bearer <token>` header.
