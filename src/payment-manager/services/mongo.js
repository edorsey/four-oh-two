let url = require("url")
let MongoClient = require("mongodb").MongoClient

let connected = false
let database
let dbURI = process.env.MONGO_URI
let attempts = 0

function connect(cb) {
  attempts++

  if (connected && database) return cb(null, database)
  if (attempts > 5) return cb(new Error("Could not connect to DB, exceeded 5 retries"))

  let databaseName = url.parse(dbURI).pathname.replace(/^\//, "")

  MongoClient.connect(dbURI, function connected(err, client) {
    if (err) {
      if (err.message.indexOf("ECONNREFUSED") > -1) {
        return retry(cb)
      }
      return cb(err)
    }

    console.log("Connected correctly to server")

    connected = true
    database = client.db(databaseName)

    cb(null, database)
  })
}

function retry(cb) {
  setTimeout(function callRetry() {
    connect(cb)
  }, 1000)
}

function getDB() {
  return database
}

module.exports = {
  connect,
  getDB
}
