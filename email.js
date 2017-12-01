const Sendgrid = require("sendgrid")(process.env.SENDGRID_API_KEY);

const sendNotification = () => {
	sendEmail({
	 	subject: "Alert - API Version Increased",
		content: "Api version has been increased on AislePlanner.com. You can probably ignore this."
	});
};

const sendEmail = (data) => {
	const toEmail = data.toEmail || process.env.USERNAME;
	const fromEmail = data.fromEmail || "alert@WeddingBot.com";
	const fromName = data.fromName || "Wedding Bot 3000";
	const subject = data.subject || "Wedding Bot Email";
	const content = data.content || "Bodyless Email";
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
	});

	//With promise
	Sendgrid.API(request)
	  .then(response => {
	    res.success("Email sent to "+toEmail);
	  })
	  .catch(error => {
	    //error is an instance of SendGridError
	    //The full response is attached to error.response
	    res.error(error.response.statusCode);
	  });
}

module.exports = {sendNotification, sendEmail}
