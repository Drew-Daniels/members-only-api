import {NextFunction, Request, Response} from "express";
const User = require('../models/user');
const {check, validationResult} = require("express-validator");
const bcrypt = require("bcryptjs");

exports.create_user = [
  check('firstName').isLength( { min: 2, max: 30 }).withMessage('First Name must be between 2 and 30 characters.'),
  check('lastName').isLength({ min: 5, max: 30 }).withMessage('Last Name must be between 5 and 30 characters'),
  check('username').isEmail().withMessage('Username must be a valid email address'),
  check('password')
    .matches(/^(?=.*[A-Z].*[A-Z])(?=.*[!@#$&*])(?=.*[0-9].*[0-9])(?=.*[a-z].*[a-z].*[a-z]).{8,}$/)
    .withMessage('Must be a strong password that contains 2 uppercase letters, one special case letter, two digits, three lower case letters, and a length of 8 or more characters'),
  // @ts-ignore
  check('passwordConfirm').custom((value: string, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  }),
  async function onValidate(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const userExists = !!await User.count({ username: req.body.username }).exec()
    if (userExists) {
      res.status(409).send({ msg: 'A user with that username already exists' })
    }
    const { firstName, lastName, username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      firstName,
      lastName,
      username,
      hash,
    });
    user.save(function onSaveUser(err: Error) {
      if (err) return console.log(err);
      console.log('New user: ', user.username);
    });
    req.login(user, function (err: Error) {
      if (err) { return next(err); }
      res.status(200).json({ user });
    });
  }
];
