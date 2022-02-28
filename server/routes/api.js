const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const async = require('async');
const ObjectId = require('mongoose').Types.ObjectId;
const fs = require('fs');
AWS.config.update({ region: 'us-east-2' });
var rekognition = new AWS.Rekognition({ apiVersion: '2016-06-27' });
var s3 = new AWS.S3();

const Face = require('../model/Face');
const User = require('../model/User');

let filename = '';
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'gotchya.uploads',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(
        null,
        (filename =
          file.fieldname + '-' + Date.now() + path.extname(file.originalname))
      );
    },
    fileFilter: function (req, file, cb) {
      checkFileType(file, cb);
    }
  })
}).single('image');

//! check file type
function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

//!GET USER DATA FROM DB for signed in user (((gotchya alpha01)))
router.get('/user', (req, res) => {
  if (!req.user) res.send(null);
  else {
    async.parallel({
      user: (cb) => {
        User.findById(req.user.id).then(user => {
          console.log("user to the store from api.js", user);
          cb(null, user);
        })
      },
      acceptedFriends: (cb) => {
        User.getAcceptedFriends(req.user.id, function (err, friendships) {
          cb(null, friendships);
        })
      },
      pendingFriends: (cb) => {
        User.getPendingFriends(req.user.id, function (err, friendships) {
          cb(null, friendships);
        })
      },
      requestedFriends: (cb) => {
        User.getRequestedFriends(req.user.id, function (err, friendships) {
          cb(null, friendships);
        })
      }
    }, (err, results) => {
      if (err) console.error(err);
      let response = { ...results.user.toObject(), acceptedFriends: results.acceptedFriends, requestedFriends: results.requestedFriends, pendingFriends: results.pendingFriends };

      console.log("results from async parallel", response);
      res.send(response);
    });


  }
});

router.get('/user/:userId', (req, res) => {
  if (!req.params.userId) res.send(null);
  else {
    async.parallel({
      userProfile: (cb) => {
        User.findById(req.params.userId).then(userProfile => {
          console.log("Other User to the store from api.js", userProfile);
          cb(null, userProfile);
        })
      },
      acceptedFriends: (cb) => {
        User.getAcceptedFriends(req.params.userId, function (err, friendships) {
          cb(null, friendships);
        })
      }
    }, (err, results) => {
      if (err) console.error(err);
      let response = { ...results.userProfile.toObject(), acceptedFriends: results.acceptedFriends, requestedFriends: [], pendingFriends: [] };

      console.log("results from async parallel on user page load", response);
      res.send(response);
    });
  }
});

router.post('/friend-request', (req, res) => {
  console.log(req.user.id, "req.body", req.body);
  User.requestFriend(req.user.id, req.body.userProfileId,
    req.body.relationship,
    result => {
      console.log("result of mongoose-friends", result);
      res.status(200).send({ status: "request sent" })
    })

});

router.post('/confirm-request', (req, res) => {
  console.log(req.user.id, "req.body", req.body);
  async.series([
    //* first in series is saving the confirmation request
    (cb) => {
      User.requestFriend(req.user.id, req.body.requesterId,
        req.body.relationship,
        result => {
          console.log("result of mongoose-friends", result);
          cb(null, result);
        })
    },
    //* second in series is getting the user updated records from db
    (cb) => {
      async.parallel({
        user: (cb) => {
          User.findById(req.user.id).then(user => {
            console.log("user to the store from api.js", user);
            cb(null, user);
          })
        },
        acceptedFriends: (cb) => {
          User.getAcceptedFriends(req.user.id, function (err, friendships) {
            cb(null, friendships);
          })
        },
        pendingFriends: (cb) => {
          User.getPendingFriends(req.user.id, function (err, friendships) {
            cb(null, friendships);
          })
        },
        requestedFriends: (cb) => {
          User.getRequestedFriends(req.user.id, function (err, friendships) {
            cb(null, friendships);
          })
        }
      }, (err, results) => {
        if (err) console.error(err);
        let response = { ...results.user.toObject(), acceptedFriends: results.acceptedFriends, requestedFriends: results.requestedFriends, pendingFriends: results.pendingFriends };

        console.log("results from async parallel", response);
        cb(null, response);
      })
    },
    //* this is getting the user PRofile data from the db after confirming request
    (cb) => {
      async.parallel({
        userProfile: (cb) => {
          User.findById(req.body.requesterId).then(userProfile => {
            console.log("Other User to the store from api.js", userProfile);
            cb(null, userProfile);
          })
        },
        acceptedFriends: (cb) => {
          User.getAcceptedFriends(req.user.id, function (err, friendships) {
            cb(null, friendships);
          })
        }
      }, (err, results) => {
        if (err) console.error(err);
        let response = { ...results.userProfile.toObject(), acceptedFriends: results.acceptedFriends, requestedFriends: [], pendingFriends: [] };

        console.log("results from async parallel", response);
        cb(null, response);
      })
    }
  ], (err, result) => {
    console.log("series response after confirmation ", result);
    res.send({ user: result[1], userProfile: result[2] });
  })
});

