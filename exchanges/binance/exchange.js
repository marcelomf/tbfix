const path = require('path')
  , _ = require('lodash')
  , binanceApi = require('binance-api-node').default
  , moment = require('moment')

module.exports = function binance (conf) {
  var authed_client, public_client
  var lastTradeId = 0

  function authedClient () {
    if (!authed_client) {
      if (!conf.exchanges.binance || !conf.exchanges.binance.key || conf.exchanges.binance.key === 'YOUR-API-KEY') {
        throw new Error('please configure your Binance credentials in ' + path.resolve(__dirname, 'conf.js'))
      }
      authed_client = binanceApi({apiKey: conf.exchanges.binance.key, apiSecret: conf.exchanges.binance.secret, useServerTime: true})
      trade_count = 0
    }
    return authed_client
  }

  function publicClient () {
    if (!public_client) {
      public_client = binanceApi({apiKey: '', apiSecret: '', useServerTime: true})
      trade_count = 0
    }
    return public_client
  }

  /**
  * Convert BNB-BTC to BNBBTC
  *
  * @param product_id BNB-BTC
  * @returns {string}
  */
  function joinProduct(product_id) {
    let split = product_id.split('-')
    return split[0] + '' + split[1]
  }

  async function retry (method, args, err) {
    let promise = new Promise(function(resolve, reject) {
      if (method !== 'getTrades') {
        console.error(('\nBinance API is down! unable to call ' + method + ', retrying in 10s').red)
        if (err) console.error(err)
        console.error(args.slice(0, -1))
      }
      setTimeout(async function () {
        resolve(exchange[method].apply(exchange, args))
      }, 10000)
    })
    return promise
  }

  var orders = {}

  var exchange = {
    name: 'binance',
    historyScan: 'forward',
    historyScanUsesTime: true,
    makerFee: 0.075,
    takerFee: 0.075,

    getProducts: function () {
      return require('./products.json')
    },

    /*
    History mode:
    1 - Utilize aggTrades for recover id at the first trade
    2 - Utilize tradesHistory based on id recover in 1 step. (need authed)
    Live mode:
    1 - Utilizar trades ???
    2 - Utilizar ws.trades ???
    return every in ASC ORDER
    */
    getTrades: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        authedClient()
        publicClient()
        if(opts.from) { // history mode
          let aggTradesResult = await public_client.aggTrades({ symbol: joinProduct(opts.product_id), startTime: opts.from, endTime: opts.from + 3600000 })
          if(!aggTradesResult || !aggTradesResult[0] || !aggTradesResult[0].firstId) 
            return []
          let tradesResult = await authed_client.tradesHistory({ symbol: joinProduct(opts.product_id), fromId: aggTradesResult[0].firstId })
          let trades = tradesResult.map(trade => ({
            trade_id: trade.id,
            time: trade.time,
            size: parseFloat(trade.qty),
            price: parseFloat(trade.price),
            side: (trade.isBuyerMaker ? 'buy' : 'sell')
          }))
          if(trades && trades.length >= 1)
            lastTradeId = trades[trades.length-1].trade_id
          return trades
        } else if(opts.lastId) { // live mode
          let tradesResult = await authed_client.tradesHistory({ symbol: joinProduct(opts.product_id), fromId: opts.lastId })
          let trades = tradesResult.map(trade => ({
            trade_id: trade.id,
            time: trade.time,
            size: parseFloat(trade.qty),
            price: parseFloat(trade.price),
            side: (trade.isBuyerMaker ? 'buy' : 'sell')
          }))
          if(trades && trades.length >= 1)
            lastTradeId = trades[trades.length-1].trade_id
          return trades
        } else { // live mode
          let tradesResult = await public_client.trades({ symbol: joinProduct(opts.product_id) })
          let parcialTrades = tradesResult.map(trade => ({
            trade_id: trade.id,
            time: trade.time,
            size: parseFloat(trade.qty),
            price: parseFloat(trade.price),
            side: (trade.isBuyerMaker ? 'buy' : 'sell')
          }))
          let trades = []
          for(let i = 0; i < parcialTrades.length; i++) {
            if(parcialTrades[i].trade_id > lastTradeId) {
              trades.push(parcialTrades[i])
            }
          }
          if(trades && trades.length >= 1)
            lastTradeId = trades[trades.length-1].trade_id
          return trades
        }
      } catch(e) {
        console.error('An error occurred', e)
        return await retry('getTrades', func_args)
      }
    },

    getBalance: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        authedClient()
        let accountInfo = await authed_client.accountInfo()
        let balance = {asset: 0, currency: 0}
        for(let i = 0; i < accountInfo.balances.length; i++){
          if(accountInfo.balances[i].asset == opts.currency) {
            balance.currency = parseFloat(accountInfo.balances[i].free) + parseFloat(accountInfo.balances[i].locked)
            balance.currency_hold = parseFloat(accountInfo.balances[i].locked)
          } else if(accountInfo.balances[i].asset == opts.asset) {
            balance.asset = parseFloat(accountInfo.balances[i].free) + parseFloat(accountInfo.balances[i].locked)
            balance.asset_hold = parseFloat(accountInfo.balances[i].locked)
          }
        }
        return balance
      } catch(e) {
        console.error('An error occurred', e)
        return await retry('getBalance', func_args)
      }
    },

    getQuote: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        publicClient()
        // await client.allBookTickers()
        // client.ws.ticker
        let bookResult = await public_client.book({ symbol: joinProduct(opts.product_id) })
        return {bid: parseFloat(bookResult.bids[0].price), ask: parseFloat(bookResult.asks[0].price)}
      } catch(e) {
        console.error('An error occurred', e)
        return await retry('getQuote', func_args)
      }
    },

    getDepth: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        publicClient()
        let bookResult = await public_client.book({ symbol: joinProduct(opts.product_id) })
        result = []
        for(let i = 0; i < bookResult.bids.length; i++){
          if(bookResult.bids[i] && bookResult.asks[i]) {
            result.push({bid: parseFloat(bookResult.bids[i].price), ask: parseFloat(bookResult.asks[i].price)})
          }
        }
        return result
      } catch(e) {
        console.error('An error occurred', e)
        return await retry('getDepth', func_args)
      }
    },

    cancelOrder: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        authedClient()
        let cancelResult = await authed_client.cancelOrder({ symbol: joinProduct(opts.product_id), orderId: opts.order_id })
        // retorna cancelResult.status == CANCELED
        // console.log("CANCEL ORDER")
        // console.log(cancelResult)
        return null
      } catch(e) {
        console.error('An error occurred', e)
        console.error("CancelOrder: "+e.Error)
        return null
        return await retry('cancelOrder', func_args, e)
      }
    },

    buy: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        authedClient()
        if (typeof opts.post_only === 'undefined') {
          opts.post_only = true
        }
        opts.type = 'limit'
        var args = {}
        if (opts.order_type === 'taker') {
          delete opts.price
          delete opts.post_only
          opts.type = 'market'
          args.timeInForce = null
        } else {
          args.timeInForce = 'GTC'
        }
        opts.side = 'buy'
        // delete opts.order_type ITS CAUSE BUG?
        var order = {}
        // opts.price = String(Number(opts.price)) // bug binance precision
        let orderApi = await authed_client.order({ 
          symbol: joinProduct(opts.product_id),
          type: opts.type.toUpperCase(),
          side: opts.side.toUpperCase(),
          quantity: this.roundToNearest(opts.size, opts),
          price: opts.price,
          timeInForce: args.timeInForce
        })

        if(!orderApi || !orderApi.orderId) {
          order = {
            status: 'rejected',
            reject_reason: 'balance'
          }
          return order
        }
        order = {
          id: orderApi ? orderApi.orderId : null,
          status: 'open',
          price: opts.price,
          size: this.roundToNearest(opts.size, opts),
          post_only: !!opts.post_only,
          created_at: new Date().getTime(),
          filled_size: '0',
          ordertype: opts.order_type
        }
        orders['~' + orderApi.orderId] = order
        return order
      } catch(e) {
        console.error('An error occurred', e)
        return await retry('buy', func_args)
      }
    },

    sell: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        authedClient()
        if (typeof opts.post_only === 'undefined') {
          opts.post_only = true
        }
        opts.type = 'limit'
        var args = {}
        if (opts.order_type === 'taker') {
          delete opts.price
          delete opts.post_only
          opts.type = 'market'
          args.timeInForce = null
        } else {
          args.timeInForce = 'GTC'
        }
        opts.side = 'sell'
        // delete opts.order_type ITS CAUSE BUG?
        var order = {}
        // opts.price = String(Number(opts.price)) // bug binance precision
        let orderApi = await authed_client.order({ 
          symbol: joinProduct(opts.product_id),
          type: opts.type.toUpperCase(),
          side: opts.side.toUpperCase(),
          quantity: this.roundToNearest(opts.size, opts),
          price: opts.price,
          timeInForce: args.timeInForce
        })
        if(!orderApi || !orderApi.orderId) {
          order = {
            status: 'rejected',
            reject_reason: 'balance'
          }
          return order
        }
        order = {
          id: orderApi ? orderApi.orderId : null,
          status: 'open',
          price: opts.price,
          size: this.roundToNearest(opts.size, opts),
          post_only: !!opts.post_only,
          created_at: new Date().getTime(),
          filled_size: '0',
          ordertype: opts.order_type
        }
        orders['~' + orderApi.orderId] = order
        return order
      } catch(e) {
        console.error('An error occurred', e)
        return await retry('sell', func_args)
      }
    },

    roundToNearest: function(numToRound, opts) {
      var numToRoundTo = _.find(this.getProducts(), { 'asset': opts.product_id.split('-')[0], 'currency': opts.product_id.split('-')[1] }).min_size
      numToRoundTo = 1 / (numToRoundTo)

      return Number(parseFloat(Math.floor(numToRound * numToRoundTo) / numToRoundTo).toFixed(8)) // em compliance com a binance
    },

    getOrder: async function (opts) {
      var func_args = [].slice.call(arguments)
      try {
        authedClient()
        let order = orders['~' + opts.order_id]
        let orderApi = await authed_client.getOrder({symbol: joinProduct(opts.product_id), orderId: opts.order_id})
        // status == new || canceled || filled || partially_filled
        if(orderApi.status.toLowerCase() != 'new' && orderApi.status.toLowerCase() != 'canceled') {
          order.status = 'done'
          order.done_at = new Date().getTime()
          order.filled_size = parseFloat(orderApi.executedQty)
        }
        return order
      } catch(e) {
        console.error('An error occurred', e)
        return await retry('getOrder', func_args, e)
      }
    },

    getCursor: function (trade) {
      return (trade.time || trade)
    }
  }
  return exchange
}
