FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/vite.config.ts ./vite.config.ts
EXPOSE 5173
CMD ["npm", "run", "preview"]
