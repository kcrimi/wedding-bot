const express = require('express')
const app = express()
const rp = require('request-promise')
const lodash = require('lodash')

const AISLE_PLANNER_HEADERS = {
	    	'X-XSRF-TOKEN': '6defb5fe6bb0a6476a6b011857329c2617af2a0f',
			'X-Requested-With': 'XMLHttpRequest',
			'X-AP-API-Version': '2017-06-12',
			'Cookie': 'session=89003d6bbd6a51dc3ccc10e98f1239f1e4266b76gAJVKGY5MDQ2NzFmY2U4YzE0ZjgyYTRkMzA2YTZmNDYxNDZiOTAwNjQ3OTFxAS4='
	    };

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.get('/guests', function(req, res) {
	const guestQuery = {
	    uri: 'https://www.aisleplanner.com/api/wedding/43499/guests',
	    headers: AISLE_PLANNER_HEADERS,
	    json: true // Automatically parses the JSON string in the response 
	};
	const groupsQuery = {
	    uri: 'https://www.aisleplanner.com/api/wedding/43499/guest_groups',
	    headers: AISLE_PLANNER_HEADERS,
	    json: true // Automatically parses the JSON string in the response 
	};
	rp(groupsQuery)
	    .then(function (groups) {
	    	const match = lodash.filter(groups, x => x.id === 1606652);

	    	res.send(match);
	    })
	    .catch(function (err) {
	        // API call failed... 
	    });
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
