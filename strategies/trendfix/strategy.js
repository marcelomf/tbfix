module.exports = {
  name: 'trendfix',
  description:
    'Trendfix.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '30m')
    this.option('period_length', 'period length, same as --period', String, '30m')
    this.option('min_periods', 'min. number of history periods', Number, 50)
  },

  // chamado primeiro, mas sem o lookback, trabalhar em s.period
  calculate: function(s) {
    if(s)
      return
  },

  // { period_id: '30m860781',
  // size: '30m',
  // time: 1549405800000,
  // open: 0.00008627,
  // high: 0.00008647,
  // low: 0.00008624,
  // close: 0.00008645,
  // volume: 288025,
  // close_time: 1549407599999,
  // latest_trade_time: 1549407597240,
  // last_try_trade: 1549317600803,
  // rsi_avg_gain: 8.483961301843023e-8,
  // rsi_avg_loss: 5.885158741250213e-8,
  // rsi: 59.04 }

  onPeriod: function (s) {
    function toTimestamp(date) {
      return date
    }

    function getYValue(xValue, slope, intercept){
      return slope * xValue + intercept
    }

    if(s.lookback[s.trendfix_options.min_periods-1]){
    //if(s.lookback[3]){
      let count = 0
      let sumX = 0
      let sumX2 = 0
      let sumY = 0
      let sumXY = 0
      // X == data
      // Y == price

      for(let y = s.trendfix_options.min_periods-1; y > 0; y--){
        count += 1
        sumX += toTimestamp(s.lookback[y].close_time)
        sumX2 += toTimestamp(s.lookback[y].close_time) * toTimestamp(s.lookback[y].close_time)
        sumY += parseFloat(s.lookback[y].close)
        sumXY += toTimestamp(s.lookback[y].close_time) * parseFloat(s.lookback[y].close)
      }
      count += 1
      sumX += toTimestamp(s.period.close_time)
      sumX2 += toTimestamp(s.period.close_time) * toTimestamp(s.period.close_time)
      sumY += parseFloat(s.period.close)
      sumXY += toTimestamp(s.period.close_time) * parseFloat(s.period.close)

      let slope = (sumXY - ((sumX * sumY) / count)) / (sumX2 - ((sumX * sumX) / count))
      let intercept = (sumY / count) - (slope * (sumX / count))

      s.period.trendfix_start = getYValue(s.lookback[s.trendfix_options.min_periods-1].close_time, slope, intercept)
      s.period.trendfix = getYValue(s.period.close_time, slope, intercept)
      //console.log('TRENDFIX: '+s.period.close+' - ('+(s.period.trendfix-s.period.trendfix_start)+')'+s.period.trendfix+(s.period.close > s.period.trendfix ? ' VENDA' : ' COMPRA'))
    } 
  },

  onReport: function(s) {
    // var cols = []
    // if(s)
    //   return cols
    // else
    //   return cols
  }
}

