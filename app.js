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

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

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
	    			name: groupDisplayName(groupGuests),
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

const groupDisplayName = (guests) => {
	if (guests.length == 1) {
		return guests[0].first_name + " " + guests[0].last_name
	} else {
		var name = groupGuests[0].first_name 
		if (guests[0].last_name != guests[1].last_name || !guests[1].is_primary_guest) {
			name = name + " " + guests[0].last_name;
		} 
		for (var i = 1; i < guests.length; i++) {
			if (guests[i].is_primary_guest) {
				name = name + " & " + guests[i].first_name + " " + guests[i].last_name
			} else {
				name = name + " & Family"
				break
			}
		}

		return name;
	} 
}