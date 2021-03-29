var minimist = require('minimist')
  , path = require('path')
  , selector = require('../lib/selector')
  , engine = require('../lib/engine')
  , debug = require('../lib/debug')

module.exports = function (program, conf) {
  program
    .command('trade [selector]')
    .allowUnknownOption()
    .description('run trading bot against live market data')
    .option('--conf <path>', 'path to optional conf overrides file')
    .option('--order_type <type>', 'order type to use (maker/taker)', /^(maker|taker)$/i, conf.order_type)
    .option('--paper', 'use paper trading mode (no real trades will take place)', Boolean, false)
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
    .option('--debug', 'output detailed debug info')
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
      conf.mode = conf.paper ? 'paper' : 'live'
      conf.selector = selector(selectorString || conf.selector)      
      engine.start(s, conf, function(){
        
      })
    })
}

