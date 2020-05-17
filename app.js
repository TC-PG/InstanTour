//	env config
require('dotenv').config();

const express 	 = require("express"),
	  app 	   	 = express(),
	  bodyParser = require("body-parser"),
	  fileUpload = require("express-fileupload"),
	  CAMPGROUND = require("./models/campground"),
	  User = require("./models/user.js"),
	  Comment = require("./models/comment"),
	  seedDB = require("./seeds"),
	  mongoose   = require("mongoose"),
	  flash = require("connect-flash"),
	  passport = require("passport"),
	  LocalStategy = require("passport-local"),
	  methodOverride = require("method-override")



//	require routes
const commentRoutes = require("./routes/comments"),
	  campgroundRoutes = require("./routes/campgrounds"),
	  indexRoutes = require("./routes/index")
	  

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  createParentPath: true
}));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

let DBurl = process.env.DATABASEURL || "mongodb://localhost:27017/InstanTour";
// mongoose.connect('mongodb://localhost:27017/InstanTour', {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.connect(DBurl, {useNewUrlParser: true, useUnifiedTopology: true});
// Make Mongoose use `findOneAndUpdate()`. Note that this option is `true`
// by default, you need to set it to false.
mongoose.set('useFindAndModify', false);

//By default, Mongoose 5.x calls the MongoDB driver's ensureIndex() function. The MongoDB driver deprecated this function in favor of createIndex(). Set the useCreateIndex global option to opt in to making Mongoose use createIndex() instead.
mongoose.set('useCreateIndex', true);

// seedDB(); // fake dummy data on server startup

//	Passport config
app.use(require("express-session")({
	secret: "Once again Rusty wins cutest dog!",
	resave: false,
	saveUninitialized: false,
	cookie:{maxAge: 60 * 1000 * 30} //30分到期
}));

// momentjs
app.locals.moment = require('moment');

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);




app.listen(process.env.PORT || 3000, process.env.IP, ()=> console.log("The Server has started!"));