var output = require('../lib/output')
var minimist = require('minimist')
var path = require('path')

module.exports = function (program, conf) {
  program
    .command('www [selector]')
    .allowUnknownOption()
    .description('run trading bot against live market data')
    .option('--conf <path>', 'path to optional conf overrides file')
    .option('--strategy <name>', 'strategy to use', String, conf.strategy)
    .option('--order_type <type>', 'order type to use (maker/taker)', /^(maker|taker)$/i, conf.order_type)
    .option('--paper', 'use paper trading mode (no real trades will take place)', Boolean, true)
    .option('--reverse', 'use this and all your signals(buy/sell) will be switch! TAKE CARE!', Boolean, false)
    .option('--manual', 'watch price and account balance, but do not perform trades automatically', Boolean, false)
    .option('--non_interactive', 'disable keyboard inputs to the bot', Boolean, false)
    .option('--filename <filename>', 'filename for the result output (ex: result.html). "none" to disable', String, conf.filename)
    .option('--currency_capital <amount>', 'for paper trading, amount of start capital in currency', Number, conf.currency_capital)
    .option('--asset_capital <amount>', 'for paper trading, amount of start capital in asset', Number, conf.asset_capital)
    .option('--avg_slippage_pct <pct>', 'avg. amount of slippage to apply to paper trades', Number, conf.avg_slippage_pct)
    .option('--buy_pct <pct>', 'buy with this % of currency balance', Number, conf.buy_pct)
    .option('--deposit <amt>', 'absolute initial capital (in currency) at the bots disposal (previously --buy_max_amt)', Number, conf.deposit)
    .option('--sell_pct <pct>', 'sell with this % of asset balance', Number, conf.sell_pct)
    .option('--markdown_buy_pct <pct>', '% to mark down buy price', Number, conf.markdown_buy_pct)
    .option('--markup_sell_pct <pct>', '% to mark up sell price', Number, conf.markup_sell_pct)
    .option('--order_adjust_time <ms>', 'adjust bid/ask on this interval to keep orders competitive', Number, conf.order_adjust_time)
    .option('--order_poll_time <ms>', 'poll order status on this interval', Number, conf.order_poll_time)
    .option('--sell_cancel_pct <pct>', 'cancels the sale if the price is between this percentage (for more or less)', Number, conf.sell_cancel_pct)
    .option('--sell_stop_pct <pct>', 'sell if price drops below this % of bought price', Number, conf.sell_stop_pct)
    .option('--buy_stop_pct <pct>', 'buy if price surges above this % of sold price', Number, conf.buy_stop_pct)
    .option('--profit_stop_enable_pct <pct>', 'enable trailing sell stop when reaching this % profit', Number, conf.profit_stop_enable_pct)
    .option('--profit_stop_pct <pct>', 'maintain a trailing stop this % below the high-water mark of profit', Number, conf.profit_stop_pct)
    .option('--max_sell_loss_pct <pct>', 'avoid selling at a loss pct under this float', conf.max_sell_loss_pct)
    .option('--max_buy_loss_pct <pct>', 'avoid buying at a loss pct over this float', conf.max_buy_loss_pct)
    .option('--max_slippage_pct <pct>', 'avoid selling at a slippage pct above this float', conf.max_slippage_pct)
    .option('--rsi_periods <periods>', 'number of periods to calculate RSI at', Number, conf.rsi_periods)
    .option('--poll_trades <ms>', 'poll new trades at this interval in ms', Number, conf.poll_trades)
    .option('--currency_increment <amount>', 'Currency increment, if different than the asset increment', String, null)
    .option('--keep_lookback_periods <amount>', 'Keep this many lookback periods max. ', Number, conf.keep_lookback_periods)
    .option('--exact_buy_orders', 'instead of only adjusting maker buy when the price goes up, adjust it if price has changed at all')
    .option('--exact_sell_orders', 'instead of only adjusting maker sell when the price goes down, adjust it if price has changed at all')
    .option('--use_prev_trades', 'load and use previous trades for stop-order triggers and loss protection')
    .option('--min_prev_trades <number>', 'minimum number of previous trades to load if use_prev_trades is enabled, set to 0 to disable and use trade time instead', Number, conf.min_prev_trades)
    .option('--disable_stats', 'disable printing order stats')
    .option('--reset_profit', 'start new profit calculation from 0')
    .option('--use_fee_asset', 'Using separated asset to pay for fees. Such as binance\'s BNB or Huobi\'s HT', Boolean, false)
    .option('--interval_trade <minutes>', 'The interval trade time', Number, conf.interval_trade)
    .option('--quarentine_time <minutes>', 'For loss trade, set quarentine time for cancel buys', Number, conf.quarentine_time)
    .option('--run_for <minutes>', 'Execute for a period of minutes then exit with status 0', String, null)
    .option('--debug', 'output detailed debug info')
    .action(function (selector, cmd) {
      let raw_opts = minimist(process.argv)
      let s = {options: JSON.parse(JSON.stringify(raw_opts))}
      let so = s.options
      if (cmd.conf) {
        var overrides = require(path.resolve(process.cwd(), cmd.conf))
        Object.keys(overrides).forEach(function (k) {
          so[k] = overrides[k]
        })
      }
      Object.keys(conf).forEach(function (k) {
        if (typeof cmd[k] !== 'undefined') {
          so[k] = cmd[k]
        }
      })
      conf.so = so
      output(conf).initializeOutput(s)
    })
}

