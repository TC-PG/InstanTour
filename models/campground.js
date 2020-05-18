const mongoose = require("mongoose");
const Comment = require('./comment');

//Schema Setup
const campgroundSchema = new mongoose.Schema({
	name:String,
	// image:String, // original for image url -- unused deletion
	photo: String,
	imageId: String,
	// price: String, // unused deletion
	description: String,
	location: String,
	lat: Number,
	lng: Number,
	createdAt: { type: Date, default: Date.now },
	isLocked: {type: Boolean, default: false},
	comments:[
		{
			type:　mongoose.Schema.Types.ObjectId,
			ref: "Comment"
		}
	],
	author:{
		id:{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		},
		username: String
	}
});

campgroundSchema.pre("deleteOne", { document: true, query: false }, async function(){
	try{
		await Comment.deleteMany({
			_id:{
				$in: this.comments
			} 
		});		
	}catch(err){
		console.log(err);
	}
	
});

//make model
const CAMPGROUND = mongoose.model("Campground", campgroundSchema);

module.exports = CAMPGROUND;