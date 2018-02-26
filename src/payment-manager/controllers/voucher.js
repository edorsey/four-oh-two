let _ = require("lodash")
let async = require("async")
let BigNumber = require("bignumber.js")
let express = require("express")
let {Block, Wallet} = require("rai-wallet")

let mongo = require("../services/mongo")
let MiddlewareError = require("../../common/middleware-error")
let nanoAccounts = require("../config/nano-accounts")
let NanoClient = require("node-raiblocks-rpc")

const NANO_NODE_ADDRESS = "http://192.168.1.206:7076"
const nano = new NanoClient(NANO_NODE_ADDRESS, true)

BigNumber.config({
  EXPONENTIAL_AT: [-20, 40]
})

let router = express.Router()

let serviceWallet = Wallet("TEST")
let serviceSeed = "5106F02332991576DC2A95DC74AB8B7F985F42382B8BAAE84FAA6794AE78851F"
serviceWallet.createWallet(serviceSeed)
serviceWallet.setMinimumReceive("1000000000000000000") //uxrb


router.post("/verify", verifyVoucher, getVoucherBlocks, getVoucherUsage, verifyFunds, processUsedBlock, returnVoucherBalance)
router.post("/use", verifyVoucher, getVoucherBlocks, getVoucherUsage, verifyFunds, deductCost, processUsedBlock, returnVoucherBalance)
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
          },
          /*'035EEE81C169ADA929513794C3BFEFE7E5C2F41CE320A2D58F7256418EE272E8': {
            amount: '32700000000000000000000000000000',
            source: voucher.clientPaymentAccount
          }*/
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
    "blocks.hash": { $in: blockHashes }
  }, { sort: { createdAt: -1 } }).toArray(function foundVoucherUsage(err, voucherUsage) {
    if (err) return next(err)

    req.voucher.blocks = _.map(req.voucher.blocks, (block) => {
      block.uses = []
      return block
    })

    if (!voucherUsage) return next()

    req.voucher.blocks = _.map(req.voucher.blocks, (block) => {
      let blockUses = _.reduce(voucherUsage, (blockUses, voucherUse) => {
        let blockUse = _.find(voucherUse.blocks, (voucherUseBlock) => voucherUseBlock.hash == block.hash)

        if (!blockUse) return blockUses

        blockUses.push({
          amount: blockUse.amount,
          createdAt: voucherUse.createdAt,
          resourceURI: voucherUse.resourceURI
        })

        return blockUses
      }, [])

      block.uses = blockUses

      return block
    })

    next()
  })
}

