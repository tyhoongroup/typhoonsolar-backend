# Typhoon Solar - Backend API Server

Enterprise Rooftop Solar Platform (ERP & CRM) Backend API built with NestJS, TypeScript, Prisma ORM, and PostgreSQL.

## Features
- **10-Stage Rooftop Solar Project Lifecycle**: Complete pipeline automation from lead inquiry to subsidy release.
- **Role-Based Access Control (RBAC)**: Support for 8 operational roles:
  1. `SALESPERSON` (Field Sales & Lead Generation)
  2. `PORTAL_USER` (National Solar Portal & Discom Liaison)
  3. `MATERIAL_MANAGER` (Inventory, BOM, & Warehouse Dispatch)
  4. `INSTALLATION_TEAM` (Site Execution & Commissioning)
  5. `ACCOUNTANT` (Stage Invoicing & Milestone Collection)
  6. `OPS_MANAGER` (Control Tower & Project Governance)
  7. `SERVICE_TECH` (O&M & Post-Commissioning Support)
  8. `ADMIN` (Super Administrator)
- **Customer Tracking API**: Secure HMAC-tokenized public tracker endpoints with stage breakdown, payment ledger, and queries.
- **Automated Notifications**: Real-time push & in-app notifications on stage handoffs and milestone triggers.
- **Solar Proposal Engine**: Dynamic calculation of system sizing, MNRE subsidy tiers, unit generation, and financial payback.

## Tech Stack
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5
- **Authentication**: JWT & Passport
- **Push Alerts**: Firebase Cloud Messaging (FCM)
- **Document Generation**: PDFKit & Multer

## Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- PostgreSQL >= 16

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env` and fill in your database credentials:
```bash
cp .env.example .env
```

### 4. Database Setup & Seeding
```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
```

### 5. Run the Server
```bash
# Development mode (watch)
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```
The server will run on `http://localhost:4000` (API prefix: `/api/v1`).
