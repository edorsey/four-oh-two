let express = require("express")
let router = express.Router()

/* GET home page. */
router.get("/", function(req, res, next) {
  res.render("index", { title: "Express" })
})

function mount(app) {
  app.use(router)
}

module.exports = mount
