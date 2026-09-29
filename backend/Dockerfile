FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads/reports logs

EXPOSE 5000

CMD ["sh", "-c", "node src/config/migrate.js && node src/config/migrate_tender_engine.js && node src/config/seed.js && node src/server.js"]