router.post('/remove-relation', (req, res) => {
  // * we need to covert the string id to Object ID for the removeFriend function to work https://github.com/numbers1311407/mongoose-friends/issues/8
  var user1Id = new ObjectId(req.user.id);
  var user2Id = new ObjectId(req.body.id);
  console.log("AT REMOVE ROUTE, req.body.id", req.body.id)
  if (!req.body.id) res.send("no id found");
  User.removeFriend(user1Id, user2Id, (result) => {
    "result of mongoose-friends remove friend request", result;
    res.status(200).json("removed")
  })
});

//! UPLOAD IMAGES ROUTE to the server public/uploads folder
router.post('/upload-image', (req, res) => {
  console.log('inside image upload route');
  upload(req, res, err => {
    if (err) {
      res.status(400).json({
        msg: err
      });
    } else {
      if (req.file == undefined) {
        res.status(404).json({
          msg: err
        });
      } else {
        console.log('filename from api.js', filename);

        //* Indexing the Face into the gotchya-us-east-2 collection
        var params = {
          CollectionId: 'gotchya-us-east-2' /* required */,
          Image: {
            S3Object: { Bucket: 'gotchya.uploads', Name: filename }
          },
          DetectionAttributes: ['DEFAULT'],
          ExternalImageId: filename,
          MaxFaces: '1',
          QualityFilter: 'AUTO'
        };
        rekognition.indexFaces(params, function (err, data) {
          if (err) console.log(err, err.stack);
          // an error occurred
          else {
            // console.log(
            //   'Index Face REsult',
            //   data.FaceRecords[0].Face.FaceId,
            //   data.FaceRecords[0].Face.ExternalImageId,
            //   data.FaceRecords[0].Face.ImageId
            // );
            // console.log(data);
            var newFace = new Face();
            newFace.faceId = data.FaceRecords[0].Face.FaceId;
            newFace.externalImageId = data.FaceRecords[0].Face.ExternalImageId;
            newFace.ImageId = data.FaceRecords[0].Face.ImageId;
            //TODO get form data for the name and the relationship, see how multer gives you that.
            newFace.fullName = req.body.fullName;
            newFace.uploaderName = req.user.username;
            newFace.uploaderId = req.user.id;
            newFace.relationship = req.body.relation;
            newFace.relations = req.user.myFaces;
            newFace.imageUrl = `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${filename}`;
            //TODO if not signed in req.user will be empty, we need to show a sign in modal to sign in.
            // console.log('this is inside the index function ' + req.user);
            // console.log('this is mongoID ' + req.user.id);
            //! To save the FaceId in the same users document inside the users collection
            User.updateOne(
              { _id: req.user.id },
              {
                $push: {
                  //* push the face saved as an object into myFaces array of the user
                  myFaces: {
                    faceId: data.FaceRecords[0].Face.FaceId,
                    fullName: req.body.fullName,
                    relationship: req.body.relation,
                    imageUrl: `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${filename}`
                  }
                }
              }
            ).then(response => console.log(response));

            //! saving the Face data in faces collection
            newFace.save(function (err, insertedFace) {
              if (err) {
                console.log(
                  'inside face save in the face collection error',
                  err
                );
              } else {
                // console.log('insertedFace', insertedFace);
                // return res.status(200).json(insertedFace);
              }
            });
          } // successful response
        });
        //* sending the response back to the observable, in json
        res.status(200).json({
          msg: 'File Uploaded!',
          imageName: filename,
          imageUrl: `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${filename}`
        });
      }
    }
  });
  //* upload function of multer closes here
});

