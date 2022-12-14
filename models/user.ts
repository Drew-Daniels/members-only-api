var bcrypt = require('bcryptjs');
import * as mongoose from 'mongoose';
const { model, Schema } = mongoose;

const UserSchema = new Schema({
  id: Schema.Types.ObjectId,
  firstName: String,
  lastName: String,
  username: String,
  hash: String,
  salt: String,
  isMember: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  methods: {
    async verifyPassword(password: string) {
      return bcrypt.compare(password, this.hash)
    },
  }
});

module.exports = model('User', UserSchema);
