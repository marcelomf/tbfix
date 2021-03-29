module.exports = function api (conf) {
  let express = require('express')
  let app = express()
  let random_port = require('random-port')
  let path = require('path')
  let moment = require('moment')
  var tb = require('timebucket')
  var fs = require('fs')
  var collectionService = require('../../lib/services/collection-service')
  var engineFactory = require('../../lib/engine')
  var objectifySelector = require('../../lib/objectify-selector')
  var Excel = require('exceljs')

  let run = function(reporter, tradeObject) {
    if (!reporter.port || reporter.port === 0) {
      random_port({from: 20000}, function(port) {
        startServer(port, reporter.ip, tradeObject)
      })
    } else {
      startServer(reporter.port, reporter.ip, tradeObject)
    }

    // initReport("binance.ETH-USDT")

    // initTrade(tradeObject)
    // delete tradeObject.period
    // delete tradeObject.lookback
    // delete tradeObject.my_trades
    // delete tradeObject.my_prev_trades
    // initSelector("binance.XRP-USDT", "30m", 3, tradeObject, function(tradeObject){
    //   tradeObject.trades = []
    //   console.log(tradeObject.lookback[0])
    //   console.log(tradeObject.lookback[tradeObject.lookback.length-1])
    // })
  }

  let objectWithoutKey = (object, key) => {
    // eslint-disable-next-line no-unused-vars
    const {[key]: deletedKey, ...otherKeys} = object
    return otherKeys
  }

  // set up rate limiter: maximum of fifty requests per minute
  let RateLimit = require('express-rate-limit')
  let limiter = new RateLimit({
    windowMs: 1*60*1000, // 1 minute
    max: 50
  })

  function initTrade(tradeObject) {
    tradeObject.period = {
      period_id: '',
      size: 0,
      time: 0,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      close_time: 0
    }
    tradeObject.asset = ""
    tradeObject.currency = ""
    tradeObject.balance = {asset: 1, currency: 1}
    tradeObject.boot_time = new Date()
    tradeObject.my_trades = []
    tradeObject.lookback = []
    tradeObject.my_prev_trades = []
  }

  let startServer = function(port, ip, tradeObject) {
    tradeObject.port = port

    app.set('views', path.join(__dirname+'/../../templates'))
    app.set('view engine', 'ejs')

    app.use(limiter)
    app.use('/assets', express.static(__dirname+'/../../templates/dashboard_assets'))
    app.use('/assets-wp', express.static(__dirname+'/../../dist/'))
    app.use('/assets-zenbot', express.static(__dirname+'/../../assets'))

    app.get('/', function (req, res) {
      if(!tradeObject.period) {
        initTrade(tradeObject)
      }
      app.locals.moment = moment
      app.locals.deposit = tradeObject.options.deposit
      let datas = JSON.parse(JSON.stringify(objectWithoutKey(tradeObject, 'options'))) // deep copy to prevent alteration
      res.render('dashboard', datas)
    })

    app.get('/2', function (req, res) {
      if(!tradeObject.period)
        initTrade(tradeObject)
      app.locals.moment = moment
      app.locals.deposit = tradeObject.options.deposit
      let datas = JSON.parse(JSON.stringify(objectWithoutKey(tradeObject, 'options'))) // deep copy to prevent alteration
      res.render('dashboard2', datas)
    })

    app.get('/status', function (req, res) {
      let statusDir = "./status"
      let outHtml = `<html>
                      <body>
                        <table>
                          <thead>
                            <tr>
                              <th>Selector</th>
                              <th>Strategy</th>
                              <th>Status</th>
                              <th>Profit 5h</th>
                              <th>Profit Trade</th>
                            </tr>
                          </thead>
                          <tbody>
                          TBODY_CONTENT
                          </tbody>
                        </table>
                      </body>
                    </html>`
      let lines = ''
      let files = fs.readdirSync(statusDir)
      if(!files)
        return res.send("Sem arquivos")
      files.forEach(async file => {
        if(file.search(".json") < 0)
          return
        try {
          let fileContent = fs.readFileSync(statusDir+"/"+file, 'utf8')
          fileContent = fileContent.replace("{{{","{")
          fileContent = fileContent.replace("}}}","}")
          fileContent = fileContent.replace("{{","{")
          fileContent = fileContent.replace("}}","}")
          let status = JSON.parse(fileContent)
          lines = lines+`<tr>
                            <td>${status.selector}</td>
                            <td>${status.strategy}</td>
                            <td>${status.status}</td>
                            <td>${status.profit}</td>
                            <td>${status.profit_trade}</td>
                          </tr>`
        } catch (e) {
          console.log("Erro: "+e)
        }
      })
      outHtml = outHtml.replace("TBODY_CONTENT", lines)
      res.send(outHtml)
    })

    app.get('/trades', function (req, res) {
      res.send(objectWithoutKey(tradeObject, 'options'))
    })

    app.get('/trades2/:selector/:period/:days', function (req, res) {
      if(!req.params.selector)
        return res.send({})  
      if(!req.params.period)
        return res.send({})
      if(!req.params.days)
        return res.send({}) 
      initTrade(tradeObject)
      delete tradeObject.period
      delete tradeObject.lookback
      delete tradeObject.my_trades
      delete tradeObject.my_prev_trades
      initSelector(req.params.selector, req.params.period, parseInt(req.params.days), tradeObject, async function(tradeObject){
        tradeObject.trades = []
        tradeObject.my_trades = await initReport(req.params.selector)
        //console.log(tradeObject.my_trades)
        res.send(objectWithoutKey(tradeObject, 'options'))
      })
    })

    app.get('/csv/:selector/:period/:days', function (req, res) {
      if(!req.params.selector)
        return res.send({})  
      if(!req.params.period)
        return res.send({})
      if(!req.params.days)
        return res.send({}) 
      initTrade(tradeObject)
      delete tradeObject.period
      delete tradeObject.lookback
      delete tradeObject.my_trades
      delete tradeObject.my_prev_trades
      initSelector(req.params.selector, req.params.period, parseInt(req.params.days), tradeObject, async function(tradeObject){
        tradeObject.trades = []
        tradeObject.my_trades = await initReport(req.params.selector)

        let csvOutput = 'Date,Open,High,Low,Close,Adj Close,Volume'
        for(let i = tradeObject.lookback.length-1; i > 0; i--){
          csvOutput += "\n"+moment(tradeObject.lookback[i].close_time).format("YYYY-MM-DD HH:mm:ss")
                        +","+tradeObject.lookback[i].open
                        +","+tradeObject.lookback[i].high
                        +","+tradeObject.lookback[i].low
                        +","+tradeObject.lookback[i].close
                        +","+tradeObject.lookback[i].close
                        +","+tradeObject.lookback[i].volume
        }
        //console.log(csvOutput)
        res.send(csvOutput)
      })
    })

    app.get('/stats', function (req, res) {
      res.sendFile(path.join(__dirname+'../../../stats/index.html'))
    })

    if (ip && ip !== '0.0.0.0') {
      app.listen(port, ip)
      tradeObject.url = ip + ':' + port + '/'
    } else {
      app.listen(port)
      tradeObject.url = require('ip').address() + ':' + port + '/'
    }
    console.log('Web GUI running on http://' + tradeObject.url)
  }

  async function initReport(selector){

    function toDate(dateString) {
      return moment(dateString, 'YYYY-MM-DD HH:mm:ss').toDate().getTime()
    }

    const wb = new Excel.Workbook();
    var options = {
      dateFormats: ['DD/MM/YYYY'],
      dateUTC: false
    }
    var fileName = "./../extrato/OrderHistory.xlsx"
    await wb.xlsx.readFile(fileName, options)
    
    const ws = wb.getWorksheet('sheet1')
    if (!ws) {
      throw "Erro ao selecionar sheet"
    }
    
    var planilha = []
    
    ws.eachRow(function(row, rowNumber) {
      if(rowNumber <= 1)
        return
      newRow = {}
      row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
        if (cell.value && cell.value.result) {
          newRow[ws.getRow(1).getCell(colNumber)] = cell.value.result
        } else {
          newRow[ws.getRow(1).getCell(colNumber)] = cell.value
        }
      });
      planilha.push(newRow)
    });

    planilha = planilha.reverse()
    startMoney = 5000
    currentMoney = startMoney
    taxa = 0.075
    wins = 0
    losses = 0
    pairs = {}
    profitTmp = {}
    myTrades = []
    for(let i = 0; i < planilha.length; i++) {
      if(planilha[i]['Pair'] != selector.split(".")[1].replace("-",""))
        continue
      if(planilha[i]['Pair'].substr(-3) == "BTC") {
        if(!planilha[i]['Date(UTC)'] || planilha[i]['status'] == 'Canceled' || parseFloat(planilha[i]['Total']) < 0.006)
          continue
      } else {
        if(!planilha[i]['Date(UTC)'] || planilha[i]['status'] == 'Canceled' || parseFloat(planilha[i]['Total']) < 10)
          continue
      }
      if(!pairs[planilha[i]['Pair']])
        pairs[planilha[i]['Pair']] = { last_price_buy: 0, last_price_sell: 0, profits: [] }

      if(planilha[i]['Type'] == 'BUY') {
        pairs[planilha[i]['Pair']].last_price_buy = parseFloat(planilha[i]['Avg Trading Price'].replace(/[^0-9\.]+/g, ''))
        myTrades.push({type: "buy", price: pairs[planilha[i]['Pair']].last_price_buy, time: toDate(planilha[i]['Date(UTC)'])})
      } else if(planilha[i]['Type'] == 'SELL' && pairs[planilha[i]['Pair']].last_price_buy) {
        pairs[planilha[i]['Pair']].last_price_sell = parseFloat(planilha[i]['Avg Trading Price'].replace(/[^0-9\.]+/g, ''))
        myTrades.push({type: "sell", price: pairs[planilha[i]['Pair']].last_price_sell, time: toDate(planilha[i]['Date(UTC)'])})
        profitTmp = {
          date: planilha[i]['Date(UTC)'],
          buy: pairs[planilha[i]['Pair']].last_price_buy,
          sell: pairs[planilha[i]['Pair']].last_price_sell,
          profit: ((pairs[planilha[i]['Pair']].last_price_sell - pairs[planilha[i]['Pair']].last_price_buy)/pairs[planilha[i]['Pair']].last_price_buy*100),
          profit_fee: 0
        }
        profitTmp.profit_fee = profitTmp.profit - taxa
        if(profitTmp.profit_fee > 0)
          wins += 1
        else
          losses +=1
        pairs[planilha[i]['Pair']].profits.push(profitTmp)
        currentMoney += (currentMoney*((profitTmp.profit-taxa)/100))
        console.log(profitTmp.date+" - "+planilha[i]['Pair']+": "+profitTmp.profit+"("+profitTmp.profit_fee+") / "+currentMoney)
      }
    }
    return myTrades
  }

  function initSelector(selector, period, backDays, tradeObject, cb) {
    conf.so.period = period
    conf.so.period_length = period
    conf.so.min_periods = 10
    let qntPeriod = parseInt(period.substr(0, period.length-1))
    let subPeriod
    if(period.substr(-1) == "m") { // minutes
      subPeriod = 1440/qntPeriod
    } else { // hour
      subPeriod = 24/qntPeriod
    }
    if (!conf.so.min_periods) conf.so.min_periods = 1
    conf.so.selector = objectifySelector(selector || conf.selector)
    conf.selector = objectifySelector(selector || conf.selector)
    collectionService(conf)
    var db_cursor
    var query_start = tb().resize(conf.so.period_length).subtract(conf.so.min_periods * 2).subtract(backDays*subPeriod).toMilliseconds()
    var days = Math.ceil((new Date().getTime() - query_start) / 86400000)
    console.log("RECUPERANDO ("+selector+") DIAS: "+days)
    var engine = engineFactory(tradeObject, conf)
    var collectionServiceInstance = collectionService(conf)
    var trades = collectionServiceInstance.getTrades()

    function getNext () {
      var opts = {
        query: {
          selector: conf.so.selector.normalized
        },
        sort: {time: 1},
        limit: 1000
      }
      if (db_cursor) {
        opts.query.time = {$gt: db_cursor}
      }
      else {
        trade_cursor = tradeObject.exchange.getCursor(query_start)
        opts.query.time = {$gte: query_start}
      }
      //console.log(opts.query)
      //console.log("AQUI")
      trades.find(opts.query).limit(opts.limit).sort(opts.sort).toArray(function (err, trades) {
        //console.log("AQUI2")
        if (err) throw err
        if (!trades || !trades.length) {
          if(tradeObject.lookback.length > conf.so.keep_lookback_periods){
            tradeObject.lookback.splice(-1,1)
          }
          //setInterval(getNext, 1000)
          //getNext()
          //if(tradeObject.lookback && tradeObject.lookback.length >= 10)
          return cb(tradeObject)
          //else
            //return getNext()
        }
        db_cursor = trades[trades.length - 1].time
        trade_cursor = tradeObject.exchange.getCursor(trades[trades.length - 1])
        //console.log("AQUI3")
        engine.update(trades, true, function (err) {
          if (err) throw err
          //console.log("AQUI4")
          //setImmediate(getNext)
          //console.log("AQUI5")
          getNext()
        })
      })
    }
    getNext()
  }

  return {
    run: run
  }
}
