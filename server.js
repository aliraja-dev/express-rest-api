const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const api = require('./server/routes/api');
const cookieSession = require('cookie-session');
const passport = require('passport');
const mongoose = require('mongoose');

const authRoutes = require('./server/routes/auth-routes');
const profileRoutes = require('./server/routes/profile-routes');
const keys = require('./config/keys');
const passportSetup = require('./config/passport-setup');

const app = express();
// set up session cookies
app.use(
  cookieSession({
    maxAge: 24 * 60 * 60 * 1000,
    keys: [keys.session.cookieKey]
  })
);
// initialize passport
app.use(passport.initialize());
app.use(passport.session());

//Connecting to Atlas db
const db = keys.mongodb.dbURI;
//* when we use connection string we should configure the options param as well and pass the dbname in it, as in the mongodb+srv string we cant pass the dbname
//* mongoose.Promise = global.Promise;
const options = {
  dbName: 'rekapp',
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  autoIndex: false, // Don't build indexes
  reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
  reconnectInterval: 500, // Reconnect every 500ms
  poolSize: 10, // Maintain up to 10 socket connections
  useUnifiedTopology: true,
  // If not connected, return errors immediately rather than waiting for reconnect
  bufferMaxEntries: 0,
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
};
//* converted the mongoose connect to async and await.
(async () => {
  try {
    await mongoose.connect(db, options);
    console.log("Mongodb Atlas Connected");
  }
  catch (err) { console.error }
})();

app.use(express.static(path.join(__dirname, 'www')));
app.use('/public/uploads', express.static('public/uploads'));
// Public Folder
// app.use(express.static("./public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/api', api);
// set up routes
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);

//serve static files on wild route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'www/index.html'));
});

// app.listen(port, function () {
//   console.log('server is running on localhost: ' + port);
// });

// const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
const port = 4000;
const server = app.listen(port, function () {
  console.log('Server listening on port ' + port);
});