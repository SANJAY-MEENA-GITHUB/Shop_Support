# 11 — DevOps & Docker (Local Deployment)

## 1. Services (`docker-compose.yml` — see `templates/docker-compose.yml`)

| Service | Image / build | Ports | Depends on |
|---|---|---|---|
| `db` | `postgres:16-alpine` | `5432:5432` (host optional) | — |
| `backend` | `./backend/Dockerfile` (multi-stage: install → build → run) | `4000:4000` | `db` (healthy) |
| `frontend` | `./frontend/Dockerfile` (build → nginx or `vite preview`) | `5173:5173` | `backend` |

Healthchecks: `db` via `pg_isready`; `backend` via `GET /api/health`. Backend entrypoint: `prisma migrate deploy && node dist/index.js`.

## 2. Dockerfiles (agent must create)

**Backend (multi-stage):**
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/policy ./policy
COPY --from=build /app/package*.json ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

**Frontend:** build with Vite (`npm run build`), serve with `vite preview --host 0.0.0.0 --port 5173` or nginx. `VITE_API_URL=http://localhost:4000/api` baked at build time (document that changing backend URL requires rebuild, or use runtime env injection).

## 3. Environment (`.env.example` — see `templates/.env.example`)

```bash
# Database
DATABASE_URL=postgresql://support:support@db:5432/supportdb
POSTGRES_USER=support
POSTGRES_PASSWORD=support
POSTGRES_DB=supportdb
# Backend
JWT_SECRET=change-me-to-32-plus-random-chars
PORT=4000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
# AI (optional — leave empty for mock mode)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
# Frontend
VITE_API_URL=http://localhost:4000/api
```

## 4. Runbook (must work from clean checkout)

```bash
cp .env.example .env          # edit JWT_SECRET; add GEMINI_API_KEY if desired
docker compose up --build     # db + backend (migrates) + frontend
docker compose exec backend npx prisma db seed
# Open http://localhost:5173 — log in as priya@example.com / Customer@123
# API docs: http://localhost:4000/api/docs
docker compose exec backend npm test
docker compose down -v        # full reset
```

Local dev without Docker: `docker compose up db` only, then `npm run dev` in each folder (backend `tsx watch`, frontend `vite`).

## 5. CI (optional but recommended)

GitHub Actions: `npm ci && npm test && npm run build` for both folders on push/PR. No paid infra required.
