# 🍯 SSH Honeypot Service

A lightweight SSH honeypot that listens for incoming SSH connections, logs authentication attempts, and stores events.

## 🚀 Getting Started

### Step 1: Install dependencies

```bash
pnpm install
```

### Step 2: Configure environment

```bash
cp .env.template .env
```

Edit `.env` and fill in your values:

```env
NODE_ENV="development"
HOST="0.0.0.0"
SSH_PORT="2222"
EVENT_STORE="pg"        # 'memory' or 'pg'

PG_HOST="localhost"
PG_PORT="5432"
PG_USER="honeypot"
PG_PASSWORD="honeypot"
PG_DATABASE="honeypot"
```

### Step 3: Run database migrations

```bash
pnpm migrate
```

### Step 4: Start the service

```bash
# Development
pnpm start:dev

# Production
pnpm build && pnpm start:prod
```

## 📁 Folder Structure

```
src/
├── application/
│   ├── ports/
│   ├── services/
│   └── use-cases/
├── domain/
├── infrastructure/
│   ├── logging/
│   ├── persistence/
│   └── server/
├── index.ts
└── server.ts
migrations/
```

## 🐘 PostgreSQL

### Install psql (Manjaro & Arch)

```bash
sudo pacman -S postgresql-libs   # client only
# or
sudo pacman -S postgresql         # full install
```

### Connect to the database

```bash
# Using the npm script
pnpm connect:db

# Or manually
source .env && psql "postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}"
```

### Useful psql commands

| Command        | Description                     |
| -------------- | ------------------------------- |
| `\l`           | List all databases              |
| `\c dbname`    | Switch to database              |
| `\dt`          | List all tables                 |
| `\d tablename` | Describe table (columns, types) |
| `\dn`          | List schemas                    |
| `\du`          | List users/roles                |
| `\x`           | Toggle expanded output          |
| `\timing`      | Toggle query execution time     |
| `\i file.sql`  | Execute SQL from file           |
| `\q`           | Quit                            |

### Useful SQL queries

```sql
-- Current database and user
SELECT current_database(), current_user;

-- Table sizes
SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- Active connections
SELECT * FROM pg_stat_activity;

-- Kill a connection
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'honeypot';
```

## 🐳 Docker

```bash
docker build -t ssh-honeypot-svc .
docker run -p 2222:2222 --env-file .env ssh-honeypot-svc
```
