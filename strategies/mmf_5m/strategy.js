var pivot = require('../pivot/strategy')
var macd = require('../macd/strategy')
var trend_ema = require('../trend_ema/strategy')

module.exports = {
  name: 'mmf_5m',
  description: 'Atualmente esta estrategia simplesmente utiliza: pivot macd ta_macd trend_ema.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '5m')
    this.option('period_length', 'period length, same as --period', String, '5m')
    
    // PIVOT
    // this.option('period_length', 'period length', String, '30m')
    this.option('min_periods', 'min periods', Number, 50)
    this.option('up', 'up', Number, 1)
    this.option('down','down', Number, 1)

    // MACD / TA_MACD
    //this.option('period', 'period length, same as --period_length', String, '1h')
    //this.option('period_length', 'period length, same as --period', String, '1h')
    //this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('ema_short_period', 'number of periods for the shorter EMA', Number, 12)
    this.option('ema_long_period', 'number of periods for the longer EMA', Number, 26)
    this.option('signal_period', 'number of periods for the signal EMA', Number, 9)
    this.option('up_trend_threshold', 'threshold to trigger a buy signal', Number, 0)
    this.option('down_trend_threshold', 'threshold to trigger a sold signal', Number, 0)
    this.option('overbought_rsi_periods', 'number of periods for overbought RSI', Number, 25)
    this.option('overbought_rsi', 'sold when RSI exceeds this value', Number, 70)

    // TREND_EMA
    // this.option('period', 'period length, same as --period_length', String, '2m')
    // this.option('period_length', 'period length, same as --period', String, '2m')
    // this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
    this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
    //this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 14)
    //this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)


  },

  calculate: function (s) {
    pivot.calculate(s)
    macd.calculate(s)
    trend_ema.calculate(s)
  },

  onPeriod: function (s, cb) {
    let totalBuy = 0
    let totalSell = 0
    if(s && s.lookback && s.lookback.constructor === Array && s.lookback.length > 5 && s.lookback[1].high && s.lookback[5].high) {
      pivot.onPeriod(s, function(){})
      if(s.signal == 'buy') 
        totalBuy += 1
      if(s.signal == 'sell') 
        totalSell += 1
    }
    macd.onPeriod(s, function(){})
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1
    trend_ema.onPeriod(s, function(){})
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1
    
    s.signal = null
    if(totalBuy >= 2 && totalBuy >= totalSell && totalSell == 0)
      s.signal = 'buy'
    if(totalSell >= 2 && totalSell >= totalBuy && totaBuy == 0)
      s.signal = 'sell'

    return cb()
  },

  onReport: function (s) {
    var cols = []
    return cols.concat(pivot.onReport(s), macd.onReport(s), trend_ema.onReport(s))
  }
}

