var _ = require('lodash')
var path = require('path')
var fs = require('fs')
var minimist = require('minimist')
var version = require('./package.json').version

module.exports = function (cb) {
  var tbfix = { version }
  var args = minimist(process.argv.slice(3))
  var conf = {}
  var config = {}
  var overrides = {}

  module.exports.debug = args.debug

  // 1. load conf overrides file if present
  if(!_.isUndefined(args.conf)){
    try {
      overrides = require(path.resolve(process.cwd(), args.conf))
    } catch (err) {
      console.error(err + ', failed to load conf overrides file!')
    }
  }

  // 2. load conf.json if present
  try {
    conf = JSON.parse(fs.readFileSync('conf.json', 'utf8'));
  } catch (err) {
    console.error(err + ', falling back to conf-sample.json')
  }

  // 3. Load conf-sample.js and merge
  // var defaults = require('./conf-sample')
  // _.defaultsDeep(config, overrides, conf, defaults)
  tbfix.conf = conf

  var authStr = '', authMechanism, connectionString

  if(tbfix.conf.mongo.username){
    authStr = encodeURIComponent(zenbot.conf.mongo.username)

    if(tbfix.conf.mongo.password) authStr += ':' + encodeURIComponent(tbfix.conf.mongo.password)

    authStr += '@'

    // authMechanism could be a conf.js parameter to support more mongodb authentication methods
    authMechanism = tbfix.conf.mongo.authMechanism || 'DEFAULT'
  }

  if (tbfix.conf.mongo.connectionString) {
    connectionString = tbfix.conf.mongo.connectionString
  } else {
    connectionString = 'mongodb://' + authStr + tbfix.conf.mongo.host + ':' + tbfix.conf.mongo.port + '/' + tbfix.conf.mongo.db + '?' +
      (tbfix.conf.mongo.replicaSet ? '&replicaSet=' + tbfix.conf.mongo.replicaSet : '' ) +
      (authMechanism ? '&authMechanism=' + authMechanism : '' )
  }

  require('mongodb').MongoClient.connect(connectionString, { useNewUrlParser: true }, function (err, client) {
    if (err) {
      console.error('WARNING: MongoDB Connection Error: ', err)
      console.error('WARNING: without MongoDB some features (such as backfilling/simulation) may be disabled.')
      console.error('Attempted authentication string: ' + connectionString)
      cb(null, tbfix)
      return
    }
    var db = client.db(tbfix.conf.mongo.db)
    _.set(tbfix, 'conf.db.mongo', db)
    cb(null, tbfix)
  })
}