function calculateVoucherUsage(blocks) {
  return _.map(blocks, (block) => {
    block.amountUsed = _.reduce(block.uses, (totalAmountUsed, use) => {
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

  /*
  if (blocks.available.length === 0) {
    return next(new MiddlewareError("Resource costs more than the value of the voucher.", {statusCode: 402}))
  }
  */

  if (blocks.available.length > 0) voucher.block = blocks.available[0]
  if (blocks.used.length > 0 && blocks.used[0].amountLeft.isGreaterThan(0)) voucher.usedBlock = blocks.used[0]

  return next()
}


function deductCost(req, res, next) {
  if (!req.body.cost) return next(new MiddlewareError("Cost to deduct not supplied.", { statusCode: 400 }))
  if (!req.voucher.block) return next(new MiddlewareError("Refill your voucher with more NANO to continue using this endpoint.", { statusCode: 402 }))

  let {voucher} = req
  let cost = BigNumber(req.body.cost)

  let blockUse = {
    createdAt: new Date(),
    amount: cost
  }

  let usedBlockUse

  let use = _.assign({}, blockUse, {
    blocks: [{
      hash: voucher.block.hash,
      amount: cost
    }]
  })

  if (voucher.usedBlock) {
    usedBlockUse = _.assign({}, blockUse, {
      amount: voucher.usedBlock.amountLeft
    })

    use.blocks.push({
      hash: voucher.usedBlock.hash,
      amount: voucher.usedBlock.amountLeft
    })

    let remainingBalance = cost.minus(voucher.usedBlock.amountLeft)
    use.blocks[0].amount = remainingBalance
    blockUse.amount = remainingBalance
  }

  if (req.body.resourceURI) use.resourceURI = req.body.resourceURI

  let db = mongo.getDB()

  let rawUse = JSON.parse(JSON.stringify(use))

  db.collection("voucher-usage").insertOne(rawUse, (err, result) => {
    if (err) return next(err)
    voucher.block.uses.push(blockUse)
    if (usedBlockUse && voucher.usedBlock) {
      voucher.usedBlock.uses.push(usedBlockUse)
    }
    next()
  })
}

function refundBalance(req, res, next) {

  next()
}

function processUsedBlock(req, res, next) {
  console.log("PROCESS USED BLOCK", req.voucher)
  let {voucher} = req

  voucher.blocks = calculateVoucherUsage(voucher.blocks)

  let usedBlock
  console.log("1", voucher.usedBlock && voucher.usedBlock.amountLeft.isEqualTo(0))
  console.log("2", voucher.block && voucher.block.amountLeft.isEqualTo(0))

  if (voucher.usedBlock && voucher.usedBlock.amountLeft.isEqualTo(0)) {
    usedBlock = voucher.usedBlock
  }
  else if(voucher.usedBlock && !voucher.block) {
    usedBlock = voucher.usedBlock
  }
  else if (voucher.block && voucher.block.amountLeft.isEqualTo(0)) {
    usedBlock = voucher.block
  }
  else {
    return next()
  }


  let db = mongo.getDB()

  db.collection("used-blocks").find({
    "block.source": usedBlock.hash
  }).toArray(function(err, result) {
    if (err) return next(err)
    console.log("USED BLOCKS FIND", result)
    if (result.length > 0) return next(new MiddlewareError("Resource costs more than the value of the voucher. A refund has previously been initiated for your remaining balance.", {statusCode: 402}))

    let block = serviceWallet.addPendingReceiveBlock(usedBlock.hash, voucher.servicePaymentAccount, voucher.clientPaymentAccount, usedBlock.amount)

    let hash = block.getHash(true)

    async.waterfall([
      (cb) => {
        let usedBlock = {
          hash,
          block: JSON.parse(block.getJSONBlock())
        }

        db.collection("used-blocks").insertOne(usedBlock, function(err) {
          if (err) return cb(err)
          cb()
        })
      },
      (cb) => {
        nano.work_generate(block.getPrevious()).then(function(response) {
          block.setWork(response.work)
          return cb()
        })
        .catch(cb)
      },
      (cb) => {
        db.collection("used-blocks").findOneAndUpdate({
          hash: block.getHash(true)
        },
        { $set: { block: JSON.parse(block.getJSONBlock()) } },
        {new: true},
        function(err, result) {
          if (err) return cb(err)
          cb()
        })
      },
      (cb) => {
        let blockJSON = block.getJSONBlock()
        nano.process(blockJSON).then(function(response) {
          return cb(null, response)
        }).catch(cb)
      },
      (processBlockResult, cb) => {
        let update = {}

        if (processBlockResult.error) {
          update["$push"] = {
            errors: {
              error: processBlockResult.error,
              erroredAt: new Date()
            }
          }
        }
        else {
          update["$set"] = {
            processedAt: new Date()
          }
        }

        db.collection("used-blocks").findOneAndUpdate({
          hash: block.getHash(true)
        },
        update,
        {new: true},
        function(err, result) {
          if (err) return cb(err)
          cb()
        })
      },
      (cb) => {
        if (voucher.block) return cb(null, null)

        console.log("LETS REFUND SOME SHIT")

        nano.account_balance(voucher.servicePaymentAccount).then(function(response) {
          var refundBlock = new Block()
          var lastBlock = block.getHash(true)

          let balance = BigNumber(response.balance)

          refundBlock.setSendParameters(lastBlock, voucher.clientPaymentAccount, balance.minus(voucher.usedBlock.amountLeft))
    	    refundBlock.build()
    	    serviceWallet.signBlock(refundBlock)
    	    refundBlock.setAmount(voucher.usedBlock.amountLeft.toString())
    	    refundBlock.setAccount(voucher.servicePaymentAccount)

          return cb(null, refundBlock)

        })
        .catch(cb)
      },
      (refundBlock, cb) => {
        if (!refundBlock) return cb(null, null)

        nano.work_generate(refundBlock.getPrevious()).then(function(response) {
          refundBlock.setWork(response.work)
          return cb(null, refundBlock)
        })
        .catch(cb)
      },
      (refundBlock, cb) => {
        if (!refundBlock) return cb(null, null)

        let refundBlockJSON = refundBlock.getJSONBlock()
        console.log("REFUND", refundBlockJSON)
        nano.process(refundBlockJSON).then(function(response) {
          console.log("BLOCK PROCESS", response)
          return next(new MiddlewareError("Resource costs more than the value of the voucher. A refund has been initiated for your remaining balance.", {statusCode: 402}))
          return cb(null, response)
        })
        .catch(cb)
      }
    ], (err) => {
      if (err) next(err)
      next()
    })
  })
}

function returnVoucherBalance(req, res, next) {
  let {voucher} = req

  voucher.blocks = calculateVoucherUsage(voucher.blocks)
  voucher.balance = _.reduce(voucher.blocks, (totalAmountLeft, block) => { return totalAmountLeft.plus(block.amountLeft) }, BigNumber(0))

  res.json(voucher)
}


function mount(app) {
  app.use("/voucher", router)
}

module.exports = mount
