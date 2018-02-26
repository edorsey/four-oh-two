let async = require("async")
let {Block} = require("rai-wallet")
let express = require("express")
let NanoClient = require("node-raiblocks-rpc")

let MiddlewareError = require("../../common/middleware-error")

const NANO_NODE_ADDRESS = "http://192.168.1.206:7076"
const nano = new NanoClient(NANO_NODE_ADDRESS, true)

let router = express.Router()

router.post("/", broadcastBlock)

function broadcastBlock(req, res, next) {
  let block = new Block()
  block.buildFromJSON(req.body.block)

  async.waterfall([
    (cb) => {
      nano.work_generate(block.getPrevious()).then(function(response) {
        block.setWork(response.work)
        return cb()
      })
      .catch(cb)
    },
    (cb) => {
      let blockJSON = block.getJSONBlock()
      nano.process(blockJSON).then(function(response) {
        if (response.error) return cb(new MiddlewareError(response.error, {statusCode: 400}))
        return next(err, response)
      })
      .catch(cb)
    }
  ], (err, response) => {
    if (err) return next(err)
    res.json(response)
  })
}

function mount(app) {
  app.use("/block", router)
}

module.exports = mount
