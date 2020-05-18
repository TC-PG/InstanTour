const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");
const middleware = require("../middleware");
const Campground = require("../models/campground");
const async = require("async");
const nodemailer = require("nodemailer");
const cryto = require("crypto");
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


//	root route
router.get("/", (req, res) => res.render("landing"));


// =============== AUTH ROUTE ==============

//	show signup form
router.get("/register", function(req, res){
	res.render("register", {page: "register"});
});

//	handle signup request
router.post("/register", middleware.passwordValidation, function(req, res){	
	const adminPage = "adminPage", userPage = "userPage";
	if(req.body.auth !== adminPage && req.body.auth !== userPage){
		req.flash("error", "發生錯誤，您無權訪問");
		return res.redirect("back");
	}
	
	if(req.body.email === "" || (req.body.email).length === 0){	
		req.flash("error", "請輸入信箱");
		return res.redirect("back");
	}
	
	let newUser;
	//	check either admin or regular user
	let adminCodeHash;	
	switch(req.body.auth){
		case adminPage:
			if(req.body.adminCode === undefined){
				req.flash("error", "請向管理員索取確認碼");
				return res.redirect("back");
			}
			if(req.body.adminCode === ""){	
				req.flash("error", "請向管理員索取確認碼");
				return res.redirect("back");
			}
			if(req.body.adminCode !== ""){
				adminCodeHash = generateHash(req.body.adminCode);
			}
			
			if(adminCodeHash !== process.env.adminCode){
				req.flash("error", "確認碼錯誤，請聯繫管理員");
				return res.redirect("back");
			}
			if(adminCodeHash === process.env.adminCode){
				newUser = new User({username: req.body.username, email:req.body.email, isAdmin: true});
			}
			break;
		case userPage:
			newUser = new User({username: req.body.username, email:req.body.email});
			break;
	}	
	
	
	User.register(newUser, req.body.password, function(err, user){
		if(err){
			if(err.name ==="MongoError" && err.code === 11000){
				req.flash("error", "信箱已註冊過")
				return res.redirect("back");
			}
			req.flash("error", err.message);			
			return res.redirect("back");
		}
		passport.authenticate("local")(req, res, function(){	
			req.flash("success", "您已註冊成功" );
			res.redirect("/campgrounds");
		});
	});
});


//	show login form
router.get("/login", function(req, res){
	res.render("login", {page: "login"});
});

//	handling login
router.post("/login", middleware.isUserSuspended, passport.authenticate("local",
	{
		successRedirect: "/campgrounds",
		failureRedirect: "/login",
		failureFlash: "使用者名稱或密碼錯誤"
	}),function(req, res){ });



//	logout route
router.get("/logout", function(req, res){
	req.logout();
	req.flash("success", "您已成功登出");
	res.redirect("/campgrounds");
});


//	show user profile from post
router.get("/users/:id", (req,res)=>{
	
	User.findById(req.params.id, (err, foundUser)=>{
		if(err){
			req.flash("error", "發生錯誤");
			res.redirect("/campgrounds");
		}else{
			Campground.find().where("author.id").equals(foundUser._id).exec(function(err, campgrounds){
				if(err){
					req.flash("error", "發生錯誤");
					return res.redirect("/campgrounds");
				}				
				res.render("users/show", {user: foundUser, campgrounds:campgrounds });
			});			
		}
	});
});


//	user update avatar

router.post("/users/:id", middleware.isLoggedIn, upload.single('avatar'), async (req, res) =>{

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


		User.findById(req.params.id, async (err, user) => {
			try{
				if(err){
				req.flash("error", "發生錯誤");
				return res.redirect("back");
				}
				if(!user.avatar){	// user avatar not existed	
					console.log(req.file.path)	
					let result = await cloudinary.v2.uploader.upload(req.file.path);
						user.avatar = result.secure_url;
						user.avatarId = result.public_id;

				}else{	//	user avatar existed
					await cloudinary.v2.uploader.destroy(user.avatarId);
					let result = await cloudinary.v2.uploader.upload(req.file.path);
					user.avatar = result.secure_url;
					user.avatarId = result.public_id;
				}
				user.save();
				return res.redirect("back");
			}catch(err){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}
			}		
		});
	}catch(err){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}
	}
		
});

