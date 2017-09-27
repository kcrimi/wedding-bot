const router = require('express').Router()
const rp = require('request-promise')
const setCookie = require('set-cookie-parser')
const _ = require('lodash')
const BASE_URL = 'https://www.aisleplanner.com/api'
const WEDDING_URL = BASE_URL + '/wedding/'+process.env.WEDDING_ID
const Emailer = require('./email.js')
var sessionId

const getAislePlannerHeaders = (withCookie) => {
	const aislePlannerHeaders = {
	    	'X-XSRF-TOKEN': '6defb5fe6bb0a6476a6b011857329c2617af2a0f',
			'X-Requested-With': 'XMLHttpRequest',
			// 'X-AP-API-Version': process.env.API_VERSION,
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
		return updateSession(res, true)
	})
	.then(function () { next() })
	.catch(function (err) {
		console.log(err)
		res.status(500).send(err)
	})
})

const updateSession = (res, versionCheck) => {
	console.log("KEVIN NEW SESSION REQUEST")
	headers = getAislePlannerHeaders(false)
	if (versionCheck) {
		headers['X-AP-API-Version'] = process.env.API_VERSION
	}
	return rp.post({
		uri: BASE_URL+'/account/signin',
		headers: headers,
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
	}, function (err) {
		// if api version has been upped, sign in without it and notify me
		if (err.statusCode == 412 && err.response.body.UPGRADE) {
			console.log("API VERSION ERROR")
	Emailer.sendNotification()
			return updateSession(res, false)
		}
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
    		const payload = {
    			id: group.id,
    			rsvp_id: group.rsvp_id,
    			relationship_id: group.relationship_id,
    			name: groupDisplayName(groupGuests),
    			guests: groupGuests.map((guest) => {
    				return guest.id
    			})
    		}
    		if (req.query.includeAddress == 'true') {
    			payload.address = groupGuests[0].address
    			payload.email = groupGuests[0].email
    		}
    		return payload
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
		if (req.body.email) {
			user.email = req.body.email
		}
		if (req.body.address) {
			user.address.street = req.body.address.street || ''
			user.address.extended = req.body.address.extended || ''
			user.address.city = req.body.address.city || ''
			user.address.region = req.body.address.region || ''
			user.address.postcode = req.body.address.postcode || ''
			user.address.country = req.body.address.country || ''
		}
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
		const andFamily = guests.length >= 4 || _.filter(guests, (g) => {return g.is_anonymous}).length > 2
		const namedGuests = _.transform(guests, (out, g) => {
			if (!g.is_anonymous) {
				out.push(g)
			}
			return out.length < 3 && !(out.length == 2 && andFamily)
		}, [] )
		var name = _.reduce(namedGuests, (out, g, i, array) => {
			const lastOfName = (i == array.length - 1 || g.last_name != array[i + 1].last_name)
			console.log(g.first_name + " "+g.last_name+ " "+ lastOfName + " "+out)
			if (i > 0) {
				out += lastOfName ? " & " : ", "
			}
			out += g.first_name
			if (lastOfName) {
				out = out + " " + g.last_name
			}
			return out
		}, "")
		return andFamily ? name + " & Family" : name;
	} 
}

module.exports = router;