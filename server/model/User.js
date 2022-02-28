const mongoose = require('mongoose');
const friends = require('mongoose-friends');
const userSchema = new mongoose.Schema({
  username: String,
  googleId: String,
  facebookId: String,
  thumbnail: String,
  searchHistory: [
    //TODO make a separate bucket to store search images on S3, and then store the key here.
    {
      fileName: String,
      imageUrl: String
    }
  ],
  watchedFaceIds: [],
  myFaces: [
    {
      faceId: String,
      fullName: String,
      relationship: String,
      imageUrl: String,
      isDP: Boolean
    }
  ],
  settings: {},
  joinedOn: Date,
  uuid: String,
  relations: [
    {
      userId: String,
      relationship: String
    }
  ],
  userImages: [
    {
      faceId: String,
      imageUrl: String,
    }
  ],
  friends: [
    {
      id: String,
      relationship: String,
      status: String,
      added: Date
    }
  ]
});

userSchema.plugin(friends({ pathName: "friends" }))

module.exports = mongoose.model('User', userSchema, 'users');

//!* monngoose.model ("name by which we will export it", schema created above, the collection name in our db)
