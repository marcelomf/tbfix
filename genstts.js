// ./tbfix.sh sim binance.TRX-USDT --days 7 --strategies "trend_ema.5m,trend_ema.15m,trend_ema.20m,trend_ema.25m,trend_ema.30m" --strategies_action_buy "(trend_ema5m.buyAND(trend_ema15m.sellORtrend_ema20m.sellORtrend_ema25m.sellORtrend_ema30m.sell))" --strategies_action_sell "(trend_ema5m.sellAND(trend_ema15m.buyORtrend_ema20m.buyORtrend_ema25m.buyORtrend_ema30m.buy))" --filename teste.html --debug
// ./tbfix.sh sim binance.TRX-USDT --days 7 --strategies "macd.5m,macd.10m" --strategies_action_buy "(macd5m.buyANDmacd10m.buy)" --strategies_action_sell "(macd5m.sellORmacd10m.sell)" --filename teste.html --debug
// ./tbfix.sh sim binance.TRX-USDT --days 7 --strategies "macd.15m,macd.30m" --strategies_action_buy "(macd15m.buyANDmacd30m.buy)" --strategies_action_sell "(macd15m.sellORmacd30m.sell)" --filename teste.html --debug
// ./tbfix.sh sim binance.TRX-USDT --days 7 --strategies "macd.5m,sar.5m" --strategies_action_buy "(macd5m.buyANDsar5m.buy)" --strategies_action_sell "(macd5m.sellORsar5m.sell)" --filename teste.html --debug
let stts = ["sar", "trend_ema", "pivot", "dema", "kc", "ehlers_ft", "momentum", "macd"]
let results = []
let validateResults = []
for(let i = 0; i < stts.length; i++) {
	if(!validateResults.find(e => e == "("+stts[i]+"5m.buyAND("+stts[i]+"15m.sellOR"+stts[i]+"20m.sellOR"+stts[i]+"25m.sellOR"+stts[i]+"30m.sell))")) {
		results.push({
			strategies: stts[i]+".5m,"+stts[i]+".15m,"+stts[i]+".20m,"+stts[i]+".25m,"+stts[i]+".30m",
			strategies_action_buy: "("+stts[i]+"5m.buyAND("+stts[i]+"15m.sellOR"+stts[i]+"20m.sellOR"+stts[i]+"25m.sellOR"+stts[i]+"30m.sell))",
			strategies_action_sell: "("+stts[i]+"5m.sellAND("+stts[i]+"15m.buyOR"+stts[i]+"20m.buyOR"+stts[i]+"25m.buyOR"+stts[i]+"30m.buy))"
		})
		validateResults.push("("+stts[i]+"5m.buyAND("+stts[i]+"15m.sellOR"+stts[i]+"20m.sellOR"+stts[i]+"25m.sellOR"+stts[i]+"30m.sell))")
	}
	if(!validateResults.find(e => e == "("+stts[i]+"5m.buyAND"+stts[i]+"10m.buy)")) {
		results.push({
			strategies: stts[i]+".5m,"+stts[i]+".10m",
			strategies_action_buy: "("+stts[i]+"5m.buyAND"+stts[i]+"10m.buy)",
			strategies_action_sell: "("+stts[i]+"5m.sellOR"+stts[i]+"10m.sell)"
		})
		validateResults.push("("+stts[i]+"5m.buyAND"+stts[i]+"10m.buy)")
	}
	if(!validateResults.find(e => e == "("+stts[i]+"15m.buyAND"+stts[i]+"30m.buy)")) {
		results.push({
			strategies: stts[i]+".15m,"+stts[i]+".30m",
			strategies_action_buy: "("+stts[i]+"15m.buyAND"+stts[i]+"30m.buy)",
			strategies_action_sell: "("+stts[i]+"15m.sellOR"+stts[i]+"30m.sell)"
		})
		validateResults.push("("+stts[i]+"15m.buyAND"+stts[i]+"30m.buy)")
	}
	for(let x = 0; x < stts.length; x++) {
		if(stts[i] == stts[x]) continue
		if(!validateResults.find(e => e == "("+stts[i]+"5m.buyAND"+stts[x]+"5m.buy)")) {
			results.push({
				strategies: stts[i]+".5m,"+stts[x]+".5m",
				strategies_action_buy: "("+stts[i]+"5m.buyAND"+stts[x]+"5m.buy)",
				strategies_action_sell: "("+stts[i]+"5m.sellOR"+stts[x]+"5m.sell)"
			})
			validateResults.push("("+stts[i]+"5m.buyAND"+stts[x]+"5m.buy)")
		}
		if(!validateResults.find(e => e == "("+stts[i]+"15m.buyAND"+stts[x]+"15m.buy)")) {
			results.push({
				strategies: stts[i]+".15m,"+stts[x]+".15m",
				strategies_action_buy: "("+stts[i]+"15m.buyAND"+stts[x]+"15m.buy)",
				strategies_action_sell: "("+stts[i]+"15m.sellOR"+stts[x]+"15m.sell)"
			})
			validateResults.push("("+stts[i]+"15m.buyAND"+stts[x]+"15m.buy)")
		}
		
		if(!validateResults.find(e => e == "("+stts[i]+"30m.buyAND"+stts[x]+"30m.buy)")) {
			results.push({
				strategies: stts[i]+".30m,"+stts[x]+".30m",
				strategies_action_buy: "("+stts[i]+"30m.buyAND"+stts[x]+"30m.buy)",
				strategies_action_sell: "("+stts[i]+"30m.sellOR"+stts[x]+"30m.sell)"
			})
			validateResults.push("("+stts[i]+"30m.buyAND"+stts[x]+"30m.buy)")
		}

		// for(let y = 0; y < stts.length; y++) {
		// 	if(stts[i] == stts[y] || stts[x] == stts[y]) continue
		// 	if(!validateResults.find(e => e == "("+stts[i]+"5m.buyAND"+stts[x]+"5m.buyAND"+stts[y]+"5m.buy)")) {
		// 		results.push({
		// 			strategies: stts[i]+".5m,"+stts[x]+".5m,"+stts[y]+".5m",
		// 			strategies_action_buy: "("+stts[i]+"5m.buyAND"+stts[x]+"5m.buyAND"+stts[y]+"5m.buy)",
		// 			strategies_action_sell: "("+stts[i]+"5m.sellOR"+stts[x]+"5m.sellOR"+stts[y]+"5m.sell)"
		// 			})
		// 		validateResults.push("("+stts[i]+"5m.buyAND"+stts[x]+"5m.buyAND"+stts[y]+"5m.buy)")
		// 	}
			
		// 	if(!validateResults.find(e => e == "("+stts[i]+"15m.buyAND"+stts[x]+"15m.buyAND"+stts[y]+"15m.buy)")) {
		// 		results.push({
		// 			strategies: stts[i]+".15m,"+stts[x]+".15m,"+stts[y]+".15m",
		// 			strategies_action_buy: "("+stts[i]+"15m.buyAND"+stts[x]+"15m.buyAND"+stts[y]+"15m.buy)",
		// 			strategies_action_sell: "("+stts[i]+"15m.sellOR"+stts[x]+"15m.sellOR"+stts[y]+"15m.sell)"
		// 		})
		// 		validateResults.push("("+stts[i]+"15m.buyAND"+stts[x]+"15m.buyAND"+stts[y]+"15m.buy)")
		// 	}
			
		// 	if(!validateResults.find(e => e == "("+stts[i]+"30m.buyAND"+stts[x]+"30m.buyAND"+stts[y]+"30m.buy)")) {
		// 		results.push({
		// 			strategies: stts[i]+".30m,"+stts[x]+".30m,"+stts[y]+".30m",
		// 			strategies_action_buy: "("+stts[i]+"30m.buyAND"+stts[x]+"30m.buyAND"+stts[y]+"30m.buy)",
		// 			strategies_action_sell: "("+stts[i]+"30m.sellOR"+stts[x]+"30m.sellOR"+stts[y]+"30m.sell)"
		// 		})
		// 		validateResults.push("("+stts[i]+"30m.buyAND"+stts[x]+"30m.buyAND"+stts[y]+"30m.buy)")
		// 	}
		// }
	}
}

