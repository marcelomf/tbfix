var engine = module.exports = {}

var collection = require('../lib/services/collection')
		, tb = require('timebucket')
		, moment = require('moment')
		, spawn = require('child_process').spawn
		, path = require('path')
		, _ = require('lodash')
		, colors = require('colors')
		, notify = require('./notify')
		, n = require('numbro')
		, debug = require('./debug')
		, { formatAsset, formatPercent, formatCurrency } = require('./format')
		, clear = require('clear')
		, ora = require ('ora')

var conf, collectionInstance, s, trades
var ctxs = {}
const report = ora(('Starting the trade...').green)
const min_periods = 20 // ERA 50, testar...
const max_trades = 10000
const max_lookback = 10000
var nice_errors = new RegExp(/(slippage protection|loss protection)/)
var notifier

engine.start = async function(sParam, confParam, cb) {
	clear()
	s = sParam
	conf = confParam
	if(conf.mode == 'sim') {
		if (conf.start) {
			conf.start = moment(conf.start, 'YYYYMMDDhhmm').valueOf()
			if (conf.days && !conf.end) {
				conf.end = tb(conf.start).resize('1d').add(conf.days).toMilliseconds()
			}
		}
		if (conf.end) {
			conf.end = moment(conf.end, 'YYYYMMDDhhmm').valueOf()
			if (conf.days && !conf.start) {
				conf.start = tb(conf.end).resize('1d').subtract(conf.days).toMilliseconds()
			}
		}
		if (!conf.start && conf.days) {
			var d = tb('1d')
			conf.start = d.subtract(conf.days).toMilliseconds()
		}
	} else {
		conf.start = now()
	}
	collectionInstance = collection(conf)
	trades = collectionInstance.getTrades()
	s.min_periods = min_periods
	s.periods = {}
	s.trades = []
	s.product_id = conf.selector.product_id
  	s.asset = conf.selector.asset
	s.currency = conf.selector.currency
	s.my_trades = []
  	s.my_prev_trades = []
	s.vol_since_last_blink = 0
	s.day_count = 1
	if(_.isUndefined(s.exchange)){
    if (conf.mode !== 'live') {
      s.exchange = require(path.resolve(__dirname, '../exchanges/sim/exchange'))(conf, s)
    }
    else {
      s.exchange = require(path.resolve(__dirname, `../exchanges/${conf.selector.exchange_id}/exchange`))(conf)
    }
  }
  else if (conf.mode === 'paper') {
    s.exchange = require(path.resolve(__dirname, '../exchanges/sim/exchange'))(conf, s)
  }
  if (!s.exchange) {
    console.error('cannot trade ' + conf.selector.normalized + ': exchange not implemented')
    process.exit(1)
	}
	let products = s.exchange.getProducts()
  products.forEach(function (product) {
    if (product.asset === s.asset && product.currency === s.currency) {
      s.product = product
    }
	})
  if (!s.product) {
    console.error('error: could not find product "' + s.product_id + '"')
    process.exit(1)
	}
	notifier = notify(conf)
	s.balance = await s.exchange.getBalance({currency: s.currency, asset: s.asset})

	if (conf.mode !== 'sim') {
		pushMessage('Trade starting - Balance ' + s.exchange.name.toUpperCase(), ': ' + s.balance.asset + '(' + s.asset + ') / ' + s.balance.currency + '(' + s.currency  + ')\n')
	}

	initPeriods()
	await preroll()
	if(conf.mode == 'sim')
		cb()
	let first = true
	let runnig = true
	while(runnig) {
		let tradesResult = []
		if(first) {
			tradesResult = await s.exchange.getTrades({product_id: conf.selector.product_id, lastId: s.trades[s.trades.length-1].trade_id})
		} else {
			tradesResult = await s.exchange.getTrades({product_id: conf.selector.product_id})
		}
		first = false
		for(let i = 0; i < tradesResult.length; i++) {
			await updateTrade(tradesResult[i])
		}
		await sleep(5000)
	}
	cb()
}

function pushMessage(title, message) {
	if (conf.mode === 'live' || conf.mode === 'paper') {
		notifier.pushMessage(title, message)
	}
}

