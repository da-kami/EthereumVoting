var nodemailer = require('nodemailer');

var currentToEmailAddress;
var currentFromEmailAddress;
var currentEmailSubject;
var currentEmailText;
var currentEmailPwd;

// vall like: EMAIL_ADR='your@email' EMAIL_PWD='your_password' npm start


/* var transporter = nodemailer.createTransport("SMTP", {
    host: "https://mail.senacormail.de", // hostname
    secureConnection: false, // TLS requires secureConnection to be false
    port: 587, // port for secure SMTP
    auth: {
        user: "POLARIS\dkarzel",
        pass: process.env.EMAIL_PWD
    },
    tls: {
        ciphers:'SSLv3'
    }
}); */

// setup e-mail data with unicode symbols

var sendAnEmail = function (emailAddressFrom, emailFromPwd, emailAddressTo, subject, text)
{
	currentEmailText = text;
	currentEmailSubject = subject;
	currentToEmailAddress = emailAddressTo;
	currentFromEmailAddress = emailAddressFrom;
	currentEmailPwd = emailFromPwd;

	var transporter = nodemailer.createTransport({
	     service: 'gmail', // no need to set host or port etc.
	     auth: {
			user: emailAddressFrom,
	        pass: emailFromPwd
		 }
	});

	var mailOptions = {
	    from: '"Senacor DevCon" <noreply@senacor.com>', // sender address
	    to: emailAddressTo, // list of receivers
	    subject: subject, // Subject line
	    text: text, // plaintext body
	};

	console.log("Will send email from: " + currentFromEmailAddress + " to " + currentToEmailAddress);

	// send mail with defined transport object
	transporter.sendMail(mailOptions, function(error, info){
	    if(error){
	        return console.log("Error happened: " + error);
	    }
	    console.log('Message sent: ' + info.response);
	});
}

module.exports.sendAnEmail = sendAnEmail;