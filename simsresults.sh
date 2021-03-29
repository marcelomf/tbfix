#!/bin/bash
ARQUIVO=$1
cat $ARQUIVO | sed 's/[^[:print:]]//g' | sed 's/\[33m//g' | sed 's/\[39m//g' | sed ':a;N;$!ba;s/\n/#/g' | sed 's/---------- SIMULATE_COMB END -----------/\n/g' | awk -F '#' '{print $2";"$3";"$6";"$7";"$9";"$12";"$13}' | sed 's/end balance: //g' | sed 's/error rate: //g'
