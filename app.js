require('dotenv').config()
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const aislePlannerRoute = require('./aisle-planner.js')

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
	extended: true
}))

app.use('/', aislePlannerRoute)

app.listen(process.env.PORT || 3000, function () {
  console.log('Example app listening on port 3000!')
})

setInterval(function() {
    rp({uri:"https://aisle-planner.herokuapp.com/"})
}, 600000) // every 10 minutes (600000)