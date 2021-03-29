const Binance = require('binance-api-node').default
const moment = require('moment')

let conf = require('./conf.json')

const client = Binance({
  apiKey: conf.exchanges.binance.key,
  apiSecret: conf.exchanges.binance.secret
})

async function status(sym) {
    let myTrades = await client.myTrades({symbol: sym})
    myTrades = myTrades.reverse()
    for(let k in myTrades) {
        myTrades[k].time = moment(myTrades[k].time).format('YYYY-MM-DD HH:mm:ss')
    }
    // console.table(myTrades)
    let result = []
    for(let i = 0; i < myTrades.length; i++) {
        if(!myTrades[i].isBuyer) { // venda
            let objResult = { buyDate: null, sellDate: null, buyPrice: null, sellPrice: null, profit: null, buys: [], sells: [] }
            objResult.sells.push(myTrades[i])
            objResult.sellDate = myTrades[i].time
            let findBuy = false
            for(let x = i+1; x < myTrades.length; x++) {
                if(myTrades[x].isBuyer) { // compra
                    objResult.buys.push(myTrades[x])
                    objResult.buyDate = myTrades[x].time
                    findBuy = true
                } else if(!myTrades[x].isBuyer) { // venda
                    if(findBuy) {
                        result.push(JSON.parse(JSON.stringify(objResult)))
                        break
                    } else {
                        objResult.sells.push(myTrades[x])
                    }
                } else {
                    result.push(JSON.parse(JSON.stringify(objResult)))
                    break
                }
            }
        }
    }

    for(let k in result) {
        let totalBuys = 0
        let totalSells = 0
        for(let k1 in result[k].buys) {
            totalBuys += Number(result[k].buys[k1].price)
        }
        for(let k1 in result[k].sells) {
            totalSells += Number(result[k].sells[k1].price)
        }
        if(result[k].buys.length > 0) result[k].buyPrice = (totalBuys/result[k].buys.length)
        if(result[k].sells.length > 0) result[k].sellPrice = (totalSells/result[k].sells.length)

        if(result[k].buys.length > 0 && result[k].sells.length > 0) {
            result[k].profit = (Number(result[k].sellPrice)/Number(result[k].buyPrice)-1)*100
        }
    }

    console.table(result)
}

status(process.argv[2])