function now () {
	return new Date().getTime()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function initPeriods() {
	for(let i = 0; i < conf.strategies.length; i++) {
		s.periods[conf.strategies[i].period] = {period: {}, lookback: []}
	}

	for(period in s.periods) {
		for(let i = 0; i < conf.strategies.length; i++) {
			if(conf.strategies[i].name && period == conf.strategies[i].period) {
				s.periods[period][conf.strategies[i].name] = require(path.resolve(__dirname, `../strategies/${conf.strategies[i].name}/strategy`))
				s.periods[period][conf.strategies[i].name+"_options"] = { period: period, period_length: period, min_periods: min_periods }
				ctxs[period] = {}
				ctxs[period][conf.strategies[i].name] = {
					option: function (name, desc, type, def) {
						if (typeof s.periods[period][conf.strategies[i].name+"_options"][name] === 'undefined') {
							s.periods[period][conf.strategies[i].name+"_options"][name] = def
						}
					}
				}
				if (s.periods[period][conf.strategies[i].name].getOptions) {
					s.periods[period][conf.strategies[i].name].getOptions.call(ctxs[period][conf.strategies[i].name], s.periods[period])
				}
				// if (s.strategy.orderExecuted) {
				// 	eventBus.on('orderExecuted', function(type) {
				// 		s.strategy.orderExecuted(s, type, executeSignal)
				// 	})
				// }
			}
		}
	}
}

function backfill(days) {
	let promise = new Promise(function(resolve, reject) {
		var command_args = ['backfill', conf.selector.normalized, '--days', days || 1]
		var backfiller = spawn(path.resolve(__dirname, '..', "tbfix.sh"), command_args)
		backfiller.stdout.pipe(process.stdout)
		backfiller.stderr.pipe(process.stderr)
		backfiller.on('exit', function (code) {
			if (code) {
				process.exit(code)
			}
			resolve()
		})
	});
	return promise
}

async function preroll() {
	var queryStart, days, dbCursor
	for(periodLength in s.periods) {
		if(conf.start) {
			if(!queryStart || queryStart > tb(conf.start).resize(periodLength).subtract(min_periods * 2).toMilliseconds())
				queryStart = tb(conf.start).resize(periodLength).subtract(min_periods * 2).toMilliseconds()
		} else {
			if(!queryStart || queryStart > tb().resize(periodLength).subtract(min_periods * 2).toMilliseconds())
				queryStart = tb().resize(periodLength).subtract(min_periods * 2).toMilliseconds()
		}
	}
	days = Math.ceil((new Date().getTime() - queryStart) / 86400000)
	// need spawn for update in case of live/paper mode
	await backfill(days)
	var opts = {
		query: {
			selector: conf.selector.normalized
		},
		sort: {time: 1},
		limit: 1000
	}
	async function rollTrades(){
		if (dbCursor) {
			opts.query.time = {$gt: dbCursor}
		} else {
			opts.query.time = {$gte: queryStart}
		}
		let tradesResult = await trades.find(opts.query).limit(opts.limit).sort(opts.sort).toArray()
		for(let i = 0; i < tradesResult.length; i++) {
			await updateTrade(tradesResult[i], true)
		}
		if(tradesResult[tradesResult.length - 1] && tradesResult[tradesResult.length - 1].time)	dbCursor = tradesResult[tradesResult.length - 1].time
		if(tradesResult.length == opts.limit) {
			try {
				await rollTrades()
			} catch(e) {
				console.error(e)
			}
		}
	}
	await rollTrades()
}

function initPeriod(trade, period, prevPeriod) {
	report.start()
	report.text = 'Starting new period['+period+']\n'
	let d = tb(trade.time).resize(period)
	let de = tb(trade.time).resize(period).add(1)
	s.periods[period].period.period_id = d.toString()
	s.periods[period].period.size = period
	s.periods[period].period.time = d.toMilliseconds()
	s.periods[period].period.open = trade.price
	s.periods[period].period.high = trade.price
	s.periods[period].period.low = trade.price
	s.periods[period].period.close = trade.price
	s.periods[period].period.volume = trade.size
	s.periods[period].period.close_time = de.toMilliseconds() - 1
	if(prevPeriod && prevPeriod.bollinger_trend) {
		s.periods[period].period.bollinger_trend = prevPeriod.bollinger_trend
	}
}

async function syncBalance() {
	let pre_asset = conf.mode === 'sim' ? s.sim_asset : s.balance.asset
	s.balance = await s.exchange.getBalance({currency: s.currency, asset: s.asset})
	let diff_asset = n(pre_asset).subtract(s.balance.asset)
	s.quote = await s.exchange.getQuote({product_id: s.product_id})
	let post_currency = n(diff_asset).multiply(s.quote.ask)
	s.asset_capital = n(s.balance.asset).multiply(s.quote.ask).value()
	let deposit = conf.deposit ? Math.max(0, n(conf.deposit).subtract(s.asset_capital)) : s.balance.currency // zero on negative
	s.balance.deposit = n(deposit < s.balance.currency ? deposit : s.balance.currency).value()
	if (!s.start_capital) {
		s.start_price = n(s.quote.ask).value()
		s.start_capital = n(s.balance.deposit).add(s.asset_capital).value()
		s.real_capital = n(s.balance.currency).add(s.asset_capital).value()
		s.net_currency = s.balance.deposit

		if (conf.mode !== 'sim') {
			pushMessage('Balance ' + s.exchange.name.toUpperCase(), 'sync balance ' + s.real_capital + ' ' + s.currency  + '\n')
		}
	} else {
		s.net_currency = n(s.net_currency).add(post_currency).value()
	}
	return {balance: s.balance, quote: s.quote}
}

async function updatePeriod(trade, period) {
	s.periods[period].period.high = Math.max(trade.price, s.periods[period].period.high)
	s.periods[period].period.low = Math.min(trade.price, s.periods[period].period.low)
	s.periods[period].period.close = trade.price
	s.periods[period].period.volume += trade.size
	s.periods[period].period.latest_trade_time = trade.time
	for(period in s.periods) {
		for(let i = 0; i < conf.strategies.length; i++) {
			if(conf.strategies[i].name && period == conf.strategies[i].period) {
				await s.periods[period][conf.strategies[i].name].calculate(s.periods[period])
			}
		}
	}
	if (s.periods[period].trades && s.periods[period].last_trade_id !== trade.trade_id) {
		s.periods[period].last_trade_id = trade.trade_id
	}
}

async function updateTrade(trade, is_preroll) {
	var day = (new Date(trade.time)).getDate()
	if (s.last_day && day !== s.last_day) {
		s.day_count++
	}
	s.last_day = day
	
	if(s.trades.length >= max_trades)
		s.trades.shift()
	s.trades.push(trade)

	let orig_capital = s.orig_capital || s.start_capital
	orig_capital = orig_capital || s.balance.currency
	// console.log('ORIG')
	// console.log(s)
	let consolidated = n(s.net_currency).add(n(s.balance.asset).multiply(trade.price))
	// console.log('CONSOLIDATED')
	// console.log(consolidated)
	if(consolidated.value() == 0) {
		consolidated = orig_capital
	} else {
		consolidated = consolidated.value() - orig_capital
	}
	let profit = n(consolidated).divide(orig_capital)
	profit = n(profit).subtract(1)
	profit = n(profit).value()
	
	report.text = moment(trade.time).format("YYYY-MM-DD HH:mm:ss")+
		": Currency "+s.currency+" - Price "+s.asset+"["+trade.price+"]"+
		" Status["+s.action+"]"+` Consolidated[${consolidated}] Orig[${orig_capital}] NetC[${s.net_currency}] BalanceAsset[${s.balance.asset}]`+
		" Profit["+formatPercent(profit)[profit >= 0 ? 'green' : 'red']+"]"

	if(conf.mode !== 'live')
		s.exchange.processTrade(trade)

	if(s.buy_order)
		await checkOrder(s.buy_order, 'buy')
	else if(s.sell_order)
		await checkOrder(s.sell_order, 'sell')

	s.resultStrategies = {}
	for(let i = 0; i < conf.strategies.length; i++) {
		s.resultStrategies[conf.strategies[i].id] = {buy: false, sell: false, bollinger_trend: {buy: false, sell: false}}
	}
	s.in_preroll = is_preroll || (conf.start && trade.time < conf.start)
	for(period in s.periods) {
		if(!s.periods[period].period.period_id) {
			initPeriod(trade, period, null)
		} else {
			if (!s.periods[period].period.last_try_trade && !s.in_preroll) {
				s.periods[period].period.last_try_trade = now()
			}
			if(trade.time > s.periods[period].period.close_time ||
				(!s.in_preroll && conf.mode != 'sim' && 
					moment.duration(moment(now()).diff(s.periods[period].period.last_try_trade)).asMinutes() >= conf.interval_trade)) {	
				s.periods[period].period.last_try_trade = now()
				for(let i = 0; i < conf.strategies.length; i++) {
					if(conf.strategies[i].name && period == conf.strategies[i].period) {
						await s.periods[period][conf.strategies[i].name].onPeriod.call(ctxs[period][conf.strategies[i].name], s.periods[period])
						if(s.periods[period].signal != null) {
							if(s.periods[period].signal == 'buy') {
								s.resultStrategies[conf.strategies[i].id].buy = true
							} else if(s.periods[period].signal == 'sell') {
								s.resultStrategies[conf.strategies[i].id].sell = true
							}
						}
						if(s.periods[period].period.bollinger_trend) {
							if(s.periods[period].period.bollinger_trend == "buy") {
								s.resultStrategies[conf.strategies[i].id].bollinger_trend.buy = true
							} else if(s.periods[period].period.bollinger_trend == "sell") {
								s.resultStrategies[conf.strategies[i].id].bollinger_trend.sell = true
							}
						}
					}
				}
				if (trade.time > s.periods[period].period.close_time) {
					let copyPeriod = JSON.parse(JSON.stringify(s.periods[period].period))
					delete copyPeriod.lookback
					for(let i = 0; i < conf.strategies.length; i++) { 
						delete copyPeriod[conf.strategies[i].name]
						delete copyPeriod[conf.strategies[i].name+"_options"]
					}
					if(s.periods[period].lookback.length >= max_lookback)
						s.periods[period].lookback.pop()
					s.periods[period].lookback.unshift(copyPeriod)
					initPeriod(trade, period, copyPeriod)
				} else {
					await updatePeriod(trade, period)	
				}
			} else {
				await updatePeriod(trade, period) // call strategies calculate
			}
		}
	}
	if(!s.in_preroll || conf.mode == 'sim')
		await executeStop(true)
	if(!_.isEmpty(s.resultStrategies) && (!s.in_preroll || conf.mode == 'sim')) {
		let expBuy = conf.strategies_action.buy 
		let expSell = conf.strategies_action.sell
		for(let i = 0; i < conf.strategies.length; i++) {
			expBuy = expBuy.replace(conf.strategies[i].id, "s.resultStrategies."+conf.strategies[i].id)
			expSell = expSell.replace(conf.strategies[i].id, "s.resultStrategies."+conf.strategies[i].id)
		}
		let totalBuy = 0
		let totalSell = 0
		for(strategyId in s.resultStrategies) {
			if(s.resultStrategies[strategyId].buy)
				totalBuy += 1
			if(s.resultStrategies[strategyId].sell)
				totalSell += 1
		}
		try {
			if(eval(expBuy)) {
				// TO BUY
				await executeSignal('buy')
			} else if(eval(expSell)) {
				// TO SELL
				await executeSignal('sell')
			}
			s.resultStrategies = {}
			totalBuy = 0
			totalSell = 0
		} catch (e) {
			s.resultStrategies = {}
			totalBuy = 0
			totalSell = 0
			console.log("ERROOOOR:")
			console.log(expBuy)
			console.log(expSell)
			console.log(e)
			process.exit(-1)
		}
	}
}

async function executeStop (do_sell_stop) {
	let stop_signal
	if (s.my_trades.length || s.my_prev_trades.length) {
		var last_trade
		if (s.my_trades.length) {
			last_trade = s.my_trades[s.my_trades.length - 1]
		} else {
			last_trade = s.my_prev_trades[s.my_prev_trades.length - 1]
		}
		s.last_trade_worth = last_trade.type === 'buy' ? (s.trades[s.trades.length-1].price - last_trade.price) / last_trade.price : (last_trade.price - s.trades[s.trades.length-1].price) / last_trade.price		 
		if (last_trade.type === 'buy') {
			if (do_sell_stop && s.sell_stop_loss && s.trades[s.trades.length-1].price <= s.sell_stop_loss) {
				stop_signal = 'sell'
				console.log(('\nsell stop loss triggered at ' + formatPercent(s.last_trade_worth) + ' trade worth\n').red)
				//console.log(('\nprice: '+s.trades[s.trades.length-1].price+' sell_stop_gain:'+s.sell_stop_loss+'\n').red)
				s.stopTriggered = true
			} else if (do_sell_stop && s.sell_stop_gain && s.trades[s.trades.length-1].price >= s.sell_stop_gain) {
				stop_signal = 'sell'
				console.log(('\nsell stop gain triggered at ' + formatPercent(s.last_trade_worth) + ' trade worth\n').green)
				//console.log(('\nprice: '+s.trades[s.trades.length-1].price+' sell_stop_gain:'+s.sell_stop_gain+'\n').green)
			}
		}
	}
	if (stop_signal) {
		if(conf.reverse) {
			return {order: await executeSignal((stop_signal == 'sell') ? 'buy' : 'sell'), typeOrder: (stop_signal == 'sell') ? 'buy' : 'sell' }
		} else {
			return {order: await executeSignal(stop_signal), typeOrder: stop_signal }
		}
	}
}

function nextBuyForQuote(s, quote) {
	if (s.next_buy_price) {
		return n(s.next_buy_price).format(s.product.increment, Math.floor)
	}
	else {
		return n(quote.bid).format(s.product.increment, Math.floor)
	}
}

function nextSellForQuote(s, quote) {
	if (s.next_sell_price)
		return n(s.next_sell_price).format(s.product.increment, Math.ceil)
	else
		return n(quote.ask).format(s.product.increment, Math.ceil)
}

function isOrderTooSmall(product, quantity, price) {
	if (product.min_size && Number(quantity) < Number(product.min_size))
		return true
	if (product.min_total && n(quantity).multiply(price).value() < Number(product.min_total))
		return true
	return false
}

function getFee(so, buy_pct, s){
	if (so.use_fee_asset) {
		return 0
	} else if (so.order_type === 'maker' && (buy_pct + s.exchange.takerFee < 100 || !s.exchange.makerBuy100Workaround)) {
		return s.exchange.makerFee
	} else {
		return s.exchange.takerFee
	}
}

function getTradeableBalance(is_reorder, reorder_pct, so, s){
	let buy_pct, fee
	buy_pct = getBuyPct(is_reorder, reorder_pct, so)
	fee = getFee(so, buy_pct, s)
	return n(s.balance.deposit).divide(100 + fee).multiply(buy_pct)
}

function getTradeBalance(s, buy_pct){
	return n(s.balance.deposit).divide(100).multiply(buy_pct)
}

function getExpectedFee(trade_balance, tradeable_balance){
	return n(trade_balance).subtract(tradeable_balance).format('0.00000000', Math.ceil) // round up as the exchange will too
}

function getBuyPct(is_reorder, reorder_pct, so) {
	if (is_reorder) {
		return reorder_pct
	} else {
		return so.buy_pct
	}
}

function getSizeOfBuy(is_reorder, reorder_pct, so, s, price){
	let buy_pct, fee, trade_balance, tradeable_balance, expected_fee
	buy_pct = getBuyPct(is_reorder, reorder_pct, so)
	fee = getFee(so, buy_pct, s)
	trade_balance = getTradeBalance(s, buy_pct)
	tradeable_balance = getTradeableBalance(is_reorder, reorder_pct, so, s)
	expected_fee = getExpectedFee(trade_balance, tradeable_balance)
	if (buy_pct + fee < 100) {
		return n(tradeable_balance).divide(price).format(s.product.asset_increment ? s.product.asset_increment : '0.00000000')
	} else {
		return n(trade_balance).subtract(expected_fee).divide(price).format(s.product.asset_increment ? s.product.asset_increment : '0.00000000')
	}
}

function getSellPct(is_reorder, reorder_pct, so) {
	if (is_reorder) {
		return reorder_pct
	} else {
		return so.sell_pct
	}
}

function getSizeOfSell(is_reorder, reorder_pct, so, s) {
	let sell_pct
	sell_pct = getSellPct(is_reorder, reorder_pct, so)
	return n(s.balance.asset).multiply(sell_pct / 100).format(s.product.asset_increment ? s.product.asset_increment : '0.00000000')
}

function getReorderPct(signal, size, s) {
	if (signal === 'buy') {
		return n(size).multiply(s.buy_order.price).add(s.buy_order.fee).divide(s.balance.deposit).multiply(100)
	} else {
		return n(size).divide(s.balance.asset).multiply(100)
	}
}

// if s.signal
// 1. sync balance
// 2. get quote
// 3. calculate size/price
// 4. validate size against min/max sizes
// 5. cancel old orders
// 6. place new order
// 7. record order ID and start poll timer
// 8. if not filled after timer, repeat process
// 9. if filled, record order stats
async function executeSignal (signal, size, is_reorder, is_taker, reverseCalled) {
	if(conf.reverse && !reverseCalled && !size && !is_reorder) {
		console.log(('\nREVERSE SIGNAL MODE ON('+signal+' -> '+(signal == 'buy' ? 'sell' : 'buy')+')!\n').red)
		return await executeSignal(signal == 'buy' ? 'sell' : 'buy', size, is_reorder, is_taker, true)
	}
	// if(conf.mode == 'sim' && (s.sell_order || s.buy_order) && s.last_signal != signal) {
	//   console.log(('\nCANCEL SIGNAL SWITCH!\n').red)
	//   _cb && _cb(null, null)
	//   return
	// }
	if(s[(signal === 'buy' ? 'sell' : 'buy') + '_order']) {
		await cancelOrder(s[(signal === 'buy' ? 'sell' : 'buy') + '_order'], 'buy' ? 'sell' : 'buy', false)
		delete s[(signal === 'buy' ? 'sell' : 'buy') + '_order']
	}
	let price, expected_fee, trades
	s.last_signal = signal
	if (!is_reorder && s[signal + '_order']) {
		if (is_taker) s[signal + '_order'].order_type = 'taker'
		// order already placed
		return s[signal + '_order']
	}
	s.acted_on_trend = true
	let cb = function (err, order) {
		if (!order) {
			if (signal === 'buy') delete s.buy_order
			else delete s.sell_order
		}
		if (err) {
			if (err.message.match(nice_errors)) {
				console.error((err.message + ': ' + err.desc).red)
			} else {
				console.error('\n')
				console.error(err)
				console.error('\n')
			}
		}
		return order
	}
	let { balance, quote } = await syncBalance()
	let reorder_pct, fee, buy_pct, tradeable_balance, trade_balance
	if (is_reorder && s[signal + '_order']) {
		reorder_pct = getReorderPct(signal, size, s)
		debug.msg('price changed, resizing order, ' + reorder_pct + '% remain')
		size = null
	} else if(is_reorder) { // a reverse order deleted s[signal + '_order'], cancel signal!!!
		console.log("\nERROR IS REORDER\n")
		return null
		console.log(signal)
		console.log(s.buy_order)
		console.log(s.sell_order)
		process.exit(-1)
	}
	if (s.my_prev_trades.length) {
		trades = _.concat(s.my_prev_trades, s.my_trades)
	} else {
		trades = _.cloneDeep(s.my_trades)
	}
	if (signal === 'buy') {
		price = nextBuyForQuote(s, quote)
		buy_pct = getBuyPct(is_reorder, reorder_pct, conf)
		trade_balance = getTradeBalance(s, buy_pct)
		tradeable_balance = getTradeableBalance(is_reorder, reorder_pct, conf, s)
		size = getSizeOfBuy(is_reorder, reorder_pct, conf, s, price)
		expected_fee = getExpectedFee(trade_balance, tradeable_balance)

		if (isOrderTooSmall(s.product, size, price))
			return null

		if (s.product.max_size && Number(size) > Number(s.product.max_size)) {
			size = s.product.max_size
		}
		debug.msg('preparing buy order over ' + formatAsset(size, s.asset) + ' of ' + formatCurrency(tradeable_balance, s.currency) + ' tradeable balance with a expected fee of ' + formatCurrency(expected_fee, s.currency) + ' (' + fee + '%)')

		if(s.buy_quarentine_time && moment.duration(moment(now()).diff(s.buy_quarentine_time)).asMinutes() < conf.quarentine_time){
			console.log(('\nbuy cancel quarentine time: '+moment(s.buy_quarentine_time).format('YYYY-MM-DD HH:mm:ss')).red)
			return null
		}

		if (s.buy_order && conf.max_slippage != null) {
			let slippage = n(price).subtract(s.buy_order.orig_price).divide(s.buy_order.orig_price).multiply(100).value()
			if (conf.max_slippage != null && slippage > conf.max_slippage) {
				let err = new Error('\nslippage protection')
				err.desc = 'refusing to buy at ' + formatCurrency(price, s.currency) + ', slippage of ' + formatPercent(slippage / 100)
				return cb(err)
			}
		}
		if (n(s.balance.deposit).subtract(s.balance.currency_hold || 0).value() < n(price).multiply(size).value() && s.balance.currency_hold > 0) {
			debug.msg('buy delayed: ' + formatPercent(n(s.balance.currency_hold || 0).divide(s.balance.deposit).value()) + ' of funds (' + formatCurrency(s.balance.currency_hold, s.currency) + ') on hold')
			if(conf.mode == 'live')
				await sleep(3000)
			if (s.last_signal === signal) {
				return await executeSignal(signal, size, true)
			}
		} else {
			if(conf.notifiers && !conf.notifiers.only_completed_trades){
				pushMessage('Buying ' + formatAsset(size, s.asset) + ' on ' + s.exchange.name.toUpperCase(), 'placing buy order at ' + formatCurrency(price, s.currency) + ', ' + formatCurrency(quote.bid - Number(price), s.currency) + ' under best bid\n')
			}
			return await doOrder()
		}
	} else if (signal === 'sell') {
		price = nextSellForQuote(s, quote)
		size = getSizeOfSell(is_reorder, reorder_pct, conf, s)

		if (isOrderTooSmall(s.product, size, price))
			return null

		if (s.product.max_size && Number(size) > Number(s.product.max_size)) {
			size = s.product.max_size
		}

		let latest_high_buy = _.chain(trades).dropRightWhile(['type','sell']).takeRightWhile(['type','buy']).sortBy(['price']).reverse().head().value() // return highest price
		let sell_loss = latest_high_buy ? (Number(price) - latest_high_buy.price) / latest_high_buy.price * -100 : null
		if (latest_high_buy && conf.sell_cancel != null && Math.abs(sell_loss) < conf.sell_cancel) {
			console.log(('\nsell_cancel: refusing to sell at ' + formatCurrency(latest_high_buy.price, s.currency) + '-' + formatCurrency(price, s.currency) + ', sell loss of ' + formatPercent(sell_loss/100) + ' - ' + formatPercent(conf.sell_cancel/100)+'\n').red)
			return null
		}
		if (s.sell_order && conf.max_slippage != null) {
			let slippage = n(s.sell_order.orig_price).subtract(price).divide(price).multiply(100).value()
			if (slippage > conf.max_slippage) {
				let err = new Error('\nslippage protection')
				err.desc = 'refusing to sell at ' + formatCurrency(price, s.currency) + ', slippage of ' + formatPercent(slippage / 100)
				return cb(err)
			}
		}
		if (n(s.balance.asset).subtract(s.balance.asset_hold || 0).value() < n(size).value()) {
			debug.msg('sell delayed: ' + formatPercent(n(s.balance.asset_hold || 0).divide(s.balance.asset).value()) + ' of funds (' + formatAsset(s.balance.asset_hold, s.asset) + ') on hold')
			if(conf.mode == 'live')
				await sleep(3000)
			if (s.last_signal === signal) {
				return await executeSignal(signal, size, true)
			}
		} else {
			if(conf.notifiers && !conf.notifiers.only_completed_trades) {
				pushMessage('Selling ' + formatAsset(size, s.asset) + ' on ' + s.exchange.name.toUpperCase(), 'placing sell order at ' + formatCurrency(price, s.currency) + ', ' + formatCurrency(Number(price) - quote.bid, s.currency) + ' over best ask\n')
			}
			return await doOrder()
		}
	}
	async function doOrder() {
		let order = await placeOrder(signal, {
			size: size,
			price: price,
			fee: expected_fee || null,
			is_taker: is_taker,
			cancel_after: conf.cancel_after || 'day'
		})
		if (!order) {
			if (order === false) {
				// not enough balance, or signal switched.
				debug.msg('not enough balance, or signal switched, cancel ' + signal)
				return null
			}
			if (s.last_signal !== signal) {
				// order timed out but a new signal is taking its place
				debug.msg('signal switched, cancel ' + signal)
				return null
			}
			// order timed out and needs adjusting
			debug.msg(signal + ' order timed out, adjusting price')
			let remaining_size = s[signal + '_order'] ? s[signal + '_order'].remaining_size : size
			if (remaining_size !== size) {
				debug.msg('remaining size: ' + remaining_size)
			}
			return await executeSignal(signal, remaining_size, true)
		}
		return order
	}
} // end executeSignal

async function placeOrder (type, opts) {
	if (!s[type + '_order']) {
		s[type + '_order'] = {
			price: opts.price,
			size: opts.size,
			fee: opts.fee,
			orig_size: opts.size,
			remaining_size: opts.size,
			orig_price: opts.price,
			order_type: opts.is_taker ? 'taker' : conf.order_type,
			cancel_after: conf.cancel_after || 'day'
		}
	}
	let order = s[type + '_order']
	order.price = opts.price
	order.size = opts.size
	order.fee = opts.fee
	order.remaining_size = opts.size
	
	if (isNaN(order.size) || isNaN(order.price) || isNaN(order.fee)) {
		// treat as a no-op.
		debug.msg('invalid order for ' + type + ', aborting')
		return false
	}

	order.product_id = s.product_id
	order.post_only = conf.post_only
	debug.msg('placing ' + type + ' order...')
	let order_copy = JSON.parse(JSON.stringify(order))

	let api_order = await s.exchange[type](order_copy)
	s.api_order = api_order
	if (api_order.status === 'rejected') {
		if (api_order.reject_reason === 'post only') {
			// trigger immediate price adjustment and re-order
			debug.msg('post-only ' + type + ' failed, re-ordering')
			return null
		}
		else if (api_order.reject_reason === 'balance') {
			// treat as a no-op.
			debug.msg('not enough balance for ' + type + ', aborting')
			return false
		}
		else if (api_order.reject_reason === 'price') {
			// treat as a no-op.
			debug.msg('invalid price for ' + type + ', aborting')
			return false
		}
		err = new Error('\norder rejected')
		err.order = api_order
		return false
	}
	debug.msg(type + ' order placed at ' + formatCurrency(order.price, s.currency)+" - "+order.size)
	order.order_id = api_order.id
	if (!order.time) {
		order.orig_time = new Date(api_order.created_at).getTime()
	}
	order.time = new Date(api_order.created_at).getTime()
	order.local_time = now()
	order.status = api_order.status
	//console.log('\ncreated ' + order.status + ' ' + type + ' order: ' + formatAsset(order.size) + ' at ' + formatCurrency(order.price) + ' (total ' + formatCurrency(n(order.price).multiply(order.size)) + ')\n')
	return order
}

async function checkOrder (order, type) {
	// console.log("CAIU AUQI PORRA")
	if (!s[type + '_order']) {
		// signal switched, stop checking order
		debug.msg('signal switched during ' + type + ', aborting')
		return await cancelOrder(order, type, false)
	}
	let api_order = await s.exchange.getOrder({order_id: order.order_id, product_id: s.product_id})
	if(!api_order) {
		console.log("ERROR API ORDER:")
		console.log(order)
		console.log(api_order)
		process.exit(-1)
	}
	s.api_order = api_order
	order.status = api_order.status
	if (api_order.reject_reason) order.reject_reason = api_order.reject_reason
	if (api_order.status === 'done') {
		order.time = new Date(api_order.done_at).getTime()
		order.price = api_order.price || order.price // Use actual price if possible. In market order the actual price (api_order.price) could be very different from trade price
		await executeOrder(order, type)
		await syncBalance()
		return order
	}
	if (order.status === 'rejected' && (order.reject_reason === 'post only' || api_order.reject_reason === 'post only')) {
		debug.msg('post-only ' + type + ' failed, re-ordering')
		return null
	}
	if (order.status === 'rejected' && order.reject_reason === 'balance') {
		debug.msg('not enough balance for ' + type + ', aborting')
		return null
	}
	
	if (now() - order.local_time >= 5000) {
		let quote = await s.exchange.getQuote({product_id: s.product_id})
		let marked_price
		if (type === 'buy') {
			marked_price = nextBuyForQuote(s, quote)
			if (n(order.price).value() < marked_price) {
				debug.msg(marked_price + ' vs our ' + order.price)
				let returnCancel = await cancelOrder(order, type, true)
				delete s[type + '_order']
				return returnCancel
			} else {
				debug.msg("TIMEOUT FOR BUY CHECKORDER")
				order.local_time = now()
				// if(conf.mode == 'live')
				// 	sleep(3000)
				// return await checkOrder(order, type, true)
			}
		} else {
			marked_price = nextSellForQuote(s, quote)
			if (n(order.price).value() > marked_price) {
				debug.msg(marked_price + ' vs our ' + order.price)
				let returnCancel = await cancelOrder(order, type, true)
				delete s[type + '_order']
				return returnCancel
			} else {
				debug.msg("TIMEOUT FOR SELL CHECKORDER")
				order.local_time = now()
				// if(conf.mode == 'live')
				// 	sleep(3000)
				// return await checkOrder(order, type)
			}
		}
	} else {
 		// if(conf.mode == 'live')
	 	// 	await sleep(3000)
	 	// await checkOrder(order, type)
	}
	return order
}

function executeOrder(order, trade_type) {
	debug.msg('Executing ' + trade_type + ' order')
	let order_type = conf.order_type || 'maker'   // "maker" or "taker"
	let price = order.price
	let fee = 0
	let percentage_fee = 0
	if (order_type === 'maker' && s.exchange.makerFee)
		percentage_fee = s.exchange.makerFee
	else if (order_type === 'taker' && s.exchange.takerFee)
		percentage_fee = s.exchange.takerFee
	if (trade_type === 'sell')
		fee = n(order.size).multiply(percentage_fee / 100).multiply(price).value()
	else if (trade_type === 'buy')
		fee = n(order.size).multiply(percentage_fee / 100).value()

	s.action = trade_type === 'sell' ? 'sold' : 'bought'

	// Compute profit from the last order price.
	let rev_trade_type = trade_type == 'buy' ? 'sell' : 'buy'
	let last_rev_price_type = `last_${rev_trade_type}_price`
	let last_price_type = `last_${trade_type}_price`
	let previous_orders = s.my_prev_trades.filter(trade => trade.type == last_rev_price_type)
	if (!s[last_rev_price_type] && previous_orders.length) {
		let last_price = previous_orders[previous_orders.length -1].price
		s[last_rev_price_type] = last_price
	}
	let profit = s[last_rev_price_type] && (price - s[last_rev_price_type]) / s[last_rev_price_type]
	s.last_traded_price = price
	s[last_price_type] = price

	let my_trade = {
		order_id: order.order_id,
		time: order.time,
		execution_time: order.time - order.orig_time,
		slippage: trade_type === 'sell' ?
			n(order.orig_price).subtract(price).divide(price).value() :
			n(price).subtract(order.orig_price).divide(order.orig_price).value(),
		type: trade_type,
		size: order.orig_size,
		fee: fee,
		price: price,
		order_type: order_type,
		profit: profit
	}
	if (trade_type === 'buy')
		my_trade.cancel_after = conf.cancel_after || 'day'
	s.my_trades.push(my_trade)

	let execution_time = moment.duration(my_trade.execution_time).humanize()
	let completion_time = moment(order.time).format('YYYY-MM-DD HH:mm:ss')
	let asset_qty = formatAsset(my_trade.size, s.asset)
	let currency_price = formatCurrency(my_trade.price, s.currency)
	let total_price = formatCurrency(my_trade.size * my_trade.price, s.currency)
	let slippage = n(my_trade.slippage).format('0.0000%')
	let orig_price = formatCurrency(order.orig_price, s.currency)
	let order_complete = `\n${trade_type} order completed at ${completion_time}:\n` +
			`${asset_qty} at ${currency_price}\n` +
			`total ${total_price}\n` +
			`profit ${n(profit).format('0.00000%')}\n` +
			`${slippage} slippage (orig. price ${orig_price})\n` +
			`execution: ${execution_time}\n`
	console.log((order_complete).cyan)
	//saveStatus(trade_type)
	pushMessage(`${trade_type} ${s.exchange.name.toUpperCase()}`, order_complete)

	if(trade_type == 'sell' && !isNaN(profit) && profit <= 0) {
		s.buy_quarentine_time = now()
	}

	if (trade_type === 'buy')
		delete s.buy_order
	else
		delete s.sell_order

	delete s.sell_stop_loss
	delete s.sell_stop_gain
	if (trade_type === 'buy' && conf.stop_loss) {
		s.sell_stop_loss = n(price).subtract(n(price).multiply(conf.stop_loss / 100)).value()
	}
	if (trade_type === 'buy' && conf.stop_gain) {
		s.sell_stop_gain = n(price).add(n(price).multiply(conf.stop_gain / 100)).value()
	}
	debug.msg('Order ' + trade_type + ' executed!')
	//eventBus.emit('orderExecuted', trade_type)
}

async function cancelOrder(order, type, do_reorder) {
	await s.exchange.cancelOrder({order_id: order.order_id, product_id: s.product_id})
	async function checkHold (do_reorder) {
		let api_order = await s.exchange.getOrder({order_id: order.order_id, product_id: s.product_id})
		if (api_order) {
			if (api_order.status === 'done') {
				order.time = new Date(api_order.done_at).getTime()
				order.price = api_order.price || order.price // Use actual price if possible. In market order the actual price (api_order.price) could be very different from trade price
				debug.msg('cancel failed, order done, executing')
				await executeOrder(order, type)
				await syncBalance()
				return order
			}
			s.api_order = api_order
			if (api_order.filled_size) {
				order.remaining_size = n(order.size).subtract(api_order.filled_size).format(s.product.asset_increment ? s.product.asset_increment : '0.00000000')
			}
		}
		await syncBalance()
		let on_hold
		if (type === 'buy') on_hold = n(s.balance.deposit).subtract(s.balance.currency_hold || 0).value() < n(order.price).multiply(order.remaining_size).value()
		else on_hold = n(s.balance.asset).subtract(s.balance.asset_hold || 0).value() < n(order.remaining_size).value()

		if (on_hold && s.balance.currency_hold > 0) {
			// wait a bit for settlement
			debug.msg('funds on hold after cancel, waiting 5s')
			if(conf.mode == 'live')
				sleep(3000)
			return await checkHold(do_reorder)
		} else {
			// ORDER CANCELED
			delete s[type + '_order']
			return do_reorder ? null : false
		}
	}
	return await checkHold(do_reorder)
}
