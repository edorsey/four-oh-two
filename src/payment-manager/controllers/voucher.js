let _ = require("lodash")
let BigNumber = require("bignumber.js")
let express = require("express")
let {Wallet} = require("rai-wallet")

let mongo = require("../services/mongo")
let MiddlewareError = require("../../common/middleware-error")
let nanoAccounts = require("../config/nano-accounts")
let NanoClient = require("node-raiblocks-rpc")

const NANO_NODE_ADDRESS = "http://192.168.1.5:7076"
const nano = new NanoClient(NANO_NODE_ADDRESS, true)

BigNumber.config({
  EXPONENTIAL_AT: [-20, 40]
})

let router = express.Router()

let serviceWallet = Wallet("TEST")
let serviceSeed = "5106F02332991576DC2A95DC74AB8B7F985F42382B8BAAE84FAA6794AE78851F"
serviceWallet.createWallet(serviceSeed)


router.post("/verify", verifyVoucher, getVoucherBlocks, getVoucherUsage, returnVerificationResult)
router.post("/use", verifyVoucher, getVoucherBlocks, getVoucherUsage, verifyFunds, deductCost, returnVoucherBalance)
router.post("/refund", verifyVoucher, verifyFunds, refundBalance, returnVoucherBalance)

function verifyVoucher(req, res, next) {

  try {
    serviceWallet.verifyVoucher(req.body.voucher, req.body.clientPaymentAccount)
  }
  catch(err) {
    return next(err)
  }

  let {voucher} = serviceWallet.decodeVoucher(req.body.voucher)

  if (nanoAccounts.indexOf(voucher.servicePaymentAccount) === -1) return next(new MiddlewareError("servicePaymentAccount does not match an account managed by this server.", {statusCode: 400}))
  if (voucher.clientPaymentAccount !== req.body.clientPaymentAccount) return next(new MiddlewareError("Client payment account addresses do not match.", {statusCode: 400}))

  req.voucher = voucher

  next()
}

function getVoucherBlocks(req, res, next) {
  let {voucher} = req
  let servicePaymentAccount = nanoAccounts[0]

  nano.accounts_pending([servicePaymentAccount], 1, 100, true).then(function(pending) {
    //Let's pretend...
    pending = {
      blocks: {
        xrb_1niabkx3gbxit5j5yyqcpas71dkffggbr6zpd3heui8rpoocm5xqbdwq44oh: {
          '025EEE81C169ADA929513794C3BFEFE7E5C2F41CE320A2D58F7256418EE272E8': {
            amount: '32700000000000000000000000000000',
            source: voucher.clientPaymentAccount
          }
        }
      }
    }

    let pendingBlocks = _.map(pending.blocks[servicePaymentAccount], (block, hash) => _.assign({}, block, {hash}))

    let voucherBlocks = _.filter(pendingBlocks, (block) => {
      return block.source === voucher.clientPaymentAccount
    })

    if (voucherBlocks.length === 0) return next(new MiddlewareError("No payment blocks found.", {statusCode: 401}))

    req.voucher.blocks = voucherBlocks

    next()
  })
  .catch(next)
}

function getVoucherUsage(req, res, next) {
  let blockHashes = _.map(req.voucher.blocks, "hash")

  let db = mongo.getDB()

  db.collection("voucher-usage").find({
    blockHash: { $in: blockHashes }
  }, { sort: { createdAt: -1 } }).toArray(function foundVoucherUsage(err, voucherUsage) {
    if (err) return next(err)

    req.voucher.blocks = _.map(req.voucher.blocks, (block) => {
      block.uses = []
      return block
    })

    if (!voucherUsage) return next()

    req.voucher.blocks = _.reduce(voucherUsage, (blocks, voucherUse) => {
      let block = _.find(blocks, (block) => block.hash === voucherUse.blockHash)

      block.uses.push(voucherUse)

      return blocks
    }, req.voucher.blocks)

    next()
  })
}

function calculateVoucherUsage(blocks) {
  return _.map(blocks, (block) => {
    block.amountUsed = _.reduce(block.uses, (totalAmountUsed, use) => {
      console.log("TOTAL AMOUNT USED", totalAmountUsed)
      return totalAmountUsed.plus(BigNumber(use.amount || 0))
    }, BigNumber(0))

    block.amountLeft = BigNumber(block.amount).minus(block.amountUsed)

    return block
  })
}

function verifyFunds(req, res, next) {
  let {voucher} = req

  let {cost} = req.body

  voucher.blocks = calculateVoucherUsage(voucher.blocks)

  let blocks = _.reduce(voucher.blocks, (blocks, block) => {
    if (block.amountLeft.isLessThan(BigNumber(cost))) {
      blocks.used.push(block)
    }
    else {
      blocks.available.push(block)
    }

    return blocks
  }, { used: [], available: [] })

  if (blocks.available.length === 0) {
    return next(new MiddlewareError("Resource costs more than the value of the voucher.", {statusCode: 402}))
  }

  voucher.block = blocks.available[0]

  return next()
}

function returnVerificationResult(req, res, next) {
  res.json(req.voucher)
}

function deductCost(req, res, next) {
  if (!req.body.cost) return next(new MiddlewareError("Cost to deduct not supplied.", { statusCode: 400 }))

  let {voucher} = req
  let {cost} = req.body

  let use = {
    blockHash: voucher.block.hash,
    amount: cost
  }

  let db = mongo.getDB()

  db.collection("voucher-usage").insertOne(use, (err, result) => {
    if (err) return next(err)
    voucher.block.uses.push(use)
    next()
  })
}

function refundBalance(req, res, next) {

  next()
}

function returnVoucherBalance(req, res, next) {
  let {voucher} = req

  voucher.blocks = calculateVoucherUsage(voucher.blocks)

  res.json(voucher)
}


function mount(app) {
  app.use("/voucher", router)
}

module.exports = mount
