let express = require("express")
let router = express.Router()


router.get("/", authorizeHook, handleHook)

function authorizeHook(req, res, next) {
  console.log("DATA", req.body, req.query)
  return next()
}

function handleHook(req, res, next) {
  res.json({})
}

function mount(app) {
  app.use("/hook", router)
}

module.exports = mount