//	remove user profile pic
router.put("/users/:id", middleware.isLoggedIn, function(req, res){	
	User.findById(req.params.id, async function(err, user){
		if(err){
			req.flash("error", "發生錯誤");
			return res.redirect("back");
		}
		
		try{
			await cloudinary.v2.uploader.destroy(user.avatarId);
			user.avatar= "";
			user.save();
			req.flash("success", "相片移除成功");
			return res.redirect("back");
		}catch(err){
			if(err){
				req.flash("error", "發生錯誤");
				return res.redirect("back");
			}
		}
		
	});
});

//	change password
router.post("/users/:id/editPwd", middleware.isLoggedIn, middleware.passwordValidation, (req, res)=>{
	User.findById(req.params.id, (err, user)=>{
		if(err){
			req.flash("error", "發生錯誤");
			return res.redirect("back");
		}
		user.changePassword(req.body.oldPassword, req.body.password, (err, user)=>{
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}
			req.logout();			
			req.flash("success", "密碼修改成功，請重新登入");			
			res.redirect("/campgrounds");
		});
	});	
});

// get forget password form
router.get("/forget", (req, res)=>{
	res.render("users/forget");
});

// forget password form
router.post("/forget", (req,res, next)=>{
	async.waterfall([
		function(done){
			cryto.randomBytes(20, function(err, buf){
				if(err){
					req.flash("error", "發生錯誤");			
					return res.redirect("/forget");
				}
				let token = buf.toString("hex");
				done(err, token);
			});
		},
		function(token, done){			
			User.findOne({username: req.body.username, email: req.body.email}, function(err, user){
				if(err){
					req.flash("error", err.message);			
					return res.redirect("/forget");
				}
				if(!user){
					req.flash("error", "請確認信箱地址或使用者名稱是否正確");			
					return res.redirect("/forget");
				}
				user.resetPasswordToken = token;
				user.resetPasswordExpires = Date.now() + 60 *1000 *5 //expires in 5 mins
				user.save(function(err){
					done(err, token, user);
				});
			});
		},
		function(token, user, done){
			let smtpTransport = nodemailer.createTransport({
				service: "Gmail",
				auth:{
					user:"side.project.practice@gmail.com",
					pass: process.env.GMAILPW
				}
			});
			
			let mailOptions = {
				to: user.email,
				from: "side.project.practice@gmail.com",
				subject: "(InstanTour) 密碼重置",
				text: "此為系統發送信件，您要求重置密碼，請點擊下方連結前往設定，\n" +
				"https://" + req.headers.host + "/reset/" + token + "\n" + 
				"此連結將於5分鐘後到期，如果您未要求重置密碼，請忽略此信件。"
			};
			smtpTransport.sendMail(mailOptions, function(err){
				if(err){
					req.flash("error", err.message);
					return res.redirect("/forget");
				}
				req.flash("success", "請前往信箱收信，如未收到，請檢查是否被置於垃圾信箱")
				done(err, "done");
			});
		}
	], function(err){
		if(err){
			req.flash("error", err.message);
			return res.redirect("/forget");
		}
			return res.redirect("/forget");
	});
});

//	get forget password reset form
router.get("/reset/:token", function(req, res){
	User.findOne({resetPasswordToken:req.params.token, resetPasswordExpires : {$gt:Date.now()} }, function(err, user){
		if(err){
			req.flash("error", err.message);
			return res.redirect("/forget");
		}
		if(!user){
			req.flash("error", "無效請求或有效期限已過期");
			return res.redirect("/forget");
		}
		
		res.render("users/reset", {token: req.params.token});
	});
});

