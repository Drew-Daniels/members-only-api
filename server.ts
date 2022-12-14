import {NextFunction, Request, Response} from "express";

var env = require('dotenv').config();
var envExpander = require('dotenv-expand');
envExpander.expand(env);

const express = require('express');
const logger = require('morgan');
var mongoose = require('mongoose');
const { check, validationResult } = require("express-validator");
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var cors = require('cors');

const corsOpts = {
  origin: process.env.ACCEPTED_CLIENT_ORIGIN, // production url
  credentials: true, // pass cookies on all requests
}

var User = require('./models/user');
var Message = require('./models/message');
const user_controller = require('./controllers/users');

import { IUser, IMessage } from "./types";

const app = express();

var PORT = process.env.PORT || 8080;
var mongoDB;
if (process.env.NODE_ENV === 'prod') {
  app.use(cors(corsOpts))
  mongoDB = process.env.DB_PROD;
} else {
  app.use(logger('dev'));
  mongoDB = process.env.DB_DEV;
}
// middleware to handle json responses
app.use(express.json());
// middleware to handle string responses
app.use(express.urlencoded({ extended: false }));

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const MINUTE = 1000 * 60
var store = new MongoDBStore({
  uri: mongoDB,
  collection: 'sessions',
});

store.on('error', function(error: Error) {
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
  function authenticateUser(username: string, password: string, done: Function) {
    User.findOne({ username }, async function onUserSearched(err: Error, user: IUser) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }// @ts-ignore
      const authenticated = await user.verifyPassword(password);
      if (!authenticated) { return done(null, false); }
      return done(null, user);
    });
  }
));

// user info to store on session
passport.serializeUser(function(user: IUser, cb: Function) {
  process.nextTick(function() {
    cb(null, { id: user._id, username: user.username });
  });
});
// user info to retrieve with info from session
passport.deserializeUser(function(user: IUser, cb: Function) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

// enable pre-flight requests for all routes
app.options('*', cors(corsOpts))

app.get('/api/auth', async (req: Request, res: Response) => {
  if (req.isAuthenticated()) {// @ts-ignore
    const user = await User.findById(req.user.id);
    res.status(200).json({ user: user });
  } else {
    res.status(200).json({ user: null });
  }
});

app.get('/api/messages', async (req: Request, res: Response) => {
  var messages;

  if (!req.isAuthenticated()) {
    messages = await getAnonymousMessages();
  } else {
    messages = await getMessages();
  }
  return res.status(200).json({ messages });

  async function getAnonymousMessages() {
    const messages = await getMessages();
    return messages.map((message: IMessage) => {
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
  async function onValidated(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // save to db
    const { author, title, body } = req.body;
    const message = await createMessage(author, title, body);
    res.status(200).json({ message });
    // send response
    async function createMessage(authorId: string, title: string, body: string) {
      const message = new Message({
        author,
        title,
        body
      });
      message.save(function onSaveMessage(err: Error) {
        if (err) return next(err);
      })
      return message;
    }
  }
]);

app.delete('/api/messages/:messageId', async (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    try {// @ts-ignore
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

app.post('/api/login', passport.authenticate('local'), (req: Request, res: Response) => {// @ts-ignore
  if (!req.user) { return res.status(401).json({ msg: req.authInfo.msg }) }// @ts-ignore
  return res.status(200).json({ user: req.user, msg: req.authInfo.msg });
});
app.post('/api/signup', user_controller.create_user);

app.post('/api/membership', async (req: Request, res: Response) => {
  // validate secret code
  if (req.isAuthenticated() && req.body.secret === 'VIP') {// @ts-ignore
    await User.findByIdAndUpdate(req.user.id, { isAdmin: true });
    res.status(200).end();
  } else {
    res.status(401).end();
  }
});

app.delete('/api/logout', (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    req.logout(function onLoggedOut(err: Error) {
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

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
