var sar = require('../sar/strategy')
var trend_ema = require('../trend_ema/strategy')
var speed = require('../speed/strategy')

var vv = module.exports = {
  name: 'mmf_fast',
  description: 'Atualmente esta estrategia simplesmente utiliza: sar trend_ema speed.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '2m')
    this.option('period_length', 'period length, same as --period', String, '2m')
    this.option('min_periods', 'min. number of history periods', Number, 52)
    
    // TREND_EMA
    // this.option('period', 'period length, same as --period_length', String, '2m')
    // this.option('period_length', 'period length, same as --period', String, '2m')
    // this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
    this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
    this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 14)
    this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)

    // SAR
    // this.option('period', 'period length, same as --period_length', String, '2m')
    // this.option('period_length', 'period length, same as --period', String, '2m')
    // this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('sar_af', 'acceleration factor for parabolic SAR', Number, 0.015)
    this.option('sar_max_af', 'max acceleration factor for parabolic SAR', Number, 0.3)

    // SPEED
    // this.option('period', 'period length, same as --period_length', String, '1m')
    // this.option('period_length', 'period length, same as --period', String, '1m')
    // this.option('min_periods', 'min. number of history periods', Number, 3000)
    this.option('baseline_periods', 'lookback periods for volatility baseline', Number, 50)
    this.option('trigger_factor', 'multiply with volatility baseline EMA to get trigger value', Number, 1.6)

  },

  fix_options: function(s) {
    s.trend_ema_options = s.mmf_fast_options
    s.sar_options = s.mmf_fast_options
    s.speed_options = s.mmf_fast_options
  },

  calculate: function (s) {
    vv.fix_options(s)
    trend_ema.calculate(s)
    if(s && s.lookback && s.lookback.constructor === Array && s.lookback.length > 1 && s.lookback[1].high)
      sar.calculate(s)
    speed.calculate(s)
  },

  onPeriod: function (s) {
    vv.fix_options(s)
    let totalBuy = 0
    let totalSell = 0
    trend_ema.onPeriod(s)
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1
    sar.onPeriod(s)
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1
    speed.onPeriod(s)
    if(s.signal == 'buy') 
      totalBuy += 1
    if(s.signal == 'sell') 
      totalSell += 1

    s.signal = null
    if(totalBuy >= 2 && totalBuy >= totalSell && totalSell == 0)
      s.signal = 'buy'
    if(totalSell >= 2 && totalSell >= totalBuy && totalBuy == 0)
      s.signal = 'sell'
  },

  onReport: function (s) {
    // var cols = []
    // return cols.concat(trend_ema.onReport(s), sar.onReport(s), speed.onReport(s))
  }
}

