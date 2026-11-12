#!/bin/sh
# On upgrade KPM reinstalls right after, so keep the registration.
[ "$1" = "upgrade" ] && exit 0
APP_ID=com.kylep33.ksudoku
sqlite3 /var/local/appreg.db <<EOF
DELETE FROM properties WHERE handlerId='$APP_ID';
DELETE FROM handlerIds WHERE handlerId='$APP_ID';
EOF
rm -f /mnt/us/documents/ksudoku.sh