router.post('/update-profile', (req, res) => {

  console.log('inside update-profile route');
  upload(req, res, err => {
    if (err) {
      res.status(400).json({
        msg: err
      });
    } else {
      if (req.file == undefined) {
        res.status(404).json({
          msg: err
        });
      } else {
        console.log('filename from api.js', filename);

        //* Indexing the Face into the gotchya-us-east-2 collection
        var params = {
          CollectionId: 'gotchya-us-east-2' /* required */,
          Image: {
            S3Object: { Bucket: 'gotchya.uploads', Name: filename }
          },
          DetectionAttributes: ['DEFAULT'],
          ExternalImageId: filename,
          MaxFaces: '1',
          QualityFilter: 'AUTO'
        };
        rekognition.indexFaces(params, function (err, data) {
          if (err) console.log(err, err.stack);
          // an error occurred
          else {
            console.log(
              'Index Face REsult',
              data.FaceRecords[0].Face.FaceId,
              data.FaceRecords[0].Face.ExternalImageId,
              data.FaceRecords[0].Face.ImageId
            );
            console.log(data);
            var newFace = new Face();
            newFace.faceId = data.FaceRecords[0].Face.FaceId;
            newFace.externalImageId = data.FaceRecords[0].Face.ExternalImageId;
            newFace.ImageId = data.FaceRecords[0].Face.ImageId;
            //TODO get form data for the name and the relationship, see how multer gives you that.
            newFace.fullName = req.user.username;
            newFace.uploaderName = req.user.username;
            newFace.userId = req.user.id;
            newFace.relations = req.user.myFaces;
            newFace.relationship = 'self';
            newFace.imageUrl = `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${filename}`;
            //TODO if not signed in req.user will be empty, we need to show a sign in modal to sign in.
            console.log('this is inside the index function ' + req.user);
            console.log('this is mongoID ' + req.user.id);
            //! To save the FaceId in the same users document inside the users collection
            User.updateOne(
              { _id: req.user.id },
              {
                $push: {
                  //* push the face saved as an object into myFaces array of the user
                  userImages: {
                    faceId: data.FaceRecords[0].Face.FaceId,
                    imageUrl: `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${filename}`
                  }
                }
              }
            ).then(response => console.log(response));

            //! saving the Face data in faces collection
            newFace.save(function (err, insertedFace) {
              if (err) {
                console.log(
                  'inside face save in the face collection error',
                  err
                );
              } else {
                console.log('insertedFace', insertedFace);
                // return res.status(200).json(insertedFace);
              }
            });
          } // successful response
        });
        //* sending the response back to the observable, in json
        res.status(200).json({
          msg: 'Profile Edited',
          imageName: filename,
          imageUrl: `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${filename}`
        });
      }
    }
  });
});
//! SEARCH FACE MATCHES ROUTE
router.post('/search-face', (req, res) => {
  upload(req, res, err => {
    if (err) {
      res.status(400).json({
        msg: err
      });
    } else {
      if (req.file == undefined) {
        res.status(404).json({
          msg: err
        });
      } else {
        console.log('filename from searchroute', filename);
        let searchedImageUrl = `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${filename}`;
        //* creating params for rekognition search
        var params = {
          CollectionId: "gotchya-us-east-2" /* required */,
          Image: {
            S3Object: { Bucket: 'gotchya.uploads', Name: filename }
          },
          FaceMatchThreshold: 90,
          MaxFaces: "100"
        };

        rekognition.searchFacesByImage(params, function (err, data) {
          if (err) {
            console.log(err, err.stack);
          }
          else {
            //! append search History
            if (req.user) {
              User.updateOne(
                { _id: req.user.id },
                {
                  $push: {
                    //* push the face saved as an object into myFaces array of the user
                    searchHistory: {
                      fileName: filename,
                      imageUrl: searchedImageUrl
                    }
                  }
                }
              ).then(response => console.log("search history added to user", response));
            } else {
              s3.deleteObject({
                Bucket: 'gotchya.uploads',
                Key: filename
              }, (err, data) => {
                if (err) console.log(err); console.log("result from deleting searched image from s3", data);
              });
              searchedImageUrl = null
            }
            // * the result from rekognition API
            // console.log("DATA", data);
            let matchResults = [];
            // console.log("index", index)
            // console.log("FaceID", value.Face.FaceId);
            // console.log("External Image Id", value.Face.ExternalImageId);
            // console.log("Confidence", value.Face.Confidence);
            if (data.FaceMatches.length > 0) {
              let faceIdsArray = [];
              data.FaceMatches.forEach(value => faceIdsArray.push(value.Face.FaceId));

              Face.find({ faceId: { $in: faceIdsArray } }).exec().then(
                (matchResults) => {
                  console.log("Match Results for FaceIDs returned", matchResults);
                  res.status(200).json({
                    msg: 'Match found',
                    resultsArray: matchResults,
                    searchedImageUrl: searchedImageUrl
                  });
                }
              );
            } else {
              res.status(200).json({ msg: 'Match not found', resultsArray: [], searchedImageUrl })
            }
            //*else block closes here from rekognition
          }
        });
      }
    }
  }
  );
});

