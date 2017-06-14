require('dotenv').config()
const express = require('express')
const app = express()
const rp = require('request-promise')
const _ = require('lodash')

const AISLE_PLANNER_HEADERS = {
	    	'X-XSRF-TOKEN': '6defb5fe6bb0a6476a6b011857329c2617af2a0f',
			'X-Requested-With': 'XMLHttpRequest',
			'X-AP-API-Version': process.env.API_VERSION,
			'Cookie': 'session='+process.env.SESSION,
	    };

app.get('/', function (req, res) {
  res.send("Hello World")
})

app.get('/guests', function(req, res) {
	const promises = []
	promises.push(rp({
	    uri: 'https://www.aisleplanner.com/api/wedding/43499/guests',
	    headers: AISLE_PLANNER_HEADERS,
	    json: true // Automatically parses the JSON string in the response 
	}));
	promises.push(rp({
	    uri: 'https://www.aisleplanner.com/api/wedding/43499/guest_groups',
	    headers: AISLE_PLANNER_HEADERS,
	    json: true // Automatically parses the JSON string in the response 
	}));
	Promise.all(promises)
	    .then(function (results) {
	    	const guests = results[0]
	    	const groups = results[1]
	    	const response = groups.map((group) => {
	    		groupGuests = _.filter(guests, guest => guest.group_id === group.id)
	    		groupGuests = _.sortBy(groupGuests, 'group_order');
	    		return {
	    			id: group.id,
	    			rsvp_id: group.rsvp_id,
	    			relationship_id: group.relationship_id,
	    			address: groupGuests[0].address,
	    			name: _.reduce(groupGuests, (name, guest, idx) => {
	    				if (idx > 0) {
	    					name += " & "
	    				}
	    				return name + guest.first_name + " " + guest.last_name
	    			},""),
	    			guests: groupGuests.map((guest) => {
	    				return guest.id
	    			})
	    		}
	    	})
	    	// const match = _.filter(groups, x => x.id === 1606652);

	    	res.send(response);
	    })
	    .catch(function (err) {
	        // API call failed... 
	    });
})

app.listen(process.env.PORT || 3000, function () {
  console.log('Example app listening on port 3000!')
})