// console.log(results)
// console.log(results.length)

// ./tbfix.sh sim binance.TRX-USDT --days 3 --strategies "sar.30m,trend_ema.20m,pivot.45m,momentum.45m,ehlers_ft.2m,macd.25m,macd.20m,kc.20m" --strategies_action_buy "((kc20m.buyOR(macd25m.buyANDmomentum45m.buyANDsar30m.buy))OR(trend_ema20m.buyORpivot45m.buyOR(ehlers_ft2m.buyANDmacd20m.buy)))" --strategies_action_sell "((kc20m.sellOR(macd25m.sellANDmomentum45m.sellANDsar30m.sell))OR(trend_ema20m.sellORpivot45m.sellOR(ehlers_ft2m.sellANDmacd20m.sell)))" --reverse --filename teste-reverse.html

console.log("#!/bin/bash")
let pair = process.argv[2] // "ADA-BRL"
console.log(`echo "" > ${pair}/simsresults_${pair}.txt`)
for(let k in results) {
	let result = results[k]
	let days = 3
	console.log(`echo SIMULATE_COMB: ${k} >> ${pair}/simsresults_${pair}.txt`)
	console.log(`./tbfix.sh sim binance.${pair} --days ${days} --strategies "${result.strategies}" --strategies_action_buy "${result.strategies_action_buy}" --strategies_action_sell "${result.strategies_action_sell}" --filename ${pair}/${k}.html | egrep "end balance|buy hold|trades over|error rate|SIMULATE_COMB" >> ${pair}/simsresults_${pair}.txt`)
	console.log(`echo SIMULATE_COMB REVERSE: ${k} >> ${pair}/simsresults_${pair}.txt`)
	console.log(`./tbfix.sh sim binance.${pair} --days ${days} --strategies "${result.strategies}" --strategies_action_buy "${result.strategies_action_buy}" --strategies_action_sell "${result.strategies_action_sell}" --reverse --filename ${pair}/${k}-reverse.html | egrep "end balance|buy hold|trades over|error rate|SIMULATE_COMB" >> ${pair}/simsresults_${pair}.txt`)
	console.log(`echo '---------- SIMULATE_COMB END -----------' >> ${pair}/simsresults_${pair}.txt`)
}
