let express = require("express")
let router = express.Router()
let fourOhTwo = require("../../../src/server")

router.use(fourOhTwo({
  cost: .0001,
  costPer: "access",
  currency: "NANO",
  accountAddress: "xrb_1234"
}))

/* GET users listing. */
router.get("/", function(req, res, next) {
  res.json({})
})

function mount(app) {
  app.use("/api", router)
}

module.exports = mount
