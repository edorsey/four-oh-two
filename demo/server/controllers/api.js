let express = require("express")
let router = express.Router()
let fourOhTwo = require("../../../src/server-module")

const NANO_ACCOUNT = "xrb_3b3cfcn95mb96f1xfpjyj8cz5wkdhgmwh837xk94ndej9y46uyntkwckouni"

router.use(fourOhTwo({
  cost: "1000000000000000000000000000000",
  costPer: "access",
  currency: "NANO",
  serviceAccount: NANO_ACCOUNT,
  hostname: process.env.HOSTNAME,
  paymentManagerURI: "http://localhost:3402"
}))

router.get("/", function(req, res, next) {
  res.json("Hello world.")
})

function mount(app) {
  app.use("/api", router)
}

module.exports = mount
