# tbfix
TBFIX - Just another tradebot trying to be profitable (Fork of zenbot, with a lot of improvements)

## List of improvements when compared to zenbot:

1. Zenbot (lib/engine.js) use the callback style, i changed all the code of engine.js to async/await style. It's reducing bugs.
2. With tbfix you can use multiple strategies in diferent periods with diferent combinations!!! I think, it's a most important feature when i compared to zenbot.
3. Improves in binance API.
4. Improves backtest when i try to reduce the most number of bugs.
5. Add conf.json-dist style.
6. Add --deposit (the max money for trade).

## ALERT !!!

1. Just use binance. I don't work in other exchanges. I don't know if tbfix work with others exchanges.
2. Use simulate mode (./tbfix.sh sim ...) and paper mode (./tbfix.sh trade --paper ...)
3. Use by your risk! It's an experimental project.

## GETTING STARTED:

```
# you need installed mongodb and nodejs
git clone https://github.com/marcelomf/tbfix
npm install
cp conf.json-dist conf.json
vim conf.json # put your key and secret of binance
mkdir BTC-USDT
node genstts.js BTC-USDT > tmp.sh
chmod + x tmp.sh
vim tmp.sh # view the strategies
./tmp.sh # waiting for backtests !!! View the results on BTC-USDT folder
./simsresults.sh BTC-USDT/simsresults_BTC-USDT.txt # grep by you like
./tbfix.sh trade --paper --deposit 500 binance.BTC-USDT --strategies "macd.30m, ehlers_ft.30m" --strategies_action_buy "(macd30m.buyANDehlers_ft30m.buy)" --strategies_action_sell "(macd30m.sellORehlers_ft30 .sell) " # observe with --paper mode
# by your risk, remove --paper and try to be profitable in real market.
```