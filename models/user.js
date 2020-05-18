const mongoose = require("mongoose"),
	  passportLocalMongoose = require("passport-local-mongoose")

const UserSchema = new mongoose.Schema({
	username: String,
	password: String,
	createdAt:{type:Date, default:Date.now},
	email:{type: String, unique: true, required: true},
	resetPasswordToken: String,
	resetPasswordExpires: Date,
	avatar: String,
	avatarId: String,
	introduction:String,
	isAdmin: {type: Boolean, default:false},
	isSuspended: {type: Boolean, default:false}
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema)