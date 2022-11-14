import * as mongoose from 'mongoose';
const {model, Schema} = mongoose;

const MessageSchema = new Schema({
  id: Schema.Types.ObjectId,
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  title: String,
  body: String,
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = model('Message', MessageSchema);
