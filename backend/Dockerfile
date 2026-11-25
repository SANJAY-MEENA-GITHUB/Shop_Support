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
RUN apk add --no-cache openssl wget
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/policy ./policy
COPY --from=build /app/openapi ./openapi
COPY --from=build /app/package*.json ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
