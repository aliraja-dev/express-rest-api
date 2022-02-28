const mongoose = require('mongoose');
const faceSchema = new mongoose.Schema({
  faceId: String,
  externalImageId: String,
  imageId: String,
  imageUrl: String,
  fullName: String,
  uploaderName: String,
  uploaderId: String,
  relationship: String,
  relations: [
    {
      faceId: String,
      fullName: String,
      relationship: String,
      imageUrl: String,
      isDP: Boolean
    }
  ],
});

module.exports = mongoose.model('Face', faceSchema, 'faces');

//* monngoose.model ("name by which we will export it", schema created above, the collection name in our db)
