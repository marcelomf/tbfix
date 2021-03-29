#!/bin/bash
DATE=$(date +%F_%R)
DAYS=5
MARKET="USDT"
#for COIN in UNI DOT TRX EOS BTC ETH XRP ADA BNB; do  #BTC; do 
for COIN in BTC ETH XRP ADA EOS TRX BNB UNI DOT; do  #BTC; do 
	echo "DOWNLOAD $COIN: "
	./tbfix.sh backfill binance.$COIN-$MARKET --days $DAYS
done;
