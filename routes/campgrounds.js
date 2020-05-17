const express = require("express");
const router = express.Router();
const Campground = require("../models/campground");
const middleware = require("../middleware");
const fs_Extra = require('fs-extra');
const path = require('path');
const NodeGeoCoder = require("node-geocoder");

const options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
const geocoder = NodeGeoCoder(options);

//	INDEX- SHOW ALL CAMPGROUNDS
router.get("/", (req, res) =>{
	//	pagination
	let countsPerpage = 8;
	let pageQuery = parseInt(req.query.page);
	let pageNubmer = pageQuery ? pageQuery : 1;
	//	fuzzy search
	let noMatch;
	let fuzzySearch = true;	
	if((req.query.search) === "all" || (req.query.search) === undefined){
		fuzzySearch = false;
	}
	
	if(fuzzySearch){		
		const regex = new RegExp(escapeRegex(req.query.search), 'gi');
		Campground.find({name: regex}).skip((pageNubmer * countsPerpage)- countsPerpage).limit(countsPerpage).exec(function(err, allCampgrounds){
			Campground.countDocuments({name: regex}).exec(function(err, count){
				if(err){
					console.log(err);
					return res.redirect("back");
				}else{

				if(allCampgrounds.length === 0){
					noMatch = "抱歉，找不到標題為「" + req.query.search + "」的文章";
					// return res.render("campgrounds/index", 
					// 		{
					// 			campgrounds: allCampgrounds, 
					// 			currentPage: pageNubmer, 
					// 			allPages: Math.ceil(count/countsPerpage),
					// 			noMatch: noMatch
					// 		});
				}
				res.render("campgrounds/index", 
					{
						campgrounds: allCampgrounds,
						currentPage: pageNubmer,
						allPages: Math.ceil(count/countsPerpage),
						noMatch: noMatch,
						search: req.query.search
					});		
				}
			});
			
		});
	}else{
		//	pagination impl
		Campground.find({}).skip((pageNubmer * countsPerpage)- countsPerpage).limit(countsPerpage).exec(function(err, allCampgrounds){
			Campground.countDocuments().exec(function(err, count){
				if(err){
					console.log(err);
				}else{					
					res.render("campgrounds/index", 
						{
							campgrounds: allCampgrounds,
							currentPage: pageNubmer,
							allPages: Math.ceil(count/countsPerpage),
							noMatch: noMatch,
							search: "all"
						});
				}
			});
		});
		
		
		
		
		// Campground.find({}, function(err, allCampgrounds){
		// 	if(err){
		// 		console.log(err);
		// 	}else{
		// 		res.render("campgrounds/index", {campgrounds: allCampgrounds, page: "campgrounds", noMatch: noMatch});		
		// 	}
		// });
	}
});

//	 photo name edit
function editPhotoName(name){
	return "photo" + (name.substring(name.lastIndexOf("."))).toLowerCase();
}


//	Campground create -- add new campground to DB
router.post("/", middleware.isLoggedIn, async (req, res) =>{
	try{
		if(!req.files){
			req.flash("error", "請上傳照片");
			return res.redirect("back");
		}
		
		let photo = req.files.upload_Photo;
		//	檢查上傳檔案mimetype為image/jpeg 或image/png
		let flag = imageMIMECheck(photo);
		if(!flag){
			req.flash("error", "請上傳jpeg 或 png 格式之圖檔");
			return res.redirect("back");
		}
		
		let name = req.body.name;
		// let image = req.body.image;	// original for image url -- unused deletion	
		// let price = req.body.price;	// unused deletion
		let description = req.body.description;
		let author = {
			id: req.user._id,
			username: req.user.username
		};	
		//	geocoder
		geocoder.geocode(req.body.location, function (err, data) {
			if (err || !data.length) {
			  console.log(err);
			  req.flash('error', '無效地址');
			  return res.redirect('back');
			}
			let lat = data[0].latitude;
			let lng = data[0].longitude;
			let location = data[0].formattedAddress;

			let persistPhoto = editPhotoName(photo.name);
			// console.log("persistPhoto = " +persistPhoto);
			let newCampground = {
				name: name, 
				// image: image, // original for image url -- unused deletion
				photo: persistPhoto, 
				// price: price, // unused deletion
				description: description, 
				author: author,
				location: location, 
				lat: lat, 
				lng: lng
			};

			Campground.create(newCampground, function(err, newlyCreatedCapmground){
				if(err){
					console.log(err);
				}else{				
					//	move the file to directory -- path = /public/upload_photo/作者名稱/Campground._id/照片名稱
					photo.mv("./public/upload_photo/" + author.username + "//" + newlyCreatedCapmground._id + "//"+ persistPhoto);

					// console.log("newlyCreatedCapmground:\n" + newlyCreatedCapmground);
					res.redirect("/campgrounds");
				}
			});
		});
	}catch(err){
		req.flash("error", "發生錯誤");
		return res.redirect("back");
	}
	
});

//	display a form to make campground
router.get("/new", middleware.isLoggedIn, (req, res) =>{
	res.render("campgrounds/new");
});

