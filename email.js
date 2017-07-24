const Sendgrid = require("sendgrid")(process.env.SENDGRID_API_KEY);

const sendNotification = () => {
	const toEmail = process.env.USERNAME;
	const fromEmail = "alert@WeddingBot.com";
	const fromName = "Wedding Bot 3000";
	const subject = "Alert - API Version Increased";
	const content = "Api version has been increased on AislePlanner.com. Please check to make sure everything is working correctly.";
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
};

module.exports = {sendNotification}
