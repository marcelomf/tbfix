let convnetjs = require('convnetjs')
  , z = require('zero-fill')
  , n = require('numbro')
  , ema = require('../../lib/ema')
  , Phenotypes = require('../../lib/phenotype')
const cluster = require('cluster')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// the below line starts you at 0 threads
global.forks = 0
// the below line is for calculating the last mean vs the now mean.
var oldmean = 0
module.exports = {
  name: 'neural',
  description: 'Use neural learning to predict future price. Buy = mean(last 3 real prices) < mean(current & last prediction)',
  getOptions: function () {
    this.option('period', 'Period length - longer gets a better average', String, '30m')
    this.option('period_length', 'Period length set same as --period', String, '30m')
    this.option('activation_1_type', 'Neuron Activation Type: sigmoid, tanh, relu', String, 'sigmoid')
    this.option('neurons_1', 'Neurons in layer 1', Number, 5)
    this.option('activation_2_type', 'Neuron Activation Type: sigmoid, tanh, relu', String, 'sigmoid')
    this.option('neurons_2', 'Neurons in layer 2', Number, 5)
    this.option('depth', 'Generally the same as min_predict for accuracy', Number, 50)
    this.option('min_periods', 'Periods to train neural network with from', Number, 2000)
    this.option('min_predict', 'Periods to predict next number from less than min_periods', Number, 50)
    this.option('momentum', 'momentum of prediction between 0 and 1 - 0 is stock', Number, 0.0)
    this.option('decay', 'decay of prediction, use teeny tiny increments beteween 0 and 1 - stock', Number, 0.001)
    this.option('threads', 'Number of processing threads you\'d like to run (best for sim - Possibly broken', Number, 1)
    this.option('learns', 'Number of times to \'learn\' the neural network with past data', Number, 10)
    this.option('learningrate', 'The learning rate of the neural network between 0 and 1 - 0.01 is stock', Number, 0.01)
  },
  calculate: function () {
  },
  onPeriod: async function (s) {
    ema(s, 'neural_idx', s.neural_options.neural)
    if (s.neural_obj === undefined) {
      // Create the net the first time it is needed and NOT on every run
      s.neural_obj = {
        net : new convnetjs.Net(),
        layer_defs : [
          {type:'input', out_sx:5, out_sy:1, out_depth:s.neural_options.depth},
          {type:'fc', num_neurons: s.neural_options.neurons_1, activation: s.neural_options.activation_1_type},
          {type:'fc', num_neurons: s.neural_options.neurons_2, activation: s.neural_options.activation_2_type},
          {type:'regression', num_neurons:5}
        ],
        neuralDepth: s.neural_options.depth
      }
      s.neural_obj.net.makeLayers(s.neural_obj.layer_defs)
      s.neural_obj.trainer = new convnetjs.SGDTrainer(s.neural_obj.net, {learning_rate:s.neural_options.learningrate, momentum:s.neural_options.momentum, batch_size:1, l2_decay:s.neural_options.decay})
    }

    await sleep(10)

    if (cluster.isMaster) {
      ema(s, 'neural_idx', s.neural_options.neural)
      if (global.forks < s.neural_options.threads) { cluster.fork(); global.forks++ }
      cluster.on('exit', (code) => { process.exit(code) })
    }

    if (cluster.isWorker) {
      ema(s, 'neural_idx', s.neural_options.neural)
      var tlp = []
      var tll = []
      // this thing is crazy run with trendline placed here. But there needs to be a coin lock so you dont buy late!
      if (!s.in_preroll && s.lookback[s.neural_options.min_periods]) {
        var min_predict = s.neural_options.min_predict > s.neural_options.min_periods ? s.neural_options.min_periods : s.neural_options.min_predict
        for (let i = 0; i < s.neural_options.min_periods; i++) {
          tll.push(s.lookback[i])
        }
        for (let i = 0; i < min_predict; i++) {
          tlp.push(s.lookback[i])
        }
        var my_data = tll.reverse()
        var learn = function () {
          //Learns
          for (var j = 0; j < s.neural_options.learns; j++) {
            for (var i = 0; i < my_data.length - s.neural_obj.neuralDepth; i++) {
              var data = my_data.slice(i, i + s.neural_obj.neuralDepth)
              var real_value = my_data[i + s.neural_obj.neuralDepth]
              var x = new convnetjs.Vol(5, 1, s.neural_obj.neuralDepth, 0)

              for (var k = 0; k < s.neural_obj.neuralDepth; k++) {
                x.set(0,0,k,data[k].open)
                x.set(1,0,k,data[k].close)
                x.set(2,0,k,data[k].high)
                x.set(3,0,k,data[k].low)
                x.set(4,0,k,data[k].volume)
              }

              s.neural_obj.trainer.train(x, [real_value.open, real_value.close, real_value.high, real_value.low, real_value.volume])
            }
          }
        }
        var predict = function(data) {
          var x = new convnetjs.Vol(5, 1, s.neural_obj.neuralDepth, 0)

          for (var k = 0; k < s.neural_obj.neuralDepth; k++) {
            x.set(0,0,k,data[k].open)
            x.set(1,0,k,data[k].close)
            x.set(2,0,k,data[k].high)
            x.set(3,0,k,data[k].low)
            x.set(4,0,k,data[k].volume)
          }

          var predicted_value = s.neural_obj.net.forward(x)
          return predicted_value.w[1] // close value - x.set(1,0,k,data[k].close)
        }
        learn()
        var item = tlp.reverse()
        s.prediction = predict(item)
      }
      // NORMAL onPeriod STUFF here
      global.predi = s.prediction
      //something strange is going on here
      global.sig0 = global.predi > oldmean
      if (
        global.sig0 === false
      )
      {
        s.signal = 'sell'
      }
      else if
      (
        global.sig0 === true
      )
      {
        s.signal = 'buy'
      }
      oldmean = global.predi
    }
  },
  onReport: function () {
    // var cols = []
    // cols.push(z(8, n(global.predi).format('0000.000000000'), ' '))
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
    neurons_1: Phenotypes.Range(1, 20),
    neurons_2: Phenotypes.Range(1, 20),
    activation_1_type: Phenotypes.ListOption(['sigmoid', 'tanh', 'relu']),
    activation_2_type: Phenotypes.ListOption(['sigmoid', 'tanh', 'relu']),
    depth: Phenotypes.Range(1, 200),
    min_predict: Phenotypes.Range(1, 200),
    // momentum and decay and learning rate are decimals?
    momentum: Phenotypes.RangeFloat(0, 1),
    decay: Phenotypes.RangeFloat(0, 1),
    learns: Phenotypes.Range(1, 500),
    learningrate: Phenotypes.RangeFloat(0, 1)
  }
}
