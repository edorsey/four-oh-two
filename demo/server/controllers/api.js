let express = require("express")
let router = express.Router()
let fourOhTwo = require("../../../src/server-module")

router.use(fourOhTwo({
  cost: .0001,
  costPer: "access",
  currency: "NANO",
  serviceAccount: process.env.NANO_ACCOUNT,
  hostname: process.env.HOSTNAME
}))

router.get("/", function(req, res, next) {
  res.json("Hello world.")
})

function mount(app) {
  app.use("/api", router)
}

module.exports = mount
