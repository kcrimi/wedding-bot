const router = require('express').Router()
const rp = require('request-promise')
const setCookie = require('set-cookie-parser')
const _ = require('lodash')
const BASE_URL = 'https://www.aisleplanner.com/api'
const WEDDING_URL = BASE_URL + '/wedding/'+process.env.WEDDING_ID
const CEREMONY_ID = process.env.CEREMONY_ID
const Emailer = require('./email.js')
var sessionId

const getAislePlannerHeaders = (withCookie) => {
	const aislePlannerHeaders = {
	    	'X-XSRF-TOKEN': '6defb5fe6bb0a6476a6b011857329c2617af2a0f',
			'X-Requested-With': 'XMLHttpRequest',
			// 'X-AP-API-Version': process.env.API_VERSION, // commented this out because Aisle Planner changes min version too often and it never seems to break if I leave it unspecified
	    }
	if (withCookie) {
		aislePlannerHeaders.Cookie = 'session=' + sessionId
	}
	return aislePlannerHeaders
}

router.get('/', function (req, res) {
  res.send("Looks like your wedding bot instance is working!")
})

// Check if session is valid using the user's checkin endpoint.
router.use(function (req, res, next) {
	console.log("STARTING SESSION CHECK")
	rp({
		uri: BASE_URL+'/notifications/checkin',
		headers: getAislePlannerHeaders(true),
		json: true
	})
	.then(function (response) {
		console.log('Session is valid')
		return
	}, function (error) {
		console.log("No user logged in")
		if (error.statusCode != 401) {
			res.status(error.statusCode).send(error)
		}
		return updateSession(res, true)
	})
	.then(function () { next() }) // could probably move this up to to line 37?
	.catch(function (err) {
		console.log(err)
		res.status(500).send(err)
	})
})

const updateSession = (res, versionCheck) => {
	console.log("STARTING LOGIN ATTEMPT")
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
			"username": process.env.AISLE_PLANNER_USERNAME,
			"password": process.env.AISLE_PLANNER_PASSWORD
		}
	})
	.then(function (response) {
		console.log("Getting the session Id from the cookie")
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
		/*
		 NOTE: it seems that Aisle Planner ups the min version with every deploy despite them not being breaking changes.
		 Annoyingly, it blocks calls with an old version but allows calls with no version. I've had no crashes using the version-less calls though
		*/
		if (err.statusCode == 412 && err.response.body.UPGRADE) {
			console.log("API VERSION ERROR")
			Emailer.sendNotification()
			return updateSession(res, false)
		}
	})
}

// Get guest groups information
router.get('/guests', function (req, res) {
	getGuestGroups(req.query.includeAddress == 'true', req.query.includeRelationship == 'true')
	.then((groups) => {
		res.send(groups)
	}).catch(function (err) {
    	console.log(err)
        // API call failed... 
    });
})

const getGuestGroups = (includeAddress, includeRelationship) => {
	console.log("START GUEST PULL")
	const promises = []
	promises.push(getAllGuests())
	promises.push(getAllGuestGroups());
	promises.push(getAllRsvps())
	if (includeRelationship) {
		promises.push(getAllRelationships())
	}
	return Promise.all(promises)
    .then(function (results) {
    	console.log("RESULTS")

    	const guests = results[0]
    	const groups = results[1]
    	guests.forEach((guest) => {
    		// Add the rsvp status to each guest
    		guest.rsvp = results[2].find((rsvp) => {
    			return guest.id == rsvp.wedding_guest_id && CEREMONY_ID == rsvp.wedding_event_id
    		})
    	})
    	const guest_relationships = results[3]

    	const response = groups.map((group) => {
    		// Find the guests that are part of this guest group
    		groupGuests = _.filter(guests, guest => guest.group_id === group.id)

    		// Sort the guests by their group order so +1s and children, etc end up last
    		groupGuests = _.sortBy(groupGuests, 'group_order');

    		const payload = {
    			id: group.id,
    			rsvp_id: group.rsvp_id,
    			relationship_id: group.relationship_id,
    			name: groupDisplayName(groupGuests),
    			guests: groupGuests.map((guest) => {
    				return guest.id
    			}),
    			guestList: groupGuests[0].rsvp ? groupGuests[0].rsvp.guest_list : null,
    			needs_rsvp: groupGuests[0].rsvp && groupGuests[0].rsvp.attending_status == null,
    			attending_count: groupGuests.reduce((attendingCount, guest) => {
    				if (guest.rsvp && guest.rsvp.attending_status == "attending") {
    					attendingCount++
    				}
    				return attendingCount
    			}, 0)
    		}
    		if (includeAddress) {
    			payload.address = groupGuests[0].address
    			payload.email = groupGuests[0].email
    		}
    		if (includeRelationship) {
    			const relationship = guest_relationships.find((relationship) => {
					return group.relationship_id == relationship.id
				})
    			payload.relationship = relationship ? relationship.name : null
    		}

    		return payload
    	})

    	// Print out a group just to see some output
    	console.log(response[0])

    	return _.filter(response, (x) => { return x.guestList == 1 });
    })
}

