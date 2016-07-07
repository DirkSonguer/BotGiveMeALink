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
var pinboardApiToken = process.env.PINBOARD_APITOKEN
var pinboard = new Pinboard(pinboardApiToken);

// create bot based on connector options defined above
var bot = new builder.BotConnectorBot(botConnectorOptions);

// event that new bot conversation has been started
bot.on('BotAddedToConversation', function (listener) {
    winston.info('# Initiated a new bot conversation with id ' + listener.id);
});

// create dialog based on LUIS app
var dialog = new builder.LuisDialog('https://api.projectoxford.ai/luis/v1/application?id=' + process.env.LUIS_APP_ID + '&subscription-key=' + process.env.LUIS_SUBSCRIPTION_KEY);
bot.add('/', dialog);

// LUIS identified a link request intent
dialog.on('Link', [
    function (session, args, next) {
        winston.info('# Identified link request');

        // extract entity from intent
        var task = builder.EntityRecognizer.findEntity(args.entities, 'Link');

        // the link should be included in the Link entity
        if (!task) {
            // if none was given, apologise and ask again
            next({});
        } else {
            // jump to next stage in dialog to show result
            next({ response: task.entity });
        }
    },
    function (session, results) {
        winston.info('# Identified link request with given entity');
        if (results.response) {
            // this will get all bookmarks stored in the pinboard account
            // we also add the tag filter to only receive matching entries
            pinboard.all({ tag: results.response }, function (err, res) {
                // check if a proper response came back
                if (res) {
                    // check if the response actually contains posts
                    if (res.length > 0) {
                        winston.info('# Found ' + res.length + ' entries');

                        // storing search term in user data
                        // this contains all search results and is used when the user requests another link from the results
                        session.userData.search = results.response;

                        // reset current index
                        // this tracks which link the user currently sees
                        session.userData.searchResultIndex = 0;

                        // store complete result list
                        session.userData.searchResultList = res;

                        // responding with first link result
                        resultLink = 'How about ';
                        resultLink += res[0].href + "\n";
                        resultLink += res[0].description + "\n";
                        resultLink += '(' + (session.userData.searchResultIndex + 1) + '/' + session.userData.searchResultList.length + ')';
                        session.send(resultLink);
                    } else {
                        winston.info('# Got a response, but it does not seem like there are posts');
                        session.send('Hm, I don\'t think I have any link for that, sorry');
                    }
                } else {
                    // something went wrong
                    winston.info('# Response did throw an error: ' + err);
                    session.send('Oh, something went wrong (' + err + ')');
                }
            });
        } else {
            // no entity, hence no topic to search a link for
            winston.info('# Did not get an entity for this intent');
            session.send("Somehow I didn't get what you are looking for, sorry. Can you please try again?");
        }
    }
]);

// LUIS identified intent for next link
dialog.on('Next', [
    function (session, args, next) {
        next({});
    },
    function (session, results) {
        winston.info('# Selecting next result');

        // switch to next result
        if ((session.userData.searchResultIndex + 1) <= session.userData.searchResultList.length) {
            session.userData.searchResultIndex += 1;
        } else {
            session.userData.searchResultIndex = 0;
        }

        // responding with next result
        // this draws the result from the search results cached in the user session
        resultLink = 'How about ';
        resultLink += session.userData.searchResultList[session.userData.searchResultIndex].href + "\n";
        resultLink += session.userData.searchResultList[session.userData.searchResultIndex].description + "\n";
        resultLink += '(' + (session.userData.searchResultIndex + 1) + '/' + session.userData.searchResultList.length + ')';
        session.send(resultLink);
    }
]);

// LUIS identified a salutation intent
// just say hi
dialog.on('Salutation', [
    function (session, args, next) {
        next({});
    },
    function (session, results) {
        winston.info('# Salutation intent');
        session.send("Oh, hi. Nice to meet you!", results.response);
    }
]);


// LUIS identified a link request intent
// just be nice
dialog.on('Gratitude', [
    function (session, args, next) {
        next({});
    },
    function (session, results) {
        winston.info('# Gratitude intent');
        session.send("You're welcome! Glad to be of help.", results.response);
    }
]);

// default action if no LUIS intent was found
dialog.onDefault(builder.DialogAction.send("I'm sorry. I didn't understand. Can you please elaborate what you are looking for?"))

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
