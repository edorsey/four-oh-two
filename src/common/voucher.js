const R = require("ramda")
let jwt = require("jsonwebtoken")
let Wallet = require("rai-wallet")
let {addDays} = require("date-fns")
let blake = require("blakejs")
let nacl = require("tweetnacl/nacl") //We are using a forked version of tweetnacl, so need to import nacl


function btoa(str) {
  return new Buffer(str).toString("base64").replace(/\=+$/, "")
}

function encode(data) {
  return R.pipe(createJWT, signAndEncryptJWT)(data)
}

function decode(voucher) {
  return R.pipe(decrypt, verify, parseJWT)(data)
}

function createJWT(data) {
  let header = {
    typ: "JWT",
    alg: "x25519"
  }

  let tomorrow = 24 * 60 * 60 * 1000 + (new Date()).getTime()

  let empty = {
    hostname: "",
    exp: tomorrow
  }

  let payload = R.merge(empty, data)

  let encodeSection = R.pipe(JSON.stringify, btoa)

  let message = `${encodeSection(header)}.${encodeSection(payload)}`

  console.log("MESSAGE", message)

  return message
}

function signJWT(jwt) {

}

function verifyJWT(decryptedVoucher) {

}

function encrypt(jwt) {

}

function decrypt(voucher) {

}

function verifyVoucher(voucher) {

}

function parseJWT(jwt) {

}

module.exports = {
  encode,
  decode
}
