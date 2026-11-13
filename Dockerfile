FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# Copy root workspace and package manifests
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN npm install

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared library first
RUN npm run build --workspace=@typhoon/shared

# Generate Prisma client and build backend
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist/prisma --target ES2022 --module CommonJS --esModuleInterop --skipLibCheck

# --- PRODUCTION RUNNER ---
FROM node:22-alpine AS runner

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:$PATH"

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000

WORKDIR /app/apps/backend
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate || true; node dist/prisma/seed.js || true; node dist/main.js"]