//SHOW - shows more info about one campground
router.get("/:id", (req, res) =>{
	let id = req.params.id;
	Campground.findById(id).populate("comments").exec(function(err, foundCampground){
		if(err || !foundCampground){			
			req.flash("error", "找不到文章");
			res.redirect("/campgrounds");
		}else{
			let totalrating = 0;
			let commentCounts = foundCampground.comments.length
			foundCampground.comments.some(function(comment){
				totalrating += comment.rating;
			});			
			res.render("campgrounds/show", 
				{
					campground: foundCampground,
					averageRating: totalrating/commentCounts,
					totalReviews: commentCounts
				});
		}
	});
});


//	edit campground route
router.get("/:id/edit", middleware.checkCampgroundOwnership, middleware.isArticleLocked, (req, res) => {	
	Campground.findById(req.params.id, function(err, foundCampground){		
		res.render("campgrounds/edit", {campground: foundCampground});
	});		
});

// update campground

router.put("/:id", middleware.checkCampgroundOwnership, middleware.isArticleLocked, async (req, res) =>{
	try{
		//	geocoder
		geocoder.geocode(req.body.location, function (err, data) {
			if (err || !data.length) {
			  req.flash('error', '無效地址');
			  return res.redirect('back');
			}
			let lat = data[0].latitude;
			let lng = data[0].longitude;
			let location = data[0].formattedAddress;

			let name = req.body.name;
			let price = req.body.price;
			let image = req.body.image;
			let description = req.body.description;
			let updatePhoto= "";
			let updateData= {};
			let photo={};
			if(req.files){
				photo = req.files.photo;
				let flag = imageMIMECheck(photo);
				if(!flag){
					req.flash("error", "請上傳jpeg 或 png 格式之圖檔");
					return res.redirect("back");
				}
				updatePhoto = editPhotoName(photo.name);
				updateData = {
					name:name,
					price: price,
					image:image,
					photo: updatePhoto,
					description: description,
					location: location, 
					lat: lat, 
					lng: lng
				};
			}else{
				updateData = {
					name:name,
					price: price,
					image:image,				
					description: description,
					location: location, 
					lat: lat, 
					lng: lng
				};
			}		
			// console.log("updatePhoto: " + photo.name)
			// console.log("========================")

			Campground.findByIdAndUpdate(req.params.id, updateData, (err, updatedCampground) =>{
				if(err){
					res.redirect("/campgrounds");
				}else{
					if(req.files){
						photo.mv("./public/upload_photo/" + updatedCampground.author.username + "//" + updatedCampground._id + "//"+ updatePhoto);
					}				
					// console.log("updatedCampground: "+ updatedCampground);
					res.redirect("/campgrounds/" + req.params.id);
				}
			});
		});
	}catch(err){
		req.flash("error", "發生錯誤");
		return res.redirect("/campgrounds");
	}
	
});

//	DESTROY Campground route

router.delete("/:id", middleware.checkCampgroundOwnership, middleware.isArticleLocked, (req, res, next)=>{
	// Campground.findByIdAndRemove(req.params.id, (err) =>{
	// 	if(err){
	// 		res.redirect("/campgrounds");
	// 	}else{
	// 		res.redirect("/campgrounds");
	// 	}
	// });
	Campground.findById(req.params.id,  function(err, campground){
		if(err){
			// return next(err);
			res.redirect("/campgrounds");
		}else{
			
			
			let deleteFolder = path.join(__dirname, "../public/upload_photo/" + campground.author.username+"/" + campground._id);			
			if(fs_Extra.pathExistsSync(deleteFolder)){
				fs_Extra.removeSync(deleteFolder);
			}
			campground.deleteOne();
			
			req.flash("success", "文章刪除成功");
			res.redirect("/campgrounds");
		}
	});	
});



//	admin lock/unlock post impl
router.put("/:id/lock", middleware.isAdmin, (req, res)=>{
	Campground.findById(req.params.id, (err, foundCampground) =>{
		if(err){
			console.log(err);
			req.flash('error', "發生錯誤");
			return res.redirect('/campgrounds');
		}
		if(!foundCampground){
			req.flash('error', "找不到文章");
			return res.redirect('/campgrounds');
		}
		if(foundCampground.isLocked){
			Campground.findByIdAndUpdate(req.params.id, {isLocked: false}, (err, campground) =>{
				if(err){
					req.flash('error', "發生錯誤");
					return res.redirect('/campgrounds');
				}
				req.flash('success', "文章已解鎖");
				return res.redirect("/campgrounds/" + req.params.id);
			});	
		}
		
		if(!foundCampground.isLocked){
			Campground.findByIdAndUpdate(req.params.id, {isLocked: true}, (err, campground) =>{
				if(err){
					req.flash('error', "發生錯誤");
					return res.redirect('/campgrounds');
				}
				req.flash('success', "文章已鎖定");
				return res.redirect("/campgrounds/" + req.params.id);
			});	
		}
	});
});

//	fuzzy search regex decoration
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

// MIME type checking for jpeg/png
function imageMIMECheck(photo){
	let flag = true;
	if((photo.mimetype !== "image/jpeg") && flag){
		flag = false;
	}
	if ((photo.mimetype == "image/png")){
		flag = true;
	}
	
	return flag;
}


module.exports = router;