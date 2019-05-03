// worked on pseudo code with Katie Goldstein!

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import dotenv from 'dotenv';
import botkit from 'botkit';
import emoji from 'node-emoji';
import yelp from 'yelp-fusion';

const emojified = emoji.emojify('Sorry I think I missed that... but I do know the words help or hungry! Type in one of those and maybe I can help you then :star:');

dotenv.config({ silent: true });

// initialize
const app = express();

// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// additional init stuff should go before hitting the routing

// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM((err) => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// example hello response
controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// hungry call
controller.hears('help', ['direct_mention', 'direct_message'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, 'If you type "hungry", "famished" or "food", I can give you the best Yelp-recommended restaurants near you!');
    } else {
      bot.reply(message, 'Yeet bro, what is up?');
    }
  });
});

// direct message
controller.on('direct_message', (bot, message) => {
  bot.reply(message, 'hmm... I do not quite understand you. come again?');
});

// direct mention
controller.on('direct_mention', (bot, message) => {
  bot.reply(message, 'you called charlottec-bot?');
});


controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'On my way!');
});


// Yelp Integration
// let yelpClient;
// yelp.accessToken(process.env.YELP_CLIENT_ID, process.env.YELP_CLIENT_SECRET)
//   .then((res) => {
//     yelpClient = yelp.client(res.jsonBody.access_token);
//   });

const yelpClient = yelp.client(process.env.YELP_CLIENT_SECRET);


controller.hears(['food', 'hungry', 'famished', 'starving'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.startConversation(message, (err, convo) => {
        let location = '';
        let favoriteFood = '';

        convo.addQuestion(`Oh, of course ${res.user.name}! Where in the world are you right now? I'm from Hong Kong, HK!`, (response, keeptalking) => {
          location = response.text;
          keeptalking.next();
        }, { key: 'location' }, 'default');

        convo.addQuestion(`${res.user.name}, what's your favorite food? Mine is dim sum!`, (response, keeptalking) => {
          favoriteFood = response.text;

          // pseudocode with Ruoni as well
          if (location.length > 0 && favoriteFood.length > 0) {
            yelpClient.search({
              term: favoriteFood,
              location,
            }).then((res) => {
              convo.say(`According to Yelp, the best place nearby for ${favoriteFood} is ${res.jsonBody.businesses[0].name}!`);

              // reccomendation of this type of response from former student Ruoni
              // yelp-fusion github repo for methods helped a tremendous amount
              convo.say(`For your information and ease of booking, ${res.jsonBody.businesses[0].name} has ${res.jsonBody.businesses[0].review_count} reviews on Yelp, 
              with an average rating of ${res.jsonBody.businesses[0].rating}. If you want to book a table or order food now, please call ${res.jsonBody.businesses[0].phone}!`);

              const attachments = {
                attachments: [
                  {
                    fallback: 'We love food!',
                    title: res.jsonBody.businesses[0].name,
                    text: res.jsonBody.businesses[0].url,
                    thumb_url: res.jsonBody.businesses[0].image_url,
                  },
                ],
              };

              convo.say(attachments);
            }).catch((e) => {
              console.log(e);
            });
          }

          keeptalking.next();
        }, { key: 'food' }, 'default');

        convo.addMessage('Alright, I\'m searching the database and looking for the best restaurants for you!', 'default');
      });
    } else {
      bot.reply(message, 'yeet yeet i hate beets');
    }
  });
});

// when it's gibberish returns constant message with star emoji defined above!!!
controller.hears('^[A-z]+$', ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, emojified);
});
