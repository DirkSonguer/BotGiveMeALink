// ************************************************ //
// This bot will give you a link based on bookmarks
// curated by my Pinboard.in account.
//
// Author: Dirk Songuer (dirk@songuer.de)
// ************************************************ //

// include winston logging
var winston = require('winston');
winston.level = 'debug';

// include restify server
var restify = require('restify');

// include ms botbuilder sdk
var builder = require('botbuilder');

// include pinboard api
// https://www.npmjs.com/package/node-pinboard
var Pinboard = require('node-pinboard');

// get app id and secret from server environment
// this avoids having to store the secret in code
// you can manage it in the Azure dashboard
// in settings -> application settings -> App settings
var botConnectorOptions = {
    appId: process.env.BOTFRAMEWORK_APPID,
    appSecret: process.env.BOTFRAMEWORK_APPSECRET
};

// pinboard credentials, see above
pinboardApiToken = process.env.PINBOARD_APITOKEN
var pinboard = new Pinboard(pinboardApiToken);

// create bot based on connector options defined above
var bot = new builder.BotConnectorBot(botConnectorOptions);

// event that new bot conversation has been started
bot.on('BotAddedToConversation', function (listener) {
    winston.info('# Initiated a new bot conversation with id ' + listener.id);
});

// base command dialog
bot.add('/', new builder.CommandDialog()
    // default event caught by bot
    .onDefault([
        function (session, args, next) {
            winston.info('# Default event caught');

            // clear old session data
            session.userData = '';

            // routing to search event
            session.beginDialog('/search');
        }
    ]));

// search dialog
bot.add('/search', [
    function (session) {
        winston.info('# Bot phase of the search dialog');

        if (session.userData.searchResultText) {
            winston.info('# Search result found, showing result');

            // show the search result
            builder.Prompts.text(session, session.userData.searchResultText);
        } else {
            winston.info('# No search result found, showing initial promt');

            // this is only used once in the beginning
            builder.Prompts.text(session, 'Hi, there! I can show you a link if you give me a topic..');
        }
    },
    function (session, results) {
        winston.info('# Answer phase of the search dialog');

        if (results.response != 'next') {
            winston.info('# Searching for ' + results.response);

            // this will get all bookmarks stored in the pinboard account
            // we also add the tag filter to only receive matching entries
            pinboard.all({ tag: results.response }, function (err, res) {
                // check if a proper response came back
                if (res) {
                    // check if the response actually contains posts
                    if (res.length > 0) {
                        winston.info('# Found ' + res.length + ' entries');

                        // storing search term in user data
                        session.userData.search = results.response;

                        // reset current index
                        session.userData.searchResultIndex = 0;

                        // store complete result list
                        session.userData.searchResultList = res;

                        // show first example
                        resultLink = 'How about ';
                        resultLink += res[0].href + "\n";
                        resultLink += res[0].description + "\n";
                        resultLink += '(' + (session.userData.searchResultIndex + 1) + '/' + session.userData.searchResultList.length + ')';
                        session.userData.searchResultText = resultLink;
                    } else {
                        winston.info('# Got a response, but it does not seem like there are posts');
                        session.userData.searchResultText = 'Hm, I don\'t think I have any link for that, sorry';

                    }
                } else {
                    // something went wrong
                    session.userData.searchResultText = 'Oh, something went wrong (' + err + ')';
                }

                // route back to the search dialog start
                // this will then display the result and be directly ready for input again
                session.beginDialog('/search');
            });
        } else {
            winston.info('# Selecting next result');

            // route back to the search dialog start
            // this will then display the result and be directly ready for input again
            session.beginDialog('/next');
        }
    }
]);

// show next entry
bot.add('/next', [
    function (session) {
        winston.info('# Selecting next result');

        // switch to next result
        if ((session.userData.searchResultIndex + 1) <= session.userData.searchResultList.length) {
            session.userData.searchResultIndex += 1;
        } else {
            session.userData.searchResultIndex = 0;
        }

        // storing next result
        resultLink = 'How about ';
        resultLink += session.userData.searchResultList[session.userData.searchResultIndex].href + "\n";
        resultLink += session.userData.searchResultList[session.userData.searchResultIndex].description + "\n";
        resultLink += '(' + (session.userData.searchResultIndex + 1) + '/' + session.userData.searchResultList.length + ')';
        session.userData.searchResultText = resultLink;

        // route back to the search dialog start
        // this will then display the result and be directly ready for input again
        session.beginDialog('/search');
    }
]);

// setup restify server
var server = restify.createServer();

// handle bot framework messages
server.post('/api/messages', bot.verifyBotFramework(), bot.listen());

// serve a static web page as hello world confirmation
server.get(/.*/, restify.serveStatic({
    'directory': '.',
    'default': 'index.html'
}));

// connect to the bot framework middleware
server.listen(process.env.port || 3978, function () {
    winston.info('# %s server is now listening on port %s', server.name, server.url);
});
