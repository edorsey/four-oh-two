let express = require("express")
let router = express.Router()

let nanoAccounts = require("../config/nano-accounts")
let nano = require("../services/nano")

router.get("/verify", authorizeHook, handleHook, respondOK)
router.post("/use", authorizeHook, handleHook, respondOK)


function mount(app) {
  app.use("/voucher", router)
}

module.exports = mount
