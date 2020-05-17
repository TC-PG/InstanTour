const express = require("express");
const router = express.Router({mergeParams: true});
const Campground = require("../models/campground");
const Comment = require("../models/comment");
const middleware = require("../middleware");



//	Comments new
// router.get("/new", middleware.isLoggedIn, (req, res) => {
// 	Campground.findById(req.params.id, function(err, campground){
// 		if(err){
// 			console.log(err);
// 		}else{
// 			res.render("comments/new", {campground: campground});
// 		}
// 	});
	
// });

//	Comments create
router.post("/", middleware.isLoggedIn, middleware.checkCommentAlreadyExisted, middleware.isArticleLocked, function(req, res){	
	if(checkCommentString(req)){
		req.flash("error", "請輸入留言");
		return res.redirect("back");
	}
	if(req.body.comment.rating === "" || req.body.comment.rating === undefined){		
		req.flash("error", "請輸入評分");
		return res.redirect("back");
	}
	Campground.findById(req.params.id, function(err, campground){
		if(err){
			console.log(err);
			res.redirect("/campgrounds");
		}else{
			Comment.create(req.body.comment, function(err, comment){
				if(err){
					req.flash("error", "發生錯誤");
					console.log(err);
					res.redirect("/campgrounds");
				}else{					
					//	add username and id to comment
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
					//	 save to DB
					comment.save();
					campground.comments.push(comment);
					campground.save();
					req.flash("success", "留言新增成功");
					res.redirect("/campgrounds/"+ campground._id);
				}
			});
		}
	})
});

//	 show comment edit form
// router.get("/:comment_id/edit", middleware.checkCommentOwnership,(req, res) =>{
// 	Campground.findById(req.params.id, (err, foundCampground)=>{
// 		if(err || !foundCampground){
// 			req.flash("error", "Campground not found!");
// 			return res.redirect("back");
// 		}
		
// 		Comment.findById(req.params.comment_id, (err, foundComment) =>{
// 			if(err){
// 				res.redirect("back");
// 			}else{
// 				res.render("comments/edit", {campground_id: req.params.id, comment: foundComment});
// 			}
// 		});
// 	});
	
// });

//	comment update
router.put("/:comment_id", middleware.checkCommentOwnership, middleware.isArticleLocked,(req, res)=>{
	if(checkCommentString(req)){
		req.flash("error", "請輸入留言");
		return res.redirect("back");
	}
	if(req.body.comment.rating === "" || req.body.comment.rating === undefined){		
		req.flash("error", "請輸入評分");
		return res.redirect("back");
	}
	Campground.findById(req.params.id, (err, foundCampground)=>{
		if(err || !foundCampground){
			req.flash("error", "發生錯誤");
			return res.redirect("/campgrounds");
		}
		
		Comment.findByIdAndUpdate(req.params.comment_id,req.body.comment, (err, foundComment)=>{
			if(err){
				req.flash("error", "更新留言時發生錯誤");
				res.redirect("/campgrounds");
			}else{
				//	app.use("/campgrounds/:id/comments", commentRoutes);			
				res.redirect("/campgrounds/" + req.params.id);
			}
		});
	});
	
	
});

//	Comment Destroy ROUTE

router.delete("/:comment_id", middleware.checkCommentOwnership, middleware.isArticleLocked,(req, res)=>{	
	Comment.findByIdAndRemove(req.params.comment_id, (err)=>{
		if(err){
			req.flash("error", "刪除留言時發生錯誤");
			res.redirect("/campgrounds");
		}else{
			req.flash("success", "留言已成功刪除");
			res.redirect("/campgrounds/" + req.params.id);
		}
	});
});


//	check comment input
function checkCommentString(req, res){
	if(req.body.comment.text === "" || req.body.comment === undefined || req.body.comment.text.trim().length === 0){
		return true;
	}
	return false;
}


module.exports = router;