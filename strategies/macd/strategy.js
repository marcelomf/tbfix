var ema = require('../../lib/ema')
  , rsi = require('../../lib/rsi')
  , Phenotypes = require('../../lib/phenotype')

module.exports = {
  name: 'macd',
  description: 'Buy when (MACD - Signal > 0) and sell when (MACD - Signal < 0).',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '1h')
    this.option('period_length', 'period length, same as --period', String, '1h')
    this.option('min_periods', 'min. number of history periods', Number, 52)
    this.option('ema_short_period', 'number of periods for the shorter EMA', Number, 12)
    this.option('ema_long_period', 'number of periods for the longer EMA', Number, 26)
    this.option('signal_period', 'number of periods for the signal EMA', Number, 9)
    this.option('up_trend_threshold', 'threshold to trigger a buy signal', Number, 0)
    this.option('down_trend_threshold', 'threshold to trigger a sold signal', Number, 0)
    this.option('overbought_rsi_periods_macd', 'number of periods for overbought RSI', Number, 25)
    this.option('overbought_rsi_macd', 'sold when RSI exceeds this value', Number, 70)
  },

  calculate: function (s) {
    if (s.macd_options.overbought_rsi_macd) {
      // sync RSI display with overbought RSI periods
      s.macd_options.rsi_periods = s.macd_options.overbought_rsi_periods_macd
      rsi(s, 'overbought_rsi_macd', s.macd_options.overbought_rsi_periods_macd)
      if (!s.in_preroll && s.period.overbought_rsi_macd >= s.macd_options.overbought_rsi_macd && !s.overbought) {
        s.overbought = true
        //if (s.macd_options.mode === 'sim' && s.macd_options.verbose) console.log(('\noverbought at ' + s.period.overbought_rsi + ' RSI, preparing to sold\n').cyan)
      }
    }

    // compute MACD
    ema(s, 'ema_short', s.macd_options.ema_short_period)
    ema(s, 'ema_long', s.macd_options.ema_long_period)
    if (s.period.ema_short && s.period.ema_long) {
      s.period.macd = (s.period.ema_short - s.period.ema_long)
      ema(s, 'signal', s.macd_options.signal_period, 'macd')
      if (s.period.signal) {
        s.period.macd_histogram = s.period.macd - s.period.signal
      }
    }
  },

  onPeriod: function (s) {
    if (!s.in_preroll && typeof s.period.overbought_rsi_macd === 'number') {
      if (s.overbought) {
        s.overbought = false
        s.trend = 'overbought'
        s.signal = 'sell'
      }
    }

    if (typeof s.period.macd_histogram === 'number' && typeof s.lookback[0].macd_histogram === 'number') {
      if ((s.period.macd_histogram - s.macd_options.up_trend_threshold) > 0 && (s.lookback[0].macd_histogram - s.macd_options.up_trend_threshold) <= 0) {
        s.signal = 'buy'
      } else if ((s.period.macd_histogram + s.macd_options.down_trend_threshold) < 0 && (s.lookback[0].macd_histogram + s.macd_options.down_trend_threshold) >= 0) {
        s.signal = 'sell'
      } else {
        s.signal = null  // hold
      }
    }
  },

  onReport: function (s) {
    // var cols = []
    // if (typeof s.period.macd_histogram === 'number') {
    //   var color = 'grey'
    //   if (s.period.macd_histogram > 0) {
    //     color = 'green'
    //   }
    //   else if (s.period.macd_histogram < 0) {
    //     color = 'red'
    //   }
    //   cols.push(z(8, n(s.period.macd_histogram).format('+00.0000'), ' ')[color])
    //   cols.push(z(8, n(s.period.overbought_rsi_macd).format('00'), ' ').cyan)
    // }
    // else {
    //   cols.push('         ')
    // }
    // return cols
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 200),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1,20),

    // -- strategy
    ema_short_period: Phenotypes.Range(1, 20),
    ema_long_period: Phenotypes.Range(20, 100),
    signal_period: Phenotypes.Range(1, 20),
    up_trend_threshold: Phenotypes.Range(0, 50),
    down_trend_threshold: Phenotypes.Range(0, 50),
    overbought_rsi_periods_macd: Phenotypes.Range(1, 50),
    overbought_rsi_macd: Phenotypes.Range(20, 100)
  }
}

