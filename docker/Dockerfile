FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json .

RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /usr/src/app

# su-exec lets the entrypoint fix ownership of the bind-mounted logs directory as root, then drop to the unprivileged node user before starting the bot.
RUN apk add --no-cache su-exec

COPY package*.json .

RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

COPY --from=builder /usr/src/app/src/locales ./dist/locales

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /usr/src/app/logs && chown -R node:node /usr/src/app/logs

CMD ["./entrypoint.sh"]