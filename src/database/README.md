# Database Layer

Prisma ORM setup for Auth & Onboarding Service.

## Structure

```
src/database/
├── schema.prisma          # Prisma schema definition
├── prisma.client.ts       # Prisma client singleton
├── migrations/            # Database migration files
└── README.md             # This file
```

## Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply migration
npm run prisma:migrate

# Apply migrations in production
npm run prisma:migrate:deploy

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Format schema file
npm run prisma:format
```

## First Migration

After setting up your database:

```bash
npm run prisma:migrate
```

This will:

1. Create the initial migration
2. Apply it to your database
3. Generate the Prisma Client

## Schema Location

Schema is in `src/database/schema.prisma`. All migrations are stored in `src/database/migrations/`.

## Usage

Import the Prisma client:

```typescript
import prisma from '../database/prisma.client';

// Use in your code
const user = await prisma.user.findUnique({ where: { id: '...' } });
```
