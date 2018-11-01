# Wedding Bot
A middle man API based on Express and Node to integrate between a website and the wedding planning website, Aisle Planner to allow some missing functionality such as letting guests update their mailing info or RSVPing which is still handled manually on AP.

The underlying calls and responses were found by intercepting the ajax calls within Aisle Planner's website.

__Warning__: I've tried to make this as flexible as I could but it is worth keeping in mind that 
1. This was developed for my wedding and I don't really have a huge motivation to stay involved in the wedding industry and it's tools now that I'm married
1. It uses Aisle Planner as a DB essentially and is completely dependent on their non-public API calls

## Setup

You'll need to have Node and NPM installed. A good guide can be found here:
https://blog.teamtreehouse.com/install-node-js-npm-mac

Once you have that, you should be able to install dependencies using the command:
```
$ npm install
```

## Environment Variables
To run the app, you'll need to set a series of environment variables which can be found in the template `.env.EXAMPLE` which should be renamed to `.env`

### Aisle Planner
#### User
It's good practice to create a separate Aisle Planner Account that you can dedicate to this server
Once you create this account set the env variables of `AISLE_PLANNER_USERNAME` and  `AISLE_PLANNER_PASSWORD`to the username (email) and password, respectively

#### Wedding
You can have multiple weddings in Aisle Planner so you'll need to specify which one you want to work with in the `WEDDING_ID` env variable.
This is especially useful if you want to set up a second wedding in Aisle Planner to test (highly recommended!)

You can get this id by going to the dashboard for your wedding and looking in the url
`https://www.aisleplanner.com/app/project/{WEDDING_ID}/dashboard`

#### Ceremony
You can have different events in your wedding but Aisle Planner will auto-generate a Ceremony and Reception event. We use the ceremony as the main RSVP of the wedding for reports and notifications because it's very unlikely that someone is going to come to your other events but skip out on the ceremony.

If this is a bad assumption for you, then you probably want to check out code that uses CEREMONY_ID

To find your ceremony id, on Aisple Planner, navigate to the `GUESTS` tab and make sure you have `CEREMONY` selected in the drop down in the middle of the page.

Set the CEREMONY_ID to the value found in the url
`https://www.aisleplanner.com/app/project/{WEDDING_ID}/tools/guests/event/{CEREMONY_ID}`

### Sendgrid - Email Notifications
There are some automated emails that I send out for error reporting as well as updating the couple when a guest RSVPs

The app uses Sendgrid to send these emails. They offer a free tier which is most likely more than enough for your wedding unless you're a sultan or something.

You can sign up [here](https://signup.sendgrid.com/) and set the key as `SENDGRID_API_KEY`.

Finally, you should set `NOTIFICATION_EMAIL` to the address you want to receive them at. 
This is also useful to set differently between prod and development evironments so you don't spam your spouse-to-be.

## Hosting 
This app can be hosted anywhere that supports node but [Heroku](https://www.heroku.com/home) is super simple, allows easy-to-set up hooks to deploy when you push to your repo, and is free.

One drawback is that the free tier will sleep instances that are idle for too long. Because of that, I have a hack that just has the server [call itself every 10 minutes to keep it awake] (https://github.com/kcrimi/wedding-bot/blob/master/app.js#L34)

Once you set this up, you should set your production environment variables in your heroku instance. I've written an [article using environment variables](http://tech.kevincrimi.com/blog/2017/11/13/parse-secrets/) that might help

## Example Usages
You can see some example usages of the code in my wedding site in the links below

### RSVP and Address Changing
[RSVP (HTML)](https://github.com/kcrimi/wedding_site/blob/master/_includes/rsvp.html)
 
[Changing Address (HTML)](https://github.com/kcrimi/wedding_site/blob/master/_includes/mailing.html)

[Api calls (JS)](https://github.com/kcrimi/wedding_site/blob/master/js/guest-suggestions.js)

### Misc Data Views
[CSV data dump](https://github.com/kcrimi/wedding_site/blob/master/_includes/email-list.html)

[Unresponded Guests](https://github.com/kcrimi/wedding_site/blob/master/_includes/status-check.html)

[Api Calls (JS)](https://github.com/kcrimi/wedding_site/blob/master/js/status-check_v1.2.js)


## Questions / Comments
Feel free to comment on this repo or email me at kevin(at)kevincrimi.com

Copyright © 2017 kcrimi
