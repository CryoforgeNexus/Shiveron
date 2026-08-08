#!/bin/sh
set -e

# The logs directory is a bind mount, so its ownership comes from the host and shadows whatever the image set. Docker creates a missing host directory as root, which the unprivileged node user cannot write to. Fixing it here covers every host state; doing it in the Dockerfile does not.
mkdir -p /usr/src/app/logs
chown -R node:node /usr/src/app/logs

exec su-exec node node dist/bot.js
