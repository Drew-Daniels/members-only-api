const Message = require('../models/message');

async function createMessage(authorId: string, title: string, body: string) {
  const message = new Message({
    authorId,
    title,
    body,
  });

  message.save(function onSave(err: Error) {
    if (err) return console.log(err);
  });
}
