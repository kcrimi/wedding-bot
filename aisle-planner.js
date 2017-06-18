const router = require('express').Router()
const rp = require('request-promise')
const setCookie = require('set-cookie-parser')
const _ = require('lodash')
const BASE_URL = 'https://www.aisleplanner.com/api'
const WEDDING_URL = BASE_URL + '/wedding/'+process.env.WEDDING_ID
var sessionId

const getAislePlannerHeaders = (withCookie) => {
	const aislePlannerHeaders = {
	    	'X-XSRF-TOKEN': '6defb5fe6bb0a6476a6b011857329c2617af2a0f',
			'X-Requested-With': 'XMLHttpRequest',
			'X-AP-API-Version': process.env.API_VERSION,
	    };
	if (withCookie) {
		aislePlannerHeaders.Cookie = 'session=' + sessionId
	}
	return aislePlannerHeaders
}

router.get('/', function (req, res) {
  res.send("Hello World")
})

// Check if session is valid
router.use(function (req, res, next) {
	console.log("KEVIN CHECK")
	rp({
		uri: BASE_URL+'/notifications/checkin',
		headers: getAislePlannerHeaders(true),
		json: true
	})
	.then(function (response) {
		console.log('CHECKINS PASSED')
		return
	}, function (error) {
		console.log("KEVIN NOT LOGGED IN")
		if (error.statusCode != 401) {
			res.status(error.statusCode).send(error)
		}
		return updateSession()
	})
	.then(function () { next() })
	.catch(function (err) {
		console.log(err)
		res.status(500).send(err)
	})
})

const updateSession = () => {
	console.log("KEVIN NEW SESSION REQUEST")
	return rp.post({
		uri: BASE_URL+'/account/signin',
		headers: getAislePlannerHeaders(false),
		json: true,
		resolveWithFullResponse: true,
		body: {
			"username": process.env.USERNAME,
			"password": process.env.PASSWORD
		}
	})
	.then(function (response) {
		console.log("PARSE COOKIES")
		console.log(setCookie.parse(response))
		const cookies = setCookie.parse(response)
		for (var i = 0; i < cookies.length; i++ ) {
			var cookie = cookies[i]
			console.log(cookie)
			if (cookie.name == "session") {
				console.log(cookie.value)
				sessionId = cookie.value
				return sessionId
			}
		}
		throw("Error renewing session")
	})
}

// Get guest groups information
router.get('/guests', function (req, res) {
	console.log("START GUEST PULL")
	const promises = []
	promises.push(getAllUsers());
	promises.push(rp({
	    uri: WEDDING_URL+'/guest_groups',
	    headers: getAislePlannerHeaders(true),
	    json: true // Automatically parses the JSON string in the response 
	}));
	Promise.all(promises)
    .then(function (results) {
    	console.log("RESULTS")
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
    	console.log(response[0])
    	// const match = _.filter(groups, x => x.id === 1606652);

    	res.send(response);
    })
    .catch(function (err) {
    	console.log(err)
        // API call failed... 
    });
})

// Update a guest's address
router.post('/guests/:userId/address', function (req, res) {
	const USER_ID = req.params.userId;
	rp({
	    uri: WEDDING_URL+'/guests/'+USER_ID,
	    headers: getAislePlannerHeaders(true),
	    json: true // Automatically parses the JSON string in the response 
	}).then(function (user) {
		user.address.street = req.body.address1 || ''
		user.address.extended = req.body.address2 || ''
		user.address.city = req.body.city || ''
		user.address.region = req.body.state || ''
		user.address.postcode = req.body.zip || ''
		user.address.country = req.body.country || ''
		return user
	}).then(function (user) {
		return rp.put({
			uri: WEDDING_URL+'/guests/'+USER_ID,
			headers: getAislePlannerHeaders(true),
			json: true,
			body: user
		})
	}).then(function (response) {
		res.send(response)
	}).catch(function (err) {
		console.log(err)
	});

})

// Get a guest group's RSVP status for events
router.get('/rsvp/:guestGroupId', function (req, res) {
	const groupId = req.params.guestGroupId
	const promises = []
	promises.push(getAllUsers())
	promises.push(rp({
		uri: WEDDING_URL+'/events?all_event_guests',
		headers: getAislePlannerHeaders(true),
		json: true
	}))
	Promise.all(promises)
	.then(function (results) {
		var guests = results[0]
		var statuses = results[1]
		guests = _.filter(guests, guest => guest.group_id == groupId)
		for (var i = 0; i < guests.length; i++) {
			guests[i].statuses = _.filter(statuses, status => status.wedding_guest_id === guests[i].id)
		}
		guests = _.sortBy(guests, 'group_order');
		res.send(guests)
	}).catch(function (err) {
		console.log(err)
	})
})

// Get basic information for all events
router.get('/events', function (req,res) {
	const promises = []
	promises.push(rp({
		uri: WEDDING_URL+'/events',
		headers: getAislePlannerHeaders(true),
		json: true
	}))
	promises.push(rp({
		uri: WEDDING_URL+'/events?all_meal_options',
		headers: getAislePlannerHeaders(true),
		json: true
	}))
	Promise.all(promises)
	.then(function (results) {
		const events = results[0]
		const meals = results[1]
		for (var i = 0; i < events.length; i++) {
			events[i].meal_options = _.filter(meals, meal => meal.wedding_event_id == events[i].id)
		}
		res.send(events)
	})
	.catch(function (err) {
		console.log(err)
	})
})

// Update rsvp status information
router.post('/rsvp', function (req, res) {
	const rsvps = req.body
	const promises = []
	for (var i = 0; i < rsvps.length; i++){
		console.log(WEDDING_URL+'/events/'+rsvps[i].wedding_event_id+'/guests/'+rsvps[i].wedding_guest_id)
		promises.push(rp.put({
			uri: WEDDING_URL+'/events/'+rsvps[i].wedding_event_id+'/guests/'+rsvps[i].wedding_guest_id,
			headers: getAislePlannerHeaders(true),
			json: true,
			body: rsvps[i]
		}))
	}
	Promise.all(promises)
	.then(function (results) {
		res.send(results)
	})
	.catch(function (err) {
		console.log(err)
	})
})

// Get all guests
const getAllUsers = () => {
	return rp({
	    uri: WEDDING_URL+'/guests',
	    headers: getAislePlannerHeaders(true),
	    json: true // Automatically parses the JSON string in the response 
	})
}

// Calculate the display name based on the the guests in the group
const groupDisplayName = (guests) => {
	if (guests.length == 1) {
		return guests[0].first_name + " " + guests[0].last_name
	} else {
		var name = groupGuests[0].first_name 
		if (guests[0].last_name != guests[1].last_name || !guests[1].is_primary_guest) {
			name = name + " " + guests[0].last_name;
		} 
		for (var i = 1; i < guests.length; i++) {
			if (!guests[i].is_anonymous) {
				if (guests[i].is_primary_guest) {
					name = name + " & " + guests[i].first_name + " " + guests[i].last_name
				} else {
					name = name + " & Family"
					break
				}
			}
		}

		return name;
	} 
}
module.exports = router;