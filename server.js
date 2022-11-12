"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
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
var User = require('./models/user');
var Message = require('./models/message');
const user_controller = require('./controllers/users');
const app = express();
var PORT = process.env.PORT || 8080;
var mongoDB;
if (process.env.NODE_ENV === 'prod') {
    app.use(cors({ credentials: true, origin: process.env.ACCEPTED_CLIENT_ORIGIN }));
    mongoDB = process.env.DB_PROD;
}
else {
    app.use(logger('dev'));
    app.use(cors({ credentials: true, origin: /(localhost)/, }));
    mongoDB = process.env.DB_DEV;
}
// middleware to handle json responses
app.use(express.json());
// middleware to handle string responses
app.use(express.urlencoded({ extended: false }));
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
const MINUTE = 1000 * 60;
var store = new MongoDBStore({
    uri: mongoDB,
    collection: 'sessions',
});
store.on('error', function (error) {
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
passport.use(new LocalStrategy(function authenticateUser(username, password, done) {
    User.findOne({ username }, function onUserSearched(err, user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            const authenticated = yield user.verifyPassword(password);
            if (!authenticated) {
                return done(null, false);
            }
            return done(null, user);
        });
    });
}));
// user info to store on session
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user._id, username: user.username });
    });
});
// user info to retrieve with info from session
passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});
// api routes
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", process.env.ACCEPTED_CLIENT_ORIGIN);
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.get('/api/auth', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.isAuthenticated()) {
        const user = yield User.findById(req.user.id);
        res.status(200).json({ user: user });
    }
    else {
        res.status(200).json({ user: null });
    }
}));
app.get('/api/messages', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var messages;
    if (!req.isAuthenticated()) {
        messages = yield getAnonymousMessages();
    }
    else {
        messages = yield getMessages();
    }
    return res.status(200).json({ messages });
    function getAnonymousMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            const messages = yield getMessages();
            return messages.map((message) => {
                return {
                    author: { username: 'Anonymous' },
                    title: message.title,
                    body: message.body,
                    updatedAt: message.updatedAt,
                };
            });
        });
    }
    function getMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield Message.find().populate('author', 'username').exec()) || [];
        });
    }
}));
app.post('/api/messages', [
    check('author').isString().withMessage('author must be sent with message'),
    check('title').isString().isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
    check('body').isString().isLength({ min: 1, max: 300 }).withMessage('Body must be between 1 and 300 characters'),
    function onValidated(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            // save to db
            const { author, title, body } = req.body;
            const message = yield createMessage(author, title, body);
            res.status(200).json({ message });
            // send response
            function createMessage(authorId, title, body) {
                return __awaiter(this, void 0, void 0, function* () {
                    const message = new Message({
                        author,
                        title,
                        body
                    });
                    message.save(function onSaveMessage(err) {
                        if (err)
                            return next(err);
                    });
                    return message;
                });
            }
        });
    }
]);
app.delete('/api/messages/:messageId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.isAuthenticated()) {
        try {
            const user = yield User.findById(req.user.id).exec();
            if (user.isAdmin) {
                yield Message.findByIdAndDelete(req.params.messageId);
                return res.status(200).end();
            }
        }
        catch (err) {
            return res.status(404).end();
        }
    }
    else {
        return res.status(401).end();
    }
}));
app.post('/api/login', passport.authenticate('local'), (req, res) => {
    if (!req.user) {
        return res.status(401).json({ msg: req.authInfo.msg });
    }
    return res.status(200).json({ user: req.user, msg: req.authInfo.msg });
});
app.post('/api/signup', user_controller.create_user);
app.post('/api/membership', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // validate secret code
    if (req.isAuthenticated() && req.body.secret === 'VIP') {
        yield User.findByIdAndUpdate(req.user.id, { isAdmin: true });
        res.status(200).end();
    }
    else {
        res.status(401).end();
    }
}));
app.delete('/api/logout', (req, res, next) => {
    if (req.isAuthenticated()) {
        req.logout(function onLoggedOut(err) {
            if (err) {
                return next(err);
            }
            req.session.destroy(() => {
                res.status(200);
                res.end();
            });
        });
    }
    res.status(200).end();
});
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