//	forget password reset

router.post("/reset/:token", middleware.passwordValidation, (req, res)=>{
	async.waterfall([
		function(done){
			User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}}, function(err, user){
				if(err){
					req.flash("error", err.message);
					return res.redirect("back");
				}
				if(!user){
					req.flash("error", "無效請求或有效期限已過期");
					return res.redirect("back");
				}
				
				if(req.body.password ===  req.body.confirmPassword){
					user.setPassword(req.body.password, function(err){
						if(err){
							req.flash("error", err.message);
							return res.redirect("back");
						}
						user.resetPasswordToken = undefined;
						user.resetPasswordExpires = undefined;
						user.save(function(err){
							if(err){
								req.flash("error", err.message);
								return res.redirect("back");
							}
							// req.login(user, function(err){
								done(err,user);
							// });
						});
					});
				}else{
					req.flash("error", "密碼不一致");
					return res.redirect("back");
				}
			});
		}, 
		function(user, done){
			let smtpTransport = nodemailer.createTransport({
				service: "Gmail",
				auth:{
					user:"side.project.practice@gmail.com",
					pass: process.env.GMAILPW
				}
			});
			let mailOptions = {
				to: user.email,
				from: "side.project.practice@gmail.com",
				subject: "(InstanTour) 密碼重置成功",
				text: "此為系統發送之信件，您已成功重置密碼"				
			};
			smtpTransport.sendMail(mailOptions, function(err){				
				req.flash("success", "您已成功重置密碼，請重新登入")
				done(err);
			});			
		}
	], function(err){
		res.redirect("/campgrounds");
	});
});

//	edit user profile
router.post("/users/:id/editProfile", middleware.isLoggedIn,(req, res)=>{	
	User.findByIdAndUpdate(req.params.id, {email: req.body.email, introduction: req.body.introduction},(err, user)=>{
		if(err){
			req.flash("error", "發生錯誤");
			return res.redirect("back");
		}
		req.flash("success", "更新成功");
		return res.redirect("back");		
	});	
});

//	get admin register page

router.get("/admin/new", function(req, res){	
	req.logout();	
	res.render("admin/register");
});

// hash function
function generateHash(plaintext){
	return cryto.createHash('sha256').update(plaintext).digest('base64');
}


//	suspend user
router.put("/users/:id/suspend", middleware.isAdmin, function(req, res){
	User.findByIdAndUpdate(req.params.id, {isSuspended: true},function(err, user){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}
		if(!user){
			req.flash("error", "找不到用戶");
			return res.redirect("back");
		}
		req.flash("success", "成功停權此用戶");
		return res.redirect("back");
	});
});

//	show all users for admins
router.get("/users", middleware.isAdmin, function(req, res){
	let fuzzySearch = true;	
	let noMatch;
	if((req.query.search) === "all" || (req.query.search) === undefined){
		fuzzySearch = false;
	}
	if(fuzzySearch){
		const regex = new RegExp(escapeRegex(req.query.search), 'gi');
		User.find({username: regex}, function(err, users){
			if(err){
				req.flash("error", err.message);
				return res.redirect("back");
			}
			if(users.length === 0){
				noMatch = "抱歉，找不到用戶:" + req.query.search ;
			}
			res.render("admin/manageUsers", 
				{
					users: users,
					noMatch: noMatch,
					search: req.query.search
			});
		});
	}else{
		User.find({}, function(err, users){
		if(err){
			req.flash("error", err.message);
			return res.redirect("back");
		}
		if(!users){
			req.flash("error", "找不到用戶");
			return res.redirect("back");
		}
		
		res.render("admin/manageUsers", 
			{
				users: users,
				noMatch: noMatch,
				search: req.query.search
		});
	});
	}
});



//	//	fuzzy search regex decoration
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};


module.exports = router;