// Update a guest's address
router.post('/guests/:userId/address', function (req, res) {
	console.log("START UPDATE ADDRESS")
	const guestId = req.params.userId;
	getGuestGroup(guestId)
	.then(function (guest) {
		if (req.body.phone_number) {
			guest.phone_number = req.body.phone_number
		}
		if (req.body.email) {
			guest.email = req.body.email
		}
		if (req.body.address) {
			guest.address.street = req.body.address.street || ''
			guest.address.extended = req.body.address.extended || ''
			guest.address.city = req.body.address.city || ''
			guest.address.region = req.body.address.region || ''
			guest.address.postcode = req.body.address.postcode || ''
			guest.address.country = req.body.address.country || ''
		}
		return guest
	}).then(updateGuest(guestId, guest))
	.then(function (response) {
		res.send(response)
	}).catch(function (err) {
		console.log(err)
	});

})

// Get a guest group's RSVP status for events
router.get('/rsvp/:guestGroupId', function (req, res) {
	const groupId = req.params.guestGroupId
	const promises = []
	promises.push(getAllGuests())
	promises.push(getAllRsvps())
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

// Get basic information for all events including their meal options
router.get('/events', function (req,res) {
	console.log("START EVENT CALL")
	const promises = []
	promises.push(getAllEvents())
	promises.push(getAllMealOptions())
	Promise.all(promises)
	.then(function (results) {
		const events = results[0]
		var meals = results[1]
		/*
		 Map the description in Aisle Planner to a simplified name for UI drop downs, etc
		 NOTE: THIS IS HIGHLY DEPENDENT ON YOUR MEAL DATA
		 */
		meals = meals.map((meal) => {
			meal.description = meal.name
			if (meal.description.toLowerCase().includes("kid")) {
				meal.name = "Kid's Meal"
			} else if (meal.description.toLowerCase().includes("chicken")) {
				meal.name = "Chicken"
			} else if (meal.description.toLowerCase().includes("steak")) {
				meal.name = "Beef"
			} else {
				meal.name = "Vegetarian"
			}
			return meal
		}).sort((a,b) => {
			// Sort alphabetically but keep kids meals on the bottom
			return a.name > b.name && !b.name.toLowerCase().includes("kid") 
				|| a.name.toLowerCase().includes("kid") ? 1 :  0
		})
		console.log(meals)
		for (var i = 0; i < events.length; i++) {
			events[i].meal_options = meals.filter((meal) => meal.wedding_event_id == events[i].id)
		}
		res.send(events)
	})
	.catch(function (err) {
		console.log(err)
	})
})

// Update rsvp status information
router.post('/rsvp/:guestGroupId', function (req, res) {
	console.log("START UPDATE RSVP")
	const rsvps = req.body
	const promises = rsvps.guests.reduce((p, guest) => {
		// If we receive a guest name, we can assume that we want to update the name
		if (guest.first_name && guest.last_name) {
			updatedGuest = {
					first_name: guest.first_name,
					last_name: guest.last_name,
					is_anonymous: false,
					group_id: req.params.guestGroupId
				}
			 p.push(updateGuest(guest.id, updatedGuest))
		}
		return p.concat(guest.rsvps.map((rsvp) => {
			return updateRsvp(guest.id, rsvp)
		}))
	}, [])
	Promise.all(promises)
	.then(function (results) {
		res.send(results)
		notfifyNewRsvpReceived(rsvps)
	})
	.catch(function (err) {
		console.log(err)
	})
})

// Convenience method to notify you when someone RSVPs through the API so you can spy on them
const notfifyNewRsvpReceived = (rsvpGroup) => {
	console.log("START RSVP NOTIFICATION")
	Promise.all([getAllGuests(), getAllMealOptions()])
	.then((results) => {
		[guests, mealOptions] = results
		const fullGuests = rsvpGroup.guests.map((rsvpGuest) => {
			const guestRecord = guests.find((guest) => {
				return guest.id == rsvpGuest.id
			})
			// We just want the ceremony ID for our display, not any of the side events
			guestRecord.rsvp = rsvpGuest.rsvps.find((rsvp) => {
				return CEREMONY_ID == rsvp.wedding_event_id
			}).attending_status
			const mealRsvp = rsvpGuest.rsvps.find((rsvp) => {
				return rsvp.meal_option_id || rsvp.meal_declined
			})
			if (mealRsvp) {
				if (mealRsvp.meal_declined) {
					guestRecord.mealName = "Declined"
				} else {
					console.log(mealOptions)
					console.log(mealRsvp.meal_option_id)
					guestRecord.mealName = mealOptions.find((mealOption) => {
						return mealOption.id == mealRsvp.meal_option_id
					}).name
				}
			}
			return guestRecord;
		})
		return {
			name: groupDisplayName(fullGuests),
			guests: fullGuests
		}

	}).then((payload) => {
		return Emailer.sendRsvpEmail(payload)
	})
}


// ##########  NETWORK CALLS ##############

// Get all guests
const getAllGuests = () => {
	return rp({
	    uri: WEDDING_URL+'/guests',
	    headers: getAislePlannerHeaders(true),
	    json: true // Automatically parses the JSON string in the response 
	})
}

const getAllGuestGroups = () => {
	return rp({
	    uri: WEDDING_URL+'/guest_groups',
	    headers: getAislePlannerHeaders(true),
	    json: true // Automatically parses the JSON string in the response 
	})
}

const getGuestGroup = (guestId) => {
	return rp({
	    uri: WEDDING_URL+'/guests/'+guestId,
	    headers: getAislePlannerHeaders(true),
	    json: true // Automatically parses the JSON string in the response 
	})
}

const updateGuest = (guestId, guest) => {
	rp.put({
		uri: WEDDING_URL+'/guests/'+guestId,
		headers: getAislePlannerHeaders(true),
		json: true,
		body: guest
	})
}

// Get all meal options
const getAllEvents = () => {
	return rp({
		uri: WEDDING_URL+'/events',
		headers: getAislePlannerHeaders(true),
		json: true
	})
}
// Get all meal options
const getAllMealOptions = () => {
	return rp({
		uri: WEDDING_URL+'/events?all_meal_options',
		headers: getAislePlannerHeaders(true),
		json: true
	})
}

// Get guest relationships
const getAllRelationships = () => {
	return rp({
		uri: WEDDING_URL+'/guest_relationships',
		headers: getAislePlannerHeaders(true),
		json: true
	})
}

// Get all RSVPs 
const getAllRsvps = () => {
	return rp({
		uri: WEDDING_URL+'/events?all_event_guests',
		headers: getAislePlannerHeaders(true),
		json: true
	})
}

const updateRsvp = (guestId, rsvp) => {
	return rp.put({
		uri: WEDDING_URL+'/events/'+rsvp.wedding_event_id+'/guests/'+guestId,
		headers: getAislePlannerHeaders(true),
		json: true,
		body: rsvp
	})
}

// Complicated string builder to calculate the display name based on the the guests in the group
const groupDisplayName = (guests) => {
	if (guests.length == 1) {
		// Only 1 guest: "Rick Grimes"
		return guests[0].first_name + " " + guests[0].last_name
	} else {
		// Boolean whether there's more than 3 named guests in the group
		const andFamily = guests.filter((g) => {
			// No +1s included
			return !g.is_anonymous;
		}).length > 3;

		// The array of guests to be used in generating the display name
		const namedGuests = _.transform(guests, (out, g) => {
			if (!g.is_anonymous) {
				out.push(g)
			}
			// Only take 2 users: Rick and Carl Grimes
			// unless there are more than 3, in which case just 1: Mike Brady & Family
			return out.length < 3 && !(out.length == 2 && andFamily)
		}, [] )


		var name = _.reduce(namedGuests, (out, g, i, array) => {
			// We only want to add the last name to the final user with it so this boolean helps
			const lastUserOfCurrentLastName = (i == array.length - 1 || g.last_name != array[i + 1].last_name)
			if (i > 0) {
				// Only add & if it's the final guest of the name: Alec, Billy & >Stephen< Baldwin
				out += lastUserOfCurrentLastName ? " & " : ", "
			}
			out += g.first_name
			if (lastUserOfCurrentLastName) {
				// Finally add the guests' last name
				out = out + " " + g.last_name
			}
			return out
		}, "")
		return andFamily ? name + " & Family" : name;
	} 
}
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

module.exports = router;