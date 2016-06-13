var restify = require('restify');
var builder = require('botbuilder');
var winston = require('winston');

// Create bot and add dialogs
var bot = new builder.BotConnectorBot({ appId: 'give_me_a_link', appSecret: 'ff98d9635e554e6f8026c4c8983d4cc7' });
bot.add('/', function (session) {
    session.send('Hello World');
});

// Setup Restify Server
var server = restify.createServer();
server.post('/api/messages', bot.verifyBotFramework(), bot.listen());
server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
