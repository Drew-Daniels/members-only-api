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
const User = require('../models/user');
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
exports.create_user = [
    check('firstName').isLength({ min: 2, max: 30 }).withMessage('First Name must be between 2 and 30 characters.'),
    check('lastName').isLength({ min: 5, max: 30 }).withMessage('Last Name must be between 5 and 30 characters'),
    check('username').isEmail().withMessage('Username must be a valid email address'),
    check('password').isStrongPassword().withMessage('Password must be a strong password'),
    check('passwordConfirm').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Password confirmation does not match password');
        }
        return true;
    }),
    function onValidate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const userExists = !!(yield User.count({ username: req.body.username }).exec());
            if (userExists) {
                res.status(409).send({ msg: 'A user with that username already exists' });
            }
            const { firstName, lastName, username, password } = req.body;
            const hash = yield bcrypt.hash(password, 10);
            const user = new User({
                firstName,
                lastName,
                username,
                hash,
            });
            user.save(function onSaveUser(err) {
                if (err)
                    return console.log(err);
                console.log('New user: ', user.username);
            });
            req.login(user, function (err) {
                if (err) {
                    return next(err);
                }
                res.status(200).json({ user });
            });
        });
    }
];
