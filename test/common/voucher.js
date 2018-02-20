let rewire = require("rewire")
let should = require('chai').should()
let {Wallet} = require("rai-wallet")

let voucher = rewire("../../src/common/voucher")

describe("#decode", () => {
  it("should equal true", () => true.should.equal(true))
})

describe("#encode", () => {
  it("should equal true", () => (true).should.equal(true))
})

describe("#createJWT", () => {
  let jwt
  let createJWT = voucher.__get__("createJWT")

  let wallet = Wallet("TEST")
  let seed = "504600C8AA15A2B3C745540CBF5C2ACAE95E6411F180C8FB0D1001E8E2A4FD31"

  wallet.createWallet(seed)

  let account = wallet.newKeyFromSeed()
  wallet.useAccount(account);
  console.log("WALLET", JSON.parse(wallet.decryptAndCheck(wallet.pack()).toString()))

  before(() => {
    jwt = createJWT({})
  })

  it("should equal true", () => {
    console.log("JWT", jwt)
  })
})
