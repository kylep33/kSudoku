#!/bin/sh
# KPM runs this from the package folder after unpacking.
APP_ID=com.kylep33.ksudoku
DIR="$(pwd)/app"

# Register the Mesquite app (appreg.db lives in /var/local, not the read-only rootfs).
sqlite3 /var/local/appreg.db <<EOF
INSERT OR IGNORE INTO handlerIds VALUES('$APP_ID');
INSERT OR REPLACE INTO properties VALUES('$APP_ID','lipcId','$APP_ID');
INSERT OR REPLACE INTO properties VALUES('$APP_ID','command','/usr/bin/mesquite -l $APP_ID -c file://$DIR/');
INSERT OR REPLACE INTO properties VALUES('$APP_ID','supportedOrientation','U');
EOF

# Library tile that launches the app.
cp ksudoku.sh /mnt/us/documents/ksudoku.sh
echo "ksudoku installed"
