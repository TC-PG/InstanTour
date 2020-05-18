const express = require("express");
const router = express.Router();
const Campground = require("../models/campground");
const middleware = require("../middleware");
const NodeGeoCoder = require("node-geocoder");
//	multer
const multer = require('multer');
const storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
const imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
		 req.fileValidationError = '圖檔格式不符合';
		  return cb(null, false, req.fileValidationError);	
     
    }
    cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: imageFilter})
//	cloudinary
const cloudinary = require('cloudinary');
cloudinary.config({ 
  cloud_name: 'dt4auxoqp', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
	}
});

//	 photo name edit
function editPhotoName(name){
	return "photo" + (name.substring(name.lastIndexOf("."))).toLowerCase();
}


//	Campground create -- add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single('upload_Photo'),async (req, res) =>{
	try{
		
		if(req.fileValidationError){
			req.flash("error", req.fileValidationError);
			return res.redirect("back");

		}
		if(!req.file){
			console.log(req.file)
			req.flash("error", "請上傳照片");
			return res.redirect("back");
		}

		let persistPhoto;
		let imageId;
		cloudinary.v2.uploader.upload(req.file.path, function(err,result) {
		persistPhoto = result.secure_url;
		imageId = result.public_id;
		let name = req.body.name;
	
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
		
			let newCampground = {
				name: name, 	
				photo: persistPhoto,
				imageId: imageId,
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
						req.flash("success", "發表成功");
						res.redirect("/campgrounds");
					}
				});
			});
		});
	}catch(err){
		console.log(err);
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

router.put("/:id", middleware.checkCampgroundOwnership, middleware.isArticleLocked, upload.single('photo'), async (req, res) =>{
	try{		
		if(req.fileValidationError){
			req.flash("error", req.fileValidationError);
			return res.redirect("back");
		}
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
			let description = req.body.description;	
			
			Campground.findById(req.params.id, async (err, campground) =>{
				if(err){
					req.flash("error", err.message);
					res.redirect("/campgrounds");
				}else{
					if(req.file){	
						try{
							await cloudinary.v2.uploader.destroy(campground.imageId);
							let result = await cloudinary.v2.uploader.upload(req.file.path);
							campground.photo = result.secure_url;
							campground.imageId = result.public_id;	
						}catch(err){
							if(err){
								req.flash("error", err.message);
								return res.redirect("/campgrounds");
							}
						}
					}
					campground.name = name;
					campground.description = description;
					campground.location = location;
					campground.lat = lat;
					campground.lng = lng;
					campground.save();
					req.flash("success", "文章更新成功");
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
	
	Campground.findById(req.params.id,  async function(err, campground){
		if(err){
			// return next(err);
			res.redirect("/campgrounds");
		}else{		
			try{
				await cloudinary.v2.uploader.destroy(campground.imageId);
				campground.deleteOne();
				req.flash("success", "文章刪除成功");
				return res.redirect("/campgrounds");
			}catch(err){
				if(err){
					req.flash("error", err.message);
					return res.redirect("/campgrounds");
				}		
			}
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