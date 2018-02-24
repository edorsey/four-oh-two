let express = require("express")
let router = express.Router()

let nanoAccounts = require("../config/nano-accounts")
let nano = require("../services/nano")

router.get("/:authToken?", authorizeHook, handleHook, respondOK)
router.post("/:authToken?", authorizeHook, handleHook, respondOK)

function authorizeHook(req, res, next) {
  return next()
}

function handleHook(req, res, next) {
  let {account, hash} = req.body

  let block = JSON.parse(req.body.block)

  if (nanoAccounts.indexOf(account) > -1) {
    nano.processBlock({account, hash, block})
    return next()
  }

  if (block.type === "send" && nanoAccounts.indexOf(block.destination) > -1) {
    nano.processBlock({account, hash, block})
    return next()
  }

  next()
}

function respondOK(req, res) {
  res.status(200).send("OK")
}

function mount(app) {
  app.use("/hook", router)
}

module.exports = mount
