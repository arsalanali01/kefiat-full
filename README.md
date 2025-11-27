# Kefiat - Tenant & Manager Portal (with Requests)

## Quick start

1. Copy env files:

   ```bash
   cp .env.example .env
   cp .env.example backend/.env
   cp .env.example frontend/.env
   ```

2. Install deps (from project root):

   ```bash
   npm install
   ```

3. Start Postgres (Docker, from project root):

   ```bash
   docker-compose up -d db
   ```

4. Migrate + seed DB:

   ```bash
   cd backend
   npx prisma migrate dev --name init
   npx ts-node prisma/seed.ts
   npm run dev
   ```

5. Run frontend (new terminal):

   ```bash
   cd frontend
   npm run dev
   ```

6. Open `http://localhost:5173` and login:

   - Manager: `manager@example.com` / `password123`
   - Tenant: `tenant@example.com` / `password123`

Tenants can submit maintenance requests and track status.
Managers can view all requests and update status through the pipeline.
