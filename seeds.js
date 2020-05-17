const mongoose = require("mongoose");
const Campground = require("./models/campground");
const Comment = require("./models/comment");
const fs_Extra = require('fs-extra');
const path = require('path');

const data = [
	{
		name: "梵蒂岡博物館",
		image:"",
		photo:"Vatican_Museums_Rome_Italy.jpeg",
		description: "梵蒂岡博物館位於梵蒂岡城內，由羅馬梵蒂岡大道可達。梵蒂岡博物館是世界上最偉大的博物館之一，其中的藏品是多個世紀以來羅馬天主教會收集、積累的成果。博物館於1984年作為梵蒂岡城一部份被列入世界文化遺產。 16世紀時，教宗儒略二世創建了博物館。遊客在遊覽梵蒂岡博物館時會經過由米開朗基羅裝飾的西斯汀小堂和拉斐爾房間。",
		author:{
            id : "588c2e092403d111454fff76",
            username: "Jack"
        }
	},
	{
		name: "巨石陣",
		image:"",
		photo:"stonehenge-at-dusk.jpg",
		description: "巨石陣，位於英格蘭威爾特郡埃姆斯伯里，英國的旅遊熱點，每年都有100萬人從世界各地慕名前來參觀。巨石陣是英國最著名的建築。巨石陣也叫做圓形石林，位於英國離倫敦大約120公里一個叫做埃姆斯伯里的地方。那裡的幾十塊巨石圍成一個大圓圈，其中一些石塊足有六米之高。據估計，圓形石林已經在這個一馬平川的平原上矗立了幾千年。",
		author:{
            id : "588c2e092403d111454fff71",
            username: "Jill"
        }
	},
	{
		name: "艾菲爾鐵塔",
		image:"",
		photo:"eiffel_tower.jpeg",
		description: "艾菲爾鐵塔是位於法國巴黎第七區、塞納河畔戰神廣場的鐵製鏤空塔，世界著名建築，也是法國文化象徵之一，巴黎城市地標之一，巴黎最高建築物。正式地址為Rue Anatole-France 5號。 艾菲爾鐵塔建成於1889年，初名為「三百米塔」，後得名自其設計師居斯塔夫·艾菲爾。",
		author:{
            id : "588c2e092403d111454fff77",
            username: "Jane"
        }
	}
]

function seedDB(){
	//	wipe everthing out from the db
	Campground.deleteMany({}, function(err){
		if(err){
			console.log(err);
		}else{
			console.log("Campgrounds移除成功!");
			
			Comment.deleteMany({}, function(err){
				if(err){
					console.log(err);
				}
				console.log("Comments移除成功");
				//insert dummy sample data
				data.forEach(function(seed){
					Campground.create(seed, function(err, createdCampground){
						if(err){
							console.log(err);
						}else{
							console.log("初始Campground新建成功!");
							// console.log(createdCampground);
							let file = createdCampground.photo;
							/**
								複製初始照片資料由seeds資料夾至public/upload_photo/
							*/
							let sourceDir = path.join(__dirname, "./seeds/" + createdCampground.author.username+"/");
							let deleteFolder = path.join(__dirname, "./public/upload_photo/" + createdCampground.author.username+"/");
							let destDir = path.join(__dirname, "./public/upload_photo/" + createdCampground.author.username + "/" + createdCampground._id+"/");
							if(fs_Extra.pathExistsSync(deleteFolder)){
								fs_Extra.removeSync(deleteFolder);
							}
							
							if (!fs_Extra.pathExistsSync(destDir)){
								fs_Extra.ensureDirSync(destDir, { recursive: true });
							}

							//copy directory content including subfolders
							fs_Extra.copy(sourceDir, destDir, function (err) {
							  if (err) {
								console.error(err);
							  } else {
								console.log("初始照片資料複製成功");
							  }
							}); 
							
							Comment.create({
								text: "感謝大大分享",
                                author:{
                                    id : "588c2e092403d111454fff76",
                                    username: "Jack"
                                }
							}, function(err, comment){
								if(err){
									console.log(err);
								}else{
									createdCampground.comments.push(comment);
									createdCampground.save();
									console.log("初始留言新增成功!");
								}
							});
						}
					});
		
				});
				
			});			
			
		}
	 });
	
	
	
	
}

module.exports = seedDB;

