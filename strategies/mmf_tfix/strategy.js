var pivot = require('../pivot/strategy')
var macd = require('../macd/strategy')
var ehlers_ft = require('../ehlers_ft/strategy')
var momentum = require('../momentum/strategy')
var trendfix = require('../trendfix/strategy')

module.exports = {
  name: 'mmf_tfix',
  description: 'Atualmente esta estrategia simplesmente utiliza: pivot macd momentum ehlers_ft.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '30m')
    this.option('period_length', 'period length, same as --period', String, '30m')
    
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

    // ETHLERS_FT
    //this.option('period', 'period length, same as --period_length', String, '30m')
    //this.option('period_length', 'period length, same as --period', String, '30m')
    this.option('fish_pct_change', 'percent change of fisher transform for reversal', Number, 0)
    this.option('length', 'number of past periods to use including current', Number, 10)
    this.option('src', 'use period.close if not defined. can be hl2, hlc3, ohlc4, HAhlc3, HAohlc4', String, 'hl2')
    this.option('pos_length', 'check this number of previous periods have opposing pos value', Number, 1)

    // MOMENTUM
    //this.option('period', 'period length, same as --period_length', String, '1h')
    //this.option('period_length', 'period length, same as --period', String, '1h')
    this.option('momentum_size', 'number of periods to look back for momentum', Number, 5)


  },

  calculate: function (s) {
    pivot.calculate(s)
    macd.calculate(s)
    ehlers_ft.calculate(s)
    momentum.calculate(s)
    trendfix.calculate(s)
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
    ehlers_ft.onPeriod(s, function(){})
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1
    momentum.onPeriod(s, function(){})
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1
    trendfix.onPeriod(s, function(){})

    s.signal = null
    let go = false
    if(s.period.close <= s.period.trendfix*0.99)
      go = true
    // else if(s.period.trendfix - s.period.trendfix_start < 0 && s.period.close < s.period.trendfix)
    //   go = true
    if(go){
    //if((s.period.trendfix - s.period.trendfix_start >= 0) && s.period.close <= s.period.trendfix){
    //if((s.period.trendfix - s.period.trendfix_start >= 0)){
      if(totalBuy >= 2 && totalBuy >= totalSell && totalSell == 0) 
        s.signal = 'buy'
      if(totalSell >= 2 && totalSell >= totalBuy && totalBuy == 0)
        s.signal = 'sell'
    }


    return cb()
  },

  onReport: function (s) {
    var cols = []
    return cols.concat(pivot.onReport(s), macd.onReport(s), ehlers_ft.onReport(s), momentum.onReport(s), trendfix.onReport(s))
  }
}

