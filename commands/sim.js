var minimist = require('minimist')
  , path = require('path')
  , fs = require('fs')
  , selector = require('../lib/selector')
  , engine = require('../lib/engine')
  , debug = require('../lib/debug')
  , colors = require('colors')
  , n = require('numbro')
  , collection = require('../lib/services/collection')

module.exports = function (program, conf) {
  program
    .command('sim [selector]')
    .allowUnknownOption()
    .description('run trading bot against live market data')
    .option('--conf <path>', 'path to optional conf overrides file')
    .option('--order_type <type>', 'order type to use (maker/taker)', /^(maker|taker)$/i, conf.order_type)
    .option('--filename <filename>', 'filename for the result output (ex: result.html). "none" to disable', String)
    .option('--reverse', 'use this and all your signals(buy/sell) will be switch! TAKE CARE!', Boolean, false)
    .option('--manual', 'watch price and account balance, but do not perform trades automatically', Boolean, false)
    .option('--deposit <amt>', 'absolute initial capital (in currency) at the bots disposal (previously --buy_max_amt)', Number, conf.deposit)
    .option('--buy_pct <pct>', 'buy with this % of currency balance', Number, conf.buy_pct)
    .option('--sell_pct <pct>', 'sell with this % of asset balance', Number, conf.sell_pct)
    .option('--sell_cancel <pct>', 'cancels the sale if the price is between this percentage (for more or less)', Number, conf.sell_cancel)
    .option('--stop_loss <pct>', 'sell if price drops below this % of bought price', Number, conf.stop_loss)
    .option('--stop_gain <pct>', 'sell if price drops below this % of bought price', Number, conf.stop_gain)
    .option('--max_slippage <pct>', 'avoid selling at a slippage pct above this float', conf.max_slippage)
    .option('--interval_trade <minutes>', 'The interval trade time', Number, conf.interval_trade)
    .option('--quarentine_time <minutes>', 'For loss trade, set quarentine time for cancel buys', Number, conf.quarentine_time)
    .option('--strategies <name.period,name2.period2,...>', 'Strategies in specific format!', String, conf.strategies)
    .option('--strategies_action_buy <(expression)>', 'Strategies action buy in specific format!', String)
    .option('--strategies_action_sell <(expression)>', 'Strategies action sell in specific format!', String)
    .option('--debug', 'output detailed debug info')
    .option('-d, --days <days>', 'number of days to acquire (default: ' + conf.days + ')', Number, conf.days)
    .action(function (selectorString, cmd) {  
      var raw_opts = minimist(process.argv)
      var s = {options: JSON.parse(JSON.stringify(raw_opts))}
      var so = s.options
      delete so._
      if (cmd.conf) {
        var overrides = require(path.resolve(process.cwd(), cmd.conf))
        Object.keys(overrides).forEach(function (k) {
          so[k] = overrides[k]
        })
      }
      Object.keys(so).forEach(function (k) {
        if (typeof so[k] !== 'undefined') {
          if(k == 'strategies') {
            conf[k] = []
            let stts = so[k].split(",")
            for(let i = 0; i < stts.length; i++) {
              let sttPeriod = stts[i].split(".")
              conf[k].push({id: sttPeriod[0]+sttPeriod[1], name: sttPeriod[0], period: sttPeriod[1]})
            }
          } else if(k == 'strategies_action_buy' || k == 'strategies_action_sell') {
            if(k == 'strategies_action_buy') {
              conf.strategies_action.buy = so[k]
            } else {
              conf.strategies_action.sell = so[k]
            }
          } else {
            conf[k] = so[k]
          }
        }
      })
      for(key in conf.strategies_action) {
        conf.strategies_action[key] = conf.strategies_action[key].replace(/AND/g, " && ")
        conf.strategies_action[key] = conf.strategies_action[key].replace(/OR/g, " || ")
        conf.strategies_action[key] = conf.strategies_action[key].replace(/NOT/g, " !")
      }
      conf.debug = cmd.debug
      conf.mode = 'sim'
      conf.selector = selector(selectorString || conf.selector)      
      var simResults = collection(conf).getSimResults()
      engine.start(s, conf, function(){	
        var option_keys = Object.keys(so)
        var output_lines = []
        option_keys.sort(function (a, b) {
          if (a < b) return -1
          return 1
        })
        var options = {}
        option_keys.forEach(function (k) {
          options[k] = so[k]
        })

        let options_output = options
        options_output.simresults = {}

        if (s.my_trades.length) {
          s.my_trades.push({
            price: s.trades[s.trades.length-1].price,
            size: s.balance.asset,
            type: 'sell',
            time: s.trades[s.trades.length-1].time
          })
        }
        s.balance.currency = n(s.net_currency).add(n(s.trades[s.trades.length-1].price).multiply(s.balance.asset)).format('0.00000000')
        s.balance.asset = 0
        var profit = s.start_capital ? n(s.balance.currency).subtract(s.start_capital).divide(s.start_capital) : n(0)
        output_lines.push('\nend balance: ' + n(s.balance.currency).format('0.00000000').yellow + ' (' + profit.format('0.00%') + ')')
        //console.log('start_capital', s.start_capital)
        //console.log('start_price', n(s.start_price).format('0.00000000'))
        //console.log('close', n(s.period.close).format('0.00000000'))
        var buy_hold = s.start_price ? n(s.trades[s.trades.length-1].price).multiply(n(s.start_capital).divide(s.start_price)) : n(s.balance.currency)
        //console.log('buy hold', buy_hold.format('0.00000000'))
        var buy_hold_profit = s.start_capital ? n(buy_hold).subtract(s.start_capital).divide(s.start_capital) : n(0)
        output_lines.push('buy hold: ' + buy_hold.format('0.00000000').yellow + ' (' + n(buy_hold_profit).format('0.00%') + ')')
        output_lines.push('vs. buy hold: ' + n(s.balance.currency).subtract(buy_hold).divide(buy_hold).format('0.00%').yellow)
        output_lines.push(s.my_trades.length + ' trades over ' + s.day_count + ' days (avg ' + n(s.my_trades.length / s.day_count).format('0.00') + ' trades/day)')
        var last_buy
        var losses = 0, sells = 0
        s.my_trades.forEach(function (trade) {
          if (trade.type === 'buy') {
            last_buy = trade.price
          }
          else {
            if (last_buy && trade.price < last_buy) {
              losses++
            }
            if(last_buy) {
              sells++
            }
          }
        })
        if (s.my_trades.length) {
          output_lines.push('win/loss: ' + (sells - losses) + '/' + losses)
          output_lines.push('error rate: ' + (sells ? n(losses).divide(sells).format('0.00%') : '0.00%').yellow)
        } else {
          output_lines.push('win/loss: null')
          output_lines.push('error rate: null')
        }
        options_output.simresults.start_capital = s.start_capital
        options_output.simresults.last_buy_price = s.last_buy_price
        options_output.simresults.last_assest_value = s.trades[s.trades.length-1].price
        options_output.net_currency = s.net_currency
        options_output.simresults.asset_capital = s.asset_capital
        options_output.simresults.currency = n(s.balance.currency).value()
        options_output.simresults.profit = profit.value()
        options_output.simresults.buy_hold = buy_hold.value()
        options_output.simresults.buy_hold_profit = buy_hold_profit.value()
        options_output.simresults.total_trades = s.my_trades.length
        options_output.simresults.length_days = s.day_count
        options_output.simresults.total_sells = sells
        options_output.simresults.total_losses = losses
        options_output.simresults.vs_buy_hold = n(s.balance.currency).subtract(buy_hold).divide(buy_hold).value() * 100.00

        let options_json = JSON.stringify(options_output, null, 2)
        if (so.show_options) {
          output_lines.push(options_json)
        }

        output_lines.forEach(function (line) {
          console.log(line)
        })

        if (conf.backtester_generation >= 0)
        {
          fs.writeFileSync(path.resolve(__dirname, '..', 'simulations','sim_'+conf.strategy.replace('_','')+'_'+ conf.selector.normalized.replace('_','').toLowerCase()+'_'+conf.backtester_generation+'.json'),options_json, {encoding: 'utf8'})
        }

        if (conf.filename !== 'none') {
          var html_output = output_lines.map(function (line) {
            return colors.stripColors(line)
          }).join('\n')
          let periodName
          for(period in s.periods) {
            periodName = period
          }
          var data = s.periods[periodName].lookback.slice(0, s.periods[periodName].lookback.length - s.min_periods).map(function (period) {
            var data = {}
            var keys = Object.keys(period)
            for(var i = 0;i < keys.length;i++){
              data[keys[i]] = period[keys[i]]
            }
            return data
          })
          var code = 'var data = ' + JSON.stringify(data) + ';\n'
          code += 'var trades = ' + JSON.stringify(s.my_trades) + ';\n'
          var tpl = fs.readFileSync(path.resolve(__dirname, '..', 'templates', 'sim_result.html.tpl'), {encoding: 'utf8'})
          var out = tpl
            .replace('{{code}}', code)
            .replace('{{trend_ema_period}}', conf.trend_ema || 36)
            .replace('{{output}}', html_output)
            .replace(/\{\{symbol\}\}/g,  conf.selector.normalized + ' - tbfix ' + require('../package.json').version)
          var out_target = so.filename || 'simulations/sim_result_' + conf.selector.normalized +'_' + new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/-/g, '').replace(/:/g, '').replace(/20/, '') + '_UTC.html'
          fs.writeFileSync(out_target, out)
          console.log('wrote', out_target)
        }

        simResults.save(options_output)
          .then(() => {
            process.exit(0)
          })
          .catch((err) => {
            console.error(err)
            process.exit(0)
          })
      })
    })
}

