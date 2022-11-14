interface IUser {
  _id: string;
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  hash: string;
  salt: string;
  isMember: boolean;
  isAdmin: boolean;
}

interface IMessage {
  id: string;
  author: string;
  title: string;
  body: string;
  updatedAt: string;
}

export { IUser, IMessage };
