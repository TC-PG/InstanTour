const Campground = require("../models/campground");
const Comment = require("../models/comment");
const User = require("../models/user");

//	all the middleware
const middlewareObj = {};

middlewareObj.checkCampgroundOwnership = function(req, res, next){
	if(req.isAuthenticated()){
			Campground.findById(req.params.id, function(err, foundCampground){
			if(err || !foundCampground){ //!foundCampground handling for null value, null is falesy
				req.flash("error", "找不到文章");
				res.redirect("/");
			}else{
				/**
					foundCampground.author.id : ObjectId of mongoose object
					req.user._id: String
				**/				
				if(foundCampground.author.id.equals(req.user._id) || req.user.isAdmin){
					next();
				}else{
					req.flash("error", "您無此操作權限");
					res.redirect("back");
				}				
			}
		});	
	}else{
		req.flash("error", "請先登入!");
		res.redirect("/login");
	}
}

middlewareObj.checkCommentOwnership = function(req, res, next){
	if(req.isAuthenticated()){
			Comment.findById(req.params.comment_id, function(err, foundComment){
			if(err || !foundComment){
				req.flash("error", "找不到此留言");
				res.redirect("back");
			}else{
				/**
					foundComment.author.id : ObjectId of mongoose object
					req.user._id: String
				**/				
				if(foundComment.author.id.equals(req.user._id) || req.user.isAdmin){
					next();
				}else{
					req.flash("error", "您無此操作權限");
					res.redirect("back");
				}				
			}
		});	
	}else{
		req.flash("error", "請先登入!");
		res.redirect("/login");
	}
}



//	check duplicate comment
middlewareObj.checkCommentAlreadyExisted = function(req, res, next){
	if(req.isAuthenticated()){
		Campground.findById(req.params.id).populate("comments").exec(function(err, foundCampground){
			if(err || !foundCampground){
				req.flash("error", "發生錯誤");
				return res.redirect("/");
			}
			let foundUserComment = foundCampground.comments.some(function (comment) {
                    return comment.author.id.equals(req.user._id);
                });
			if(foundUserComment){
				req.flash("error", "您已評論過此文章囉");
                return res.redirect("/campgrounds/" + foundCampground._id);
			}
			//	user not commented move on to next middleware
			next();
		});
	}else{
		req.flash("error", "請先登入!");
		res.redirect("/login");
	}
}


middlewareObj.isLoggedIn = function(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	
	req.flash("error", "請先登入!");
	res.redirect("/login");
}

middlewareObj.passwordValidation = function(req, res, next){
	const regex =  RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{6,})");	
		
	if(req.body.confirmPassword.length >= 0 && req.body.password !==  req.body.confirmPassword){
		req.flash("error", "密碼不一致");
		return res.redirect("back");
	}
	if(!regex.test(req.body.password)){
		req.flash("error", "密碼格式不符合");
		return res.redirect("back");
	}
	
	next();	
	
}



middlewareObj.isAdmin = function(req, res, next){	
	if(req.isAuthenticated()){
		User.findById(req.user._id, function(err, user){
			if(err){
				req.flash("error", "發生錯誤");
				return res.redirect("/");
			}
			if(!user){
			req.flash("error", "無此用戶");
			return res.redirect("back");
		}
			if(!user.isAdmin){
				req.flash("error", "您無操作權限");
				return res.redirect("back");
			}			
			next();
		});
	}else{
		req.flash("error", "請先登入");
		return res.redirect("/login");
	}
}


middlewareObj.isUserSuspended = function (req, res, next){	
	User.findOne({username: req.body.username}, function(err, user){
		if(err){
			req.flash("error", "發生錯誤");
			return res.redirect("/");
		}	
		if(!user){
			req.flash("error", "無此用戶");
			return res.redirect("back");
		}
		if(user.isSuspended){
			req.flash("error", "此用戶已被停權");
			return res.redirect("back");
		}
		next();
	});
}

middlewareObj.isArticleLocked = function(req, res, next){
	Campground.findById(req.params.id , function(err, foundCampground){
		if(err){
			req.flash("error", "發生錯誤");
			return res.redirect("/campgrounds/" + req.params.id);
		}
		if(!foundCampground){
			req.flash("error", "找不到文章");
			return res.redirect("/campgrounds/" + req.params.id);
		}
		if(foundCampground.isLocked){
			req.flash("error", "文章鎖定中，您無法修改或留言");
			return res.redirect("/campgrounds/" + req.params.id);
		}
		next();
	});
}

module.exports = middlewareObj;