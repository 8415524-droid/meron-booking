#!/usr/bin/env bash
# בודק אם יש קומיט חדש ב-main של מירון; אם כן בונה, ורק אם הבנייה הצליחה מחליף. בנייה שנכשלה לא נוגעת בגרסה שרצה.
set -uo pipefail
APP_DIR=/opt/meron-booking; BRANCH=main; SECRETS=/root/dirot-secrets
LOG=/var/log/meron-update.log; BAD=$SECRETS/meron-bad-sha.txt
exec 9>/var/run/meron-update.lock; flock -n 9 || exit 0
log() { echo "$(date '+%F %T')  $*" >> "$LOG"; }
git_auth() { git -c "http.https://github.com/.extraheader=Authorization: basic $(printf 'x-access-token:%s' "$(cat "$SECRETS/github-token.txt")" | base64 -w0)" -c safe.directory='*' "$@"; }
cd "$APP_DIR" || exit 1
git_auth fetch -q origin "$BRANCH" || { log "fetch failed"; exit 1; }
old=$(git rev-parse HEAD); new=$(git rev-parse "origin/$BRANCH")
[ "$old" = "$new" ] && exit 0
[ -f "$BAD" ] && [ "$(cat "$BAD")" = "$new" ] && exit 0
log "update $old -> $new"
git reset -q --hard "$new"
C="docker compose -f $APP_DIR/deploy/docker-compose.yml"
if timeout 900 $C build >> "$LOG" 2>&1; then
  $C up -d >> "$LOG" 2>&1 && log "deployed $new" || log "up failed for $new"
else
  log "BUILD FAILED for $new - keeping the running version"
  echo "$new" > "$BAD"; git reset -q --hard "$old"; exit 1
fi
docker image prune -f >/dev/null 2>&1
