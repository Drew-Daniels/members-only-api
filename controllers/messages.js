const Message = require('../models/message');

async function createMessage(authorId, title, body) {
  const message = new Message({
    authorId,
    title,
    body,
  });

  message.save(function onSave(err) {
    if (err) return console.log(err);
  });
}