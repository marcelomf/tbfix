var ta = require('talib')
var Phenotypes = require('../../lib/phenotype')

const CDLS = ['CDLABANDONEDBABY', 'CDL2CROWS','CDL3BLACKCROWS','CDL3INSIDE','CDL3LINESTRIKE','CDL3OUTSIDE','CDL3STARSINSOUTH','CDL3WHITESOLDIERS','CDLADVANCEBLOCK',
'CDLBELTHOLD','CDLBREAKAWAY','CDLCLOSINGMARUBOZU','CDLCONCEALBABYSWALL','CDLCOUNTERATTACK','CDLDOJI','CDLDOJISTAR','CDLDRAGONFLYDOJI','CDLENGULFING',
'CDLGAPSIDESIDEWHITE','CDLGRAVESTONEDOJI','CDLHAMMER','CDLHANGINGMAN','CDLHARAMI','CDLHARAMICROSS','CDLHIGHWAVE',
'CDLHIKKAKE','CDLHIKKAKEMOD','CDLHOMINGPIGEON','CDLIDENTICAL3CROWS','CDLINNECK','CDLINVERTEDHAMMER','CDLKICKING','CDLKICKINGBYLENGTH','CDLLADDERBOTTOM',
'CDLLONGLEGGEDDOJI','CDLLONGLINE','CDLMARUBOZU','CDLMATCHINGLOW','CDLONNECK','CDLPIERCING','CDLRICKSHAWMAN',
'CDLRISEFALL3METHODS','CDLSEPARATINGLINES','CDLSHOOTINGSTAR','CDLSHORTLINE','CDLSPINNINGTOP','CDLSTALLEDPATTERN','CDLSTICKSANDWICH','CDLTAKURI','CDLTASUKIGAP',
'CDLTHRUSTING','CDLTRISTAR','CDLUNIQUE3RIVER','CDLUPSIDEGAP2CROWS','CDLXSIDEGAP3METHODS']

const CDLS_BEST = ['CDL3INSIDE','CDL3LINESTRIKE','CDL3OUTSIDE','CDL3WHITESOLDIERS','CDLADVANCEBLOCK','CDLBELTHOLD','CDLCLOSINGMARUBOZU','CDLDOJISTAR',
'CDLDRAGONFLYDOJI','CDLENGULFING','CDLEVENINGDOJISTAR','CDLEVENINGSTAR','CDLGAPSIDESIDEWHITE','CDLHAMMER','CDLHARAMICROSS','CDLHIKKAKEMOD','CDLHOMINGPIGEON',
'CDLINVERTEDHAMMER','CDLLADDERBOTTOM','CDLLONGLINE','CDLMARUBOZU','CDLMATCHINGLOW','CDLMORNINGDOJISTAR','CDLMORNINGSTAR','CDLRISEFALL3METHODS','CDLSEPARATINGLINES',
'CDLSHOOTINGSTAR','CDLSTALLEDPATTERN','CDLTAKURI','CDLTRISTAR','CDLUNIQUE3RIVER','CDLXSIDEGAP3METHODS']

const CDLS_BEST_MMF = ['CDL3INSIDE','CDL3LINESTRIKE','CDL3OUTSIDE','CDL3WHITESOLDIERS','CDLADVANCEBLOCK','CDLCLOSINGMARUBOZU','CDLDOJISTAR',
'CDLDRAGONFLYDOJI','CDLEVENINGDOJISTAR','CDLEVENINGSTAR','CDLGAPSIDESIDEWHITE','CDLHAMMER','CDLHARAMICROSS','CDLHIKKAKEMOD','CDLHOMINGPIGEON',
'CDLINVERTEDHAMMER','CDLLADDERBOTTOM','CDLLONGLINE','CDLMARUBOZU','CDLMATCHINGLOW','CDLMORNINGDOJISTAR','CDLMORNINGSTAR','CDLRISEFALL3METHODS','CDLSEPARATINGLINES',
'CDLSHOOTINGSTAR','CDLSTALLEDPATTERN','CDLTAKURI','CDLTRISTAR','CDLUNIQUE3RIVER','CDLXSIDEGAP3METHODS']

const CDL_WITH_PENETRATION = ['CDLABANDONEDBABY', 'CDLDARKCLOUDCOVER', 'CDLEVENINGDOJISTAR', 'CDLEVENINGSTAR', 'CDLMATHOLD', 'CDLMORNINGDOJISTAR', 'CDLMORNINGSTAR'] 

async function taPromise(opts) {
  const promise = new Promise((resolve, reject) => {
    ta.execute(opts, function(err, resultTa) {
      // if(err) reject(new Error(err))
      if(err) reject(new Error(err))
      else resolve(resultTa)
    })
  })
  return promise
}


module.exports =  {
  name: 'candle',
  description: 'Candles...',

  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '30m')
    this.option('period_length', 'period length, same as --period', String, '30m')
    this.option('min_periods', 'min. number of history periods', Number, 15)
  },

  calculate: function () {
    // Calculations only done at the end of each period
  },

  onPeriod: async function (s, cb) {
    //if (s.lookback.length > s.options.min_periods) {
    if (s.lookback.length > 15) {
      var candlesticks = []

      var candlestick = {
        open: s.period.open,
        high: s.period.high,
        low: s.period.low,
        close: s.period.close,
        time: s.period.time / 1000
      }
      candlesticks.unshift(candlestick)

      s.lookback.slice(0, s.lookback.length).map(function (period) {
        var candlestick = {
          open: period.open,
          high: period.high,
          low: period.low,
          close: period.close,
          time: period.time / 1000
        }
        candlesticks.unshift(candlestick)
      })

      for(let cdl of CDLS_BEST_MMF) {
        // console.log("\n\nTENTANDO: "+cdl)
        let opts = {
          name: cdl,
          startIdx: 0,
          endIdx: candlesticks.length - 1,
          open: candlesticks.open,
          high: candlesticks.high,
          low: candlesticks.low,
          close: candlesticks.close
        }
        if(CDL_WITH_PENETRATION.includes(cdl)) opts.optInPenetration = 0
        try {
          let r = await taPromise(opts)
          if(r && r.result && r.result.outInteger && r.result.outInteger.length > 0) {
            // console.log(Number(resultTa.result.outInteger[resultTa.result.outInteger.length-1]))
            if(Number(r.result.outInteger[r.result.outInteger.length-1]) >= 80) {
              s.signal = 'buy'
              break
            } else if(Number(r.result.outInteger[r.result.outInteger.length-1]) <= -80) {
              s.signal = 'sell'
              break
            }
          }
        } catch(e) {
          console.error(e)
        }
      }
    }
    if(cb) cb()
  },

  onReport: function () {
    var cols = []
    return cols
  },

  phenotypes: {
    min_periods: Phenotypes.Range(30, 50),
  }
}

