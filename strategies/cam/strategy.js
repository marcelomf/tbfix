module.exports = {
  name: 'cam',
  description:
    'Cam - Camarilla points.',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '30m')
    this.option('period_length', 'period length, same as --period', String, '30m')
    this.option('min_periods', 'min. number of history periods', Number, 50)
  },

  // chamado primeiro, mas sem o lookback, trabalhar em s.period
  calculate: function(s) {
    var diff = s.period.high - s.period.low;
    var r4 = (diff * 1.1) / 2 + s.period.close;
    var r3 = (diff * 1.1) / 4 + s.period.close;
    var r2 = (diff * 1.1) / 6 + s.period.close;
    var r1 = (diff * 1.1) / 12 + s.period.close;
    var s1 = s.period.close - (diff * 1.1 / 12);
    var s2 = s.period.close - (diff * 1.1 / 6);
    var s3 = s.period.close - (diff * 1.1 / 4);
    var s4 = s.period.close - (diff * 1.1 / 2);
    elem = {r4: r4, r3: r3, r2: r2, r1: r1, s1: s1, s2: s2, s3: s3,
            s4: s4};
    s.period['cam'] = elem
  },

  onPeriod: function (s) {
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