router.post('/reSearch-face', (req, res) => {
  if (!req.body.fileName) res.send("no file Name sent with request");
  var params = {
    CollectionId: "gotchya-us-east-2" /* required */,
    Image: {
      S3Object: { Bucket: 'gotchya.uploads', Name: req.body.fileName }
    },
    FaceMatchThreshold: 90,
    MaxFaces: "100"
  };
  //TODO searched imageURl isnt being sent back in response on research route
  let searchedImageUrl = `https://s3.us-east-2.amazonaws.com/gotchya.uploads/${req.body.filename}`;
  rekognition.searchFacesByImage(params, function (err, data) {
    if (err) {
      console.log(err, err.stack);
    }
    else {
      // * the result from rekognition API
      // console.log("DATA", data);
      let matchResults = [];
      // console.log("index", index)
      // console.log("FaceID", value.Face.FaceId);
      // console.log("External Image Id", value.Face.ExternalImageId);
      // console.log("Confidence", value.Face.Confidence);
      if (data.FaceMatches.length > 0) {
        let faceIdsArray = [];
        data.FaceMatches.forEach(value => faceIdsArray.push(value.Face.FaceId));

        Face.find({ faceId: { $in: faceIdsArray } }).exec().then(
          (matchResults) => {
            console.log("Match Results for FaceIDs returned", matchResults);
            res.status(200).json({
              msg: 'Match found',
              resultsArray: matchResults,

            });
          }
        );
      } else {
        res.status(200).json({ msg: 'Match not found', resultsArray: [] })
      }
      //*else block closes here from rekognition
    }
  });
});


router.get('/clear-search-history', (req, res) => {
  if (!req.user) { res.send("User Not Logged In to delete search History"); }
  else {
    // * make an array of all the images present in user history to be deleted from the s3 as well
    let objects = [];
    req.user.searchHistory.forEach(item => {
      objects.push({ Key: item.fileName })
    })
    User.updateOne(
      { _id: req.user.id },
      {
        $set: {
          //* delete the search History from mongodb
          searchHistory: []
        }
      }
    ).then(response => console.log("deleted all history", response));
    // * also delete the images from the s3 storage
    s3.deleteObjects({
      Bucket: 'gotchya.uploads',
      Delete: {
        Objects: objects,
        Quiet: false
      }
    }, (err, data) => {
      if (err) console.log(err); console.log("deleted from s3", data);
      res.status(200).json({ msg: "History cleared" });
    });
  }
});
router.get('/', (req, res) => { res.send("api works, wow") })
module.exports = router;
