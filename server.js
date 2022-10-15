var env = require('dotenv').config();
var envExpander = require('dotenv-expand');
envExpander.expand(env);

const path = require('path');
const express = require('express');
const logger = require('morgan');
var mongoose = require('mongoose');
const { check, validationResult } = require("express-validator");
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var cors = require('cors');

var User = require('./models/user');
var Message = require('./models/message');
const user_controller = require('./controllers/users');

const app = express();
app.use(cors());
// middleware to handle json responses
app.use(express.json());
// middleware to handle string responses
app.use(express.urlencoded({ extended: false }));
// set up mongoose connection
var mongoDB;
var PORT;
if (process.env.NODE_ENV === 'prod') {
 mongoDB = process.env.DB_PROD;
 PORT = process.env.PORT;
} else {
  app.use(logger('dev'));
  mongoDB = process.env.DB_DEV;
  PORT = 8080;
}
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const MINUTE = 1000 * 60
var store = new MongoDBStore({
  uri: mongoDB,
  collection: 'sessions',
});

store.on('error', function(error) {
  console.log(error);
});

app.use(session({
  secret: 'members',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 5 * MINUTE },
  store,
}));
app.use(passport.initialize());
app.use(passport.session());
// set authentication strategy
passport.use(new LocalStrategy(
  function authenticateUser(username, password, done) {
    User.findOne({ username }, async function onUserSearched(err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      const authenticated = await user.verifyPassword(password);
      if (!authenticated) { return done(null, false); }
      return done(null, user);
    });
  }
));
// user info to store on session
passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user._id, username: user.username });
  });
});
// user info to retrieve with info from session
passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

// api routes
app.get('/api/auth', async (req, res) => {
  if (req.isAuthenticated()) {
    const user = await User.findById(req.user.id);
    res.status(200).json({ user: user });
  } else {
    res.status(200).json({ user: null });
  }
});
app.get('/api/messages', async (req, res) => {
  var messages;

  if (!req.isAuthenticated()) {
    messages = await getAnonymousMessages();
  } else {
    messages = await getMessages();
  }
  return res.status(200).json({ messages });

  async function getAnonymousMessages() {
    const messages = await getMessages();
    return messages.map(message => {
      return {
        author: { username: 'Anonymous' },
        title: message.title,
        body: message.body,
        updatedAt: message.updatedAt,
      }
    })
  }
  async function getMessages() {
    return await Message.find().populate('author', 'username').exec() || [];
  }
});
app.post(
  '/api/messages',[
  check('author').isString().withMessage('author must be sent with message'),
  check('title').isString().isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  check('body').isString().isLength({ min: 1, max: 300 }).withMessage('Body must be between 1 and 300 characters'),
  async function onValidated(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // save to db
    const { author, title, body } = req.body;
    const message = await createMessage(author, title, body);
    res.status(200).json({ message });
    // send response
    async function createMessage(authorId, title, body) {
      const message = new Message({
        author,
        title,
        body
      });
      message.save(function onSaveMessage(err) {
        if (err) return next(err);
      })
      return message;
    }
  }
]);

app.delete('/api/messages/:messageId', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const user = await User.findById(req.user.id).exec();
      if (user.isAdmin) {
        await Message.findByIdAndDelete(req.params.messageId);
        return res.status(200).end();
      }
    } catch (err) {
     return res.status(404).end();
    }
  } else {
    return res.status(401).end();
  }
})

app.post('/api/login', passport.authenticate('local'), (req, res) => {
  if (!req.user) { return res.status(401).json({ msg: req.authInfo.msg }) }
  return res.status(200).json({ user: req.user, msg: req.authInfo.msg });
});
app.post('/api/signup', user_controller.create_user);
app.post('/api/membership', async (req, res) => {
  // validate secret code
  if (req.isAuthenticated() && req.body.secret === 'VIP') {
    await User.findByIdAndUpdate(req.user.id, { isAdmin: true });
    res.status(200).end();
  } else {
    res.status(401).end();
  }
})
app.delete('/api/logout', (req, res, next) => {
  if (req.isAuthenticated()) {
    req.logout(function onLoggedOut(err) {
      if (err) {
        return next(err)
      }
      req.session.destroy(() => {
        res.status(200);
        res.end();
      })
    });
  }
  res.status(200).end();
});

// react routes
app.use(express.static(path.join(__dirname, 'client/build')));
// set virtual static paths
// app.use('/', express.static(path.join(__dirname, 'client')));
// app.use('/login', express.static(path.join(__dirname, 'client')));
// app.use('/signup', express.static(path.join(__dirname, 'client')));
// app.use('/membership', express.static(path.join(__dirname, 'client')));
// app.use('/logout', express.static(path.join(__dirname, 'client')));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
