#!/bin/bash
rm -rf status/*
docker run -d -ti -P -e STRATEGY='mmf' -v /root/zenbot/status:/opt/zenbot/status -e OPTSZEN='--status --reverse --interval_trade 10 --order_adjust_time 10000 --sell_stop_pct 0.4 --profit_stop_enable_pct 0.5 --sell_cancel_pct 0.2 --max_slippage_pct 0.05 --deposit 0.1 --order_poll_time 3000 --poll_trades 10000' -e SELECTOR='binance.ETH-BTC' --name mmf_eth-btc zenbot8
docker run -d -ti -P -e STRATEGY='mmf' -v /root/zenbot/status:/opt/zenbot/status -e OPTSZEN='--status --reverse --interval_trade 10 --order_adjust_time 10000 --sell_stop_pct 0.4 --profit_stop_enable_pct 0.5 --sell_cancel_pct 0.2 --max_slippage_pct 0.05 --deposit 0.1 --order_poll_time 3000 --poll_trades 10000' -e SELECTOR='binance.LTC-BTC' --name mmf_ltc-btc zenbot8
docker run -d -ti -P -e STRATEGY='mmf' -v /root/zenbot/status:/opt/zenbot/status -e OPTSZEN='--status --reverse --interval_trade 10 --order_adjust_time 10000 --sell_stop_pct 0.4 --profit_stop_enable_pct 0.5 --sell_cancel_pct 0.2 --max_slippage_pct 0.05 --deposit 0.1 --order_poll_time 3000 --poll_trades 10000' -e SELECTOR='binance.TRX-BTC' --name mmf_trx-btc zenbot8
docker run -d -ti -P -e STRATEGY='mmf' -v /root/zenbot/status:/opt/zenbot/status -e OPTSZEN='--status --reverse --interval_trade 10 --order_adjust_time 10000 --sell_stop_pct 0.4 --profit_stop_enable_pct 0.5 --sell_cancel_pct 0.2 --max_slippage_pct 0.05 --deposit 0.1 --order_poll_time 3000 --poll_trades 10000' -e SELECTOR='binance.EOS-BTC' --name mmf_eos-btc zenbot8
docker run -d -ti -P -e STRATEGY='mmf' -v /root/zenbot/status:/opt/zenbot/status -e OPTSZEN='--status --reverse --interval_trade 10 --order_adjust_time 10000 --sell_stop_pct 0.4 --profit_stop_enable_pct 0.5 --sell_cancel_pct 0.2 --max_slippage_pct 0.05 --deposit 0.1 --order_poll_time 3000 --poll_trades 10000' -e SELECTOR='binance.BNB-BTC' --name mmf_bnb-btc zenbot8
docker run -d -ti -P -e STRATEGY='mmf' -v /root/zenbot/status:/opt/zenbot/status -e OPTSZEN='--status --reverse --interval_trade 10 --order_adjust_time 10000 --sell_stop_pct 0.4 --profit_stop_enable_pct 0.5 --sell_cancel_pct 0.2 --max_slippage_pct 0.05 --deposit 0.1 --order_poll_time 3000 --poll_trades 10000' -e SELECTOR='binance.XRP-BTC' --name mmf_xrp-btc zenbot8