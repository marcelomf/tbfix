module.exports = {
  name: 'vpt',
  description:
    'Vpt - Volume Price Trend Indicator.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '30m')
    this.option('period_length', 'period length, same as --period', String, '30m')
    this.option('min_periods', 'min. number of history periods', Number, 50)
  },

  // chamado primeiro, mas sem o lookback, trabalhar em s.period
  calculate: function(s) {
    if(s.lookback && s.lookback[0] && s.lookback[0].vpt){
      //s.period.vpt = s.lookback[0].volume + s.period.volume * ((s.period.close - s.lookback[0].close)/s.lookback[0].close)
      s.period.vpt = s.lookback[0].vpt + s.period.volume * ((s.period.close - s.lookback[0].close)/s.lookback[0].close)
    } else if(s.lookback && s.lookback[0]){
      s.period.vpt = s.period.volume + s.period.volume * ((s.period.close - s.lookback[0].close)/s.lookback[0].close)
      // if(s.period.open > s.period.close)
      //   s.trend = 'down'
      // else
      //   s.trend = 'up'
    }
  },

  onPeriod: function (s) {
    if(s.lookback.length >= 1) {
      if(s.period.vpt > s.lookback[0].vpt) 
        s.trend = "up"
      else
        s.trend = "down"

      if(s.trend == 'up')
        s.signal = 'buy'
      else
        s.signal = 'sell'

    } 
  },

  onReport: function(s) {
    // var cols = []
    // if(s) {
    //   return cols
    // } else {
    //   return cols
    // }
  }
}

