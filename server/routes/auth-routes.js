const router = require('express').Router();
const passport = require('passport');
const queryString = require('querystring');
// auth login
router.get('/login', (req, res) => {
  //res.render("login", { user: req.user });
});

// auth logout
router.get('/logout', (req, res) => {

  req.logout();
  req.session = null;
  res.json({ msg: "user logged out" });

  // req.logout();
  // res.json({ msg: "user logged out" });
});

// auth with google+
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile']
  })
);

// callback route for google to redirect to
// hand control to passport to use code to grab profile info
router.get('/google/redirect', passport.authenticate('google'), (req, res) => {
  // console.log('inside google redirect route');
  // console.log('auth-routes req.user._id:', typeof req.user._id);
  // console.log('req.headers: ', req.headers);
  // res.setHeader("Access-Control-Allow-Origin", "*");
  // res.send(req.user);
  // res.redirect('/profile');
  //! Returning the userid from db, username and imageUrl.
  const query = queryString.stringify({
    //! we need to convert the record id for the user ie. BSON type to string to be used in our application, using ObjectId.toString()method.
    //* this user is the user that was found for the logged in user, from our db, every time an http request is sent. and the id field is the mongodb record id for Users Collection
    //TODO check as said in the netninja tuts, that the req.user.id is the same as req.user._id
    uuid: req.user._id.toString(),
    username: req.user.username
    // imageUrl: req.user.thumbnail
  });
  // res.redirect('/home/my-profile?' + query);
  res.redirect('/home/my-profile');
  // res.redirect(`${res.headers.referer}?` + query);
  // res.redirect("/search");
  // res.send("you reached the cb uri");
});

module.exports = router;
