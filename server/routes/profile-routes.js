const router = require('express').Router();

const authCheck = (req, res, next) => {
  if (!req.user) {
    //if not logged in send them to home on localhost
    res.redirect('/');
  } else {
    //if logged in, just calll the next function in the middleware stack
    next();
  }
};

router.get('/', authCheck, (req, res) => {
  res.send(req.user);
});

module.exports = router;
