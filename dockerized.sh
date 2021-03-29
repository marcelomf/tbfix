#!/bin/sh
cd /opt/zenbot
/usr/bin/./mongod 1>/dev/null 2>&1 &
sleep 3
./zenbot.sh trade --strategy $STRATEGY $SELECTOR $OPTSZEN
