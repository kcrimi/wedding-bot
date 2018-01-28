const router = require('express').Router()
const rp = require('request-promise')
const AislePlanner = require('./aisle-planner.js')

router.get('/mail_list', (req, res) => {
	rp({
		uri: 'http://aisle-planner.herokuapp.com/guests?includeAddress=true',
		json: true
	})
	.then((result) => {
		let headers = "Name, Email, Address 1, Address 2, City, Region, Post Code, Country\r\n"
		let csvContent = result.reduce((csv, group) => {
			let row = [group.name, group.email, group.address.street, group.address.extended, group.address.city, group.address.region, group.address.postcode, group.address.country]
			let rowString = "\"" + row.join("\",\"") + '\"\r\n'
			if (!rowString.includes("Kevin Crimi") && !rowString.includes("EMAIL ")) {
				return csv += rowString
			}
			return csv
		}, headers)
		console.log(csvContent)
		res.send(csvContent)
	})
}) 

module.exports = router;