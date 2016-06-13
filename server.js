// include winston logging
var winston = require('winston');

// include restify server
var restify = require('restify');

// include ms botbuilder sdk
var builder = require('botbuilder');

// include pinboard api
// https://www.npmjs.com/package/node-pinboard

// get app id and secret from server environment
// this avoids having to store the secret in code
// you can manage it in the Azure dashboard
// in settings -> application settings -> App settings
var botConnectorOptions = {
    appId: process.env.BOTFRAMEWORK_APPID,
    appSecret: process.env.BOTFRAMEWORK_APPSECRET
};

// create bot based on connector options defined above
var bot = new builder.BotConnectorBot(botConnectorOptions);

// add default route
bot.add('/', [
    function (session, args, next) {
        if ((!session.searchQueries) || (session.searchQueries.length < 1)) {
            session.beginDialog('/entersearchquery');
        } else {
            next();
        }
    },
    function (session, results) {
        session.send('Ok, I\'m searching for ' + session.searchQueries[0]);
    }
]);

// user needs / wants to enter a search query
bot.add('/entersearchquery', [
    function (session) {
        // ask for query
        builder.Prompts.text(session, 'Hi! What are you searching for?');
    },
    function (session, results) {
        // add a new search query to the list
        session.searchQueries.push(results.response);
        session.endDialog();
    }
]);

// Setup Restify Server
var server = restify.createServer();

// Handle Bot Framework messages
server.post('/api/messages', bot.verifyBotFramework(), bot.listen());

// Serve a static web page
server.get(/.*/, restify.serveStatic({
    'directory': '.',
    'default': 'index.html'
}));

server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
