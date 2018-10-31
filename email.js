const Sendgrid = require("sendgrid")(process.env.SENDGRID_API_KEY);

const sendNotification = () => {
	sendEmail({
	 	subject: "Alert - API Version Increased",
		content: "Api version has been increased on AislePlanner.com. You can probably ignore this."
	})
}

// Sends email notifying you of a guest's rsvp
const sendRsvpEmail = (rsvp) => {
	const guestName = rsvp.name
	const guests = rsvp.guests.length
	const meals = rsvp.guests.reduce((output, guest) => {
		if (output[guest.mealName]) {
			output[guest.mealName]++
		} else {
			output[guest.mealName] = 1
		}
		return output
	}, {})
	var body = "<p><strong>" + guestName + " just RSVPed for " + guests + " guest(s).</strong></p><p>These are the selections:<br/>"
	body += "<table><tr><th> Guest </th><th> Attending </th><th> Meal Selection </th></tr>"
	rsvp.guests.forEach((guest) => {
		var displayName = guest.first_name+" "+guest.last_name
		if (guest.is_anonymous == true && !guest.first_name) {
			displayName = "+1"
		}
		body += "<tr><td>"+displayName+"</td>"
		var displayRsvp = "Yes"
		var rsvpColor = "forestGreen"
		if (guest.rsvp != "attending") {
			body += "<td style='color:crimson;text-align:center;'> No </td>"
			body += "<td style='color:grey;'> -- </td></tr>"
		} else {
			body += "<td style='color:forestGreen;text-align:center;'> Yes </td>"
			body += "<td> "+guest.mealName+" </td></tr>"
		}
	})
	body += "</table>"
	return sendEmail({
		toEmail: process.env.NOTIFICATION_EMAIL,
		subject: "RSVP from "+guestName,
		content: body
	})
}

// Generic Network call to send an email
const sendEmail = (data) => {
	const toEmail = data.toEmail || process.env.USERNAME
	const fromEmail = data.fromEmail || "alert@WeddingBot.com"
	const fromName = data.fromName || "Wedding Bot 3000"
	const subject = data.subject || "Wedding Bot Email"
	const content = data.content || "Bodyless Email"
	const request = Sendgrid.emptyRequest({
	  method: 'POST',
	  path: '/v3/mail/send',
	  body: {
	    personalizations: [
	      {
	        to: [
	          {
	            email: toEmail,
	          },
	        ],
	        subject: subject,
	      },
	    ],
	    from: {
	      email: fromEmail,
	      name: fromName,
	    },
	    content: [
	      {
	        type: 'text/html',
	        value: content,
	      },
	    ],
	  },
	})

	//With promise
	return Sendgrid.API(request)
}

module.exports = {sendNotification, sendEmail, sendRsvpEmail}
