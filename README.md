# Node.js Boilerplate

Modular monolith backend boilerplate built with Express 5, Prisma 7, TypeScript, Redis, and BullMQ.

## Stack

- **Runtime:** Node.js 22+ with TypeScript 5.9 (strict mode)
- **Framework:** Express 5
- **ORM:** Prisma 7 with PostgreSQL (pg adapter)
- **Cache:** Redis 7 (ioredis)
- **Queue:** BullMQ (session update throttling)
- **Auth:** RS256 JWT with refresh tokens, OTP, 2FA/MFA, RBAC
- **Logging:** Winston with daily rotation
- **File Storage:** AWS S3 via presigned URLs (express-storage)
- **Security:** Helmet, CORS, rate limiting, XSS sanitization, PBKDF2 password hashing, RSA encryption

## Architecture

```
src/
├── index.ts                    # Entry point (cluster mode in production)
├── app.ts                      # Express app setup (middleware chain)
├── config/                     # Environment, CORS, Helmet configs
├── database/                   # Prisma schema, client, seed
├── routes/                     # Root router
└── app/
    ├── core/                   # Framework-agnostic core layer
    │   ├── container.ts        # DI container
    │   ├── constants/          # Auth, HTTP, roles, permissions
    │   ├── database/           # Base repository, Prisma client
    │   ├── errors/             # AppError hierarchy (400-500)
    │   ├── types/              # Express augmentations, common types
    │   └── utils/              # Date, pagination, random, sanitize
    └── http/                   # Express HTTP layer
        ├── controllers/        # Base controller, app controller
        ├── middleware/          # Auth, error, logging, rate-limit, sanitize
        ├── services/           # JWT, password, encryption, logger, storage, health
        └── modules/            # Feature modules
            ├── auth/           # OTP login, password login, 2FA, sessions, password reset
            ├── gallery/        # S3 file upload/confirm/view/delete
            └── admin/          # Config, roles, permissions management
```

Each module follows: **controller → service → repository** with co-located types, validation, and routes.

## Getting Started

```bash
# 1. Clone the repo
git clone <repo-url> my-project
cd my-project

# 2. Install dependencies
npm install

# 3. Copy environment file
cp env.example .env

# 4. Start infrastructure (PostgreSQL + Redis)
docker compose up -d postgres redis

# 5. Generate RSA keys for JWT signing
mkdir -p storage/keys/api storage/keys/encryption
openssl genrsa -out storage/keys/api/private.key 2048
openssl rsa -in storage/keys/api/private.key -pubout -out storage/keys/api/public.key
openssl genrsa -out storage/keys/encryption/private.key 2048
openssl rsa -in storage/keys/encryption/private.key -pubout -out storage/keys/encryption/private.key.pub

# 6. Run database migrations
npm run prisma:migrate

# 7. Seed the database
npm run seed

# 8. Start development server
npm run dev
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed` | Seed database with roles, permissions, test users |

## Test Users (after seeding)

| Role | Email | Auth Method |
|---|---|---|
| Customer | customer@test.com | OTP (dev code: 123456) |
| Admin | admin@test.com | Password: Admin@123 |
| Super Admin | superadmin@test.com | Password: Admin@123 |

## API Routes

```
GET  /              # Landing
GET  /health        # Health check
POST /v1/auth/*     # Authentication (OTP, password, 2FA, sessions)
*    /v1/gallery/*  # File uploads (S3 presigned URLs)
*    /v1/admin/*    # Admin (config, roles, permissions)
```

## Docker

```bash
# Full stack (Postgres + Redis + Backend)
docker compose up -d

# Just infrastructure
docker compose up -d postgres redis
```
