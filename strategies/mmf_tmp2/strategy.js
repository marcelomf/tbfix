var pivot = require('../pivot/strategy')
var trend_ema = require('../trend_ema/strategy')
var Phenotypes = require('../../../lib/phenotype')

module.exports = {
  name: 'mmf_tmp2',
  description: 'Atualmente esta estrategia simplesmente utiliza: pivot trend_ema.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '30m')
    this.option('period_length', 'period length, same as --period', String, '30m')
    this.option('min_periods', 'min. number of history periods', Number, 52)
    
    // TREND_EMA
    // this.option('period', 'period length, same as --period_length', String, '2m')
    // this.option('period_length', 'period length, same as --period', String, '2m')
    // this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
    this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
    this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 14)
    this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)

    // PIVOT
    // this.option('period_length', 'period length', String, '30m')
    //this.option('min_periods', 'min periods', Number, 50)
    this.option('up', 'up', Number, 1)
    this.option('down','down', Number, 1)

  },

  calculate: function (s) {
    trend_ema.calculate(s)
    pivot.calculate(s)
  },

  onPeriod: function (s, cb) {
    let totalBuy = 0
    let totalSell = 0
    trend_ema.onPeriod(s, function(){})
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1
    if(s && s.lookback && s.lookback.constructor === Array && s.lookback.length > 5 && s.lookback[1].high && s.lookback[5].high){
      pivot.onPeriod(s, function(){})
      if(s.signal == 'buy') 
        totalBuy += 1
      if(s.signal == 'sell') 
        totalSell += 1
    }

    s.signal = null
    if(totalBuy >= 1 && totalBuy >= totalSell && totalSell == 0)
      s.signal = 'buy'
    if(totalSell >= 1 && totalSell >= totalBuy && totalBuy == 0)
      s.signal = 'sell'

    if(s.signal == 'buy' && s.stopTriggered) {
      s.stopTriggered = false
    }

    if(s.signal == 'sell' && s.stopTriggered) {
      console.log("\nCANCEL AÇÃO: "+s.signal+" PRICE: "+s.period.close)
      s.signal = null
    }

    return cb()
  },

  onReport: function (s) {
    var cols = []
    return cols.concat(trend_ema.onReport(s), pivot.onReport(s))
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 60, 'm'),
    min_periods: Phenotypes.Range(1, 100),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    //sell_stop_pct: Phenotypes.Range0(1, 50),
    //buy_stop_pct: Phenotypes.Range0(1, 50),
    //profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    //profit_stop_pct: Phenotypes.Range(1,20),
    sell_stop_pct: Phenotypes.RangeFloat(0.4, 0.6),
    //profit_stop_enable_pct: Phenotypes.RangeFloat(0.5, 1),
    //quarentine_time: Phenotypes.ListOption([240, 270, 300]),
    
    // -- strategy
    trend_ema: Phenotypes.Range(1, 40),
    oversold_rsi_periods: Phenotypes.Range(5, 50),
    oversold_rsi: Phenotypes.Range(20, 100)
  }
}

