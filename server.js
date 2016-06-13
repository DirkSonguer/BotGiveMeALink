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
bot.add('/', new builder.CommandDialog()
    .matches('^hey', builder.DialogAction.beginDialog('/newsearchquery'))
    .matches('^and', builder.DialogAction.beginDialog('/addsearchquery'))
    .matches('^quit', builder.DialogAction.endDialog())
    .onDefault([
        function (session, args, next) {
            if ((!session.searchQueries) || (session.searchQueries.length < 1)) {
                session.beginDialog('/addsearchquery');
            } else {
                next();
            }
        },
        function (session, results) {
            session.send('Ok, I\'m searching for ' + session.searchQueries[0]);
        }
    ]));

// user needs / wants to enter a search query
bot.add('/addsearchquery', [
    function (session) {
        // ask for query
            if ((!session.searchQueries) || (session.searchQueries.length < 1)) {
                builder.Prompts.text(session, 'Hi! What are you searching for?');
            } else {
                builder.Prompts.text(session, 'Anything else?');
            }
    },
    function (session, results) {
        // add a new search query to the list
        session.searchQueries.push(results.response);
        session.endDialog();
    }
]);

// start new search query
bot.add('/newsearchquery', [
    function (session) {
        // add a new search query to the list
        session.searchQueries = [];
        session.beginDialog('/');
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
