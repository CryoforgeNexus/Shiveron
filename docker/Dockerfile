FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json .

RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json .

RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

COPY --from=builder /usr/src/app/src/locales ./dist/locales

USER node

CMD ["node", "dist/bot.js"]
