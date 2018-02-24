let _ = require("lodash")
let BigNumber = require("bignumber.js")
let express = require("express")
let {Wallet} = require("rai-wallet")

let nanoAccounts = require("../config/nano-accounts")
let NanoClient = require("node-raiblocks-rpc")

const NANO_NODE_ADDRESS = "http://192.168.1.5:7076"
const nano = new NanoClient(NANO_NODE_ADDRESS, true)

let router = express.Router()

let serviceWallet = Wallet("TEST")
let serviceSeed = "5106F02332991576DC2A95DC74AB8B7F985F42382B8BAAE84FAA6794AE78851F"
serviceWallet.createWallet(serviceSeed)


router.post("/verify", verifyVoucher, verifyFunds, returnVerificationResult)
router.post("/use", verifyVoucher, verifyFunds, deductBalance, returnVoucherBalance)

function verifyVoucher(req, res, next) {
  let signatureChecksOut = serviceWallet.verifyVoucher(req.body.voucher, req.body.paymentAccountAddress)

  if (!signatureChecksOut) return next(new Error("Voucher failed signature verification."))

  let {voucher} = serviceWallet.decodeVoucher(req.body.voucher)

  if (nanoAccounts.indexOf(voucher.servicePaymentAccount) === -1) return next(new Error("servicePaymentAccount does not match an account managed by this server."))
  if (voucher.clientPaymentAccount !== req.body.paymentAccountAddress) return next(new Error("Client payment account addresses do not match."))

  req.voucher = voucher

  next()
}

function verifyFunds(req, res, next) {
  let {voucher} = req

  let servicePaymentAccount = nanoAccounts[0]

  nano.accounts_pending([servicePaymentAccount], 1, 100, true).then(function(pending) {
    console.log("PENDING", pending.blocks[servicePaymentAccount])

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

    if (voucherBlocks.length === 0) return next(new Error("No payment blocks found."))

    let {cost} = req.body

    let voucherBlock = voucherBlocks[0] //Need to support multiple at some point
    let voucherAmountUsed = 0

    console.log(cost, voucherBlock.amount, voucherAmountUsed, BigNumber(voucherBlock.amount).minus(voucherAmountUsed).toFormat(), cost > (voucherBlock.amount - voucherAmountUsed))

    if (cost > (Number(voucherBlock.amount) - voucherAmountUsed)) return next(new Error("Resource costs more than the value of the voucher."))

    return next()
  }).catch(next)
}

function returnVerificationResult(req, res, next) {
  res.json(req.voucher)
}

function deductBalance(req, res, next) {
  if (!req.body.cost) return next(new Error("Cost to deduct not supplied."))

  next()
}

function returnVoucherBalance(req, res, next) {

  res.json({})
}


function mount(app) {
  app.use("/voucher", router)
}

module.exports = mount
