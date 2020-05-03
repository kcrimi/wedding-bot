require('dotenv').config()
const express = require('express')
const app = express()
const rp = require('request-promise')
const bodyParser = require('body-parser')
const aislePlannerRoute = require('./aisle-planner.js')
const utilsRoute = require('./utils.js')

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
	extended: true
}))

// Just a dummy endpoint to call to keep the instance alive
app.get('/awake', (req, res) => {
	res.send('I\'m awake!')
})

app.use('/utils', utilsRoute)

app.use('/', aislePlannerRoute)

app.listen(process.env.PORT || 3000, function () {
  console.log('Example app listening on port 3000!')
})

// A Hack to get Heroku to not sleep our instance
// setInterval(function() {
//     rp({uri:"https://aisle-planner.herokuapp.com/awake"})
// }, 600000) // every 10 minutes (600000)
