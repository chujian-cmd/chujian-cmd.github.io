//收藏
function getRemainSeconds(){var timenow = new Date();var second = timenow.getHours() * 3600;second += timenow.getMinutes() * 60;second += timenow.getSeconds();var remain = 86400 - second; return remain;} //今天剩余秒数
function getCookie(name){var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");if(arr=document.cookie.match(reg)) return unescape(arr[2]);else return null;}
function setCookieExpSecond(name,value,expSecond){var exp = new Date();exp.setTime(exp.getTime() + expSecond*1000);document.cookie = name + "="+ escape (value) + ";expires=" + exp.toGMTString();}
function GetRandomNum(Min,Max){var Range=Max-Min;var Rand=Math.random();return(Min+Math.round(Rand*Range));}
function myfavorite(gid){
	$.getJSON("//gprp.4399.com/cg/add_h5collection.php?gid="+gid+"&callback=?",function(result){
		if(result.status=="success"){
			if(result.is_new==true){
				alert('收藏成功了');
			}else{
				alert('你已经收藏过了哦');
			}
		}else{
			alert('收藏失败，请稍候重试');
		}
		return false;
	});
}
function delFavorite(gid){
	$.getJSON("//gprp.4399.com/cg/del_h5collection.php?gid="+gid+"&callback=?",function(result){
		if(result.status=="success"){
			$("#fav"+gid).hide(500);
		}else{
			alert('取消收藏失败，请稍候重试');
		}
		return false;
	});
}