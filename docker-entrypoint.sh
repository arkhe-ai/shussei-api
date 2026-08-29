#!/bin/sh
set -eu

attempt=1
while ! npx prisma migrate deploy; do
  if [ "$attempt" -ge 30 ]; then
    echo "Database migrations failed after ${attempt} attempts" >&2
    exit 1
  fi
  echo "Database is not ready; retrying migrations (${attempt}/30)" >&2
  attempt=$((attempt + 1))
  sleep 2
done

exec npm run start:prod
