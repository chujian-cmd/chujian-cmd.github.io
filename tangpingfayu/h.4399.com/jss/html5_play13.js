//document.getElementById("gamename").innerHTML = gamename;
var yes_load_game_url = false;
function start_game(){
    if(!yes_load_game_url){
        document.getElementById("gamelink").src = webServer+gameiframe;
        yes_load_game_url = true;
    }
	

	//调用函数，获取数值
	findDimensions();
	//window.addEventListener("onorientationchange" in window ? "orientationchange" : "resize", findDimensions, false);
	window.onorientationchange = findDimensions;
	window.onresize = findDimensions;
	if(isblack==1){showLogoProgress(5000);}
}
var winWidth = 0;
var winHeight = 0;
var viewable_width = 0;
var viewable_height = 0;
var is_hide_trip = false;

function is_weixn(){  
	var ua = navigator.userAgent.toLowerCase();  
	if(ua.match(/MicroMessenger/i)=="micromessenger") {  
		return true;  
	}else {  
		return false;  
	}  
}

function is_QQ(){
	var ua = navigator.userAgent.toLowerCase();  
	if(ua.match(/QQ/i)=="qq") {  
		return true;  
	}else {  
		return false;  
	}  
}

function check_mobile(){
	var ua = navigator.userAgent;ua = ua ? ua.toLowerCase().replace(/-/g, "") : "";
	if((/4399GameCenter/gi).test(ua)){return "guest4399";}
	if (ua.match(/(Android)/i)){return "android";}
	if (ua.match(/(iPhone|iPod)/i)){return "iphone";}
	if (ua.match(/(iPad)/i)){return "ipad";}
	//UC Browser
	if (ua.match(/(U;)/i)){if (ua.match(/(Adr)/i)){return "android";}}
	if (ua.match(/(U;)/i)){if (ua.match(/(iPh)/i)){return "iphone";}}
	if (ua.match(/(U;)/i)){if (ua.match(/(iPd)/i)){return "ipad";}}
}

function moregame(){
	if(check_mobile()=="android" || check_mobile()=="iphone" || check_mobile()=="ipad"){
		window.location.href = "http://h.4399.com/";
	}
}

function findDimensions(){
	
	//获取窗口宽度
	if (window.innerWidth)
	winWidth = window.innerWidth;
	else if ((document.body) && (document.body.clientWidth))
	winWidth = document.body.clientWidth;
	//获取窗口高度
	if (window.innerHeight)
		winHeight = window.innerHeight;
	else if ((document.body) && (document.body.clientHeight))
		winHeight = document.body.clientHeight;
	if (document.documentElement && document.documentElement.clientHeight && document.documentElement.clientWidth){
		winHeight = document.documentElement.clientHeight;
		winWidth = document.documentElement.clientWidth;
	}
	//可显示区域尺寸
	viewable_width = parseInt(winWidth);
	viewable_height = parseInt(winHeight);
	if(viewable_width>0 && viewable_height>0){
		document.getElementById("gamelink").width = viewable_width+"px";
		document.getElementById("gamelink").height = viewable_height+"px";
		document.getElementById("sgame").style.width = viewable_width+"px";
		document.getElementById("sgame").style.height = viewable_height+"px";
	}
	//弹层自适应
	if(hashtml5FinishTrip){
		var pop = document.getElementById('pop');
		if(pop.style.display=="block"){
			var shadow = document.getElementById('shadow');
			pop.style.left = parseInt((viewable_width - 280)/2)+"px";
			pop.style.top = parseInt((viewable_height - 160)/2)+"px";
		}
	}
	//分数/排行榜弹窗自适应
	try{
		var _scoreWin = document.getElementById('scoreWin');
		_scoreWin.style.left = parseInt((viewable_width - 298)/2)+"px";
		_scoreWin.style.top = parseInt((viewable_height - 228)/2)+"px";
		var _scoreWinNoLogin = document.getElementById('scoreWinNoLogin');
		_scoreWinNoLogin.style.left = parseInt((viewable_width - 298)/2)+"px";
		_scoreWinNoLogin.style.top = parseInt((viewable_height - 228)/2)+"px";
		var _listWin = document.getElementById('listWin');
		_listWin.style.left = parseInt((viewable_width - 298)/2)+"px";
		_listWin.style.top = parseInt((viewable_height - 361)/2)+"px";
		
	}catch(e){}
	if(is_weixn() || is_QQ() || check_mobile()=="guest4399" || (/4399wan/gi).test(ua)){
		
	}else{
		checkorientation();
	}
}

//判断方向
function getorientation(){
	if(window.orientation==180||window.orientation==0){//竖向 1
		return 2;
	}else if(window.orientation==90||window.orientation==-90){//横向 0
		return 1;
	}
}

function checkorientation(){
	// 如果有弹出悬浮窗时，则不显示这个弹窗
	if(is_hide_trip){return true;}
	if(html5orientation==1 && getorientation()==2){
		openWin2("show","请横屏开始游戏<a href='http://v.4399pk.com/h5/h5howto.htm' style='text-decoration:underline;height:16px;line-height:16px;float:right;margin:15px 0;display:block;margin-right:20px;font-size:15px;color:#999;vertical-align:top;'><img src='/images/jt.gif' style='height:16px;position:relative;top:0px;right:2px;vertical-align:top;'>如何开启横屏?</a>");
	}else if(html5orientation==2 && getorientation()==1){
		openWin2("show","请竖屏开始游戏<a href='http://v.4399pk.com/h5/h5howto.htm' style='text-decoration:underline;height:16px;line-height:16px;float:right;margin:15px 0;display:block;margin-right:20px;font-size:15px;color:#999;vertical-align:top;'><img src='/images/jt.gif' style='height:16px;position:relative;top:0px;right:2px;vertical-align:top;'>如何开启竖屏?</a>");
	}else{
		closetrip();
	}
}


var title = document.title;
//微信分享
/*******
var loadScript = function(url, callback) {
	var script = document.createElement("script");
	script.type = "text/javascript";
	script.src = url;
	if (script.readyState) {
		script.onreadystatechange = function() {
			if (script.readyState == "loaded" || script.readyState == "complete") { 
				script.onreadystatechange = null;
				callback(); 
			}
		};
	} else {
		script.onload = function() { callback(); }; 
	}
	document.body.appendChild(script);
};
function shareApiOld(title,desc,img,url){
	document.addEventListener('WeixinJSBridgeReady', function onBridgeReady() {
		WeixinJSBridge.on('menu:share:appmessage', function (argv) {
			WeixinJSBridge.invoke('sendAppMessage', {
				'img_url': img,
				'img_width': '640',
				'img_height': '640',
				'link': url,
				'desc': desc,
				'title': title
			}, function (res) {closeshare();});
		});
		WeixinJSBridge.on('menu:share:timeline', function (argv) {
			WeixinJSBridge.invoke('shareTimeline', {
				'img_url': img,
				'img_width': '640',
				'img_height': '640',
				'link': url,
				'desc': desc,
				'title': title
			}, function (res) {closeshare();});
		});
	}, false);
}
function jsApiShare(title,desc,img,url){
	loadScript('http://res.wx.qq.com/open/js/jweixin-1.0.0.js',function(){
		loadScript('http://huodong3.4399.com/weixin/jsapi/microMessagerShareH5.php?r='+Math.random(),function(){
			wxApiConfig.jsApiList = ['onMenuShareTimeline', 'onMenuShareAppMessage'];
			wx.config(wxApiConfig);
			wx.ready(function(){
				var shareData = {
					title: title,
					desc: desc,
					link: url,
					imgUrl: img,
					success: function(){},
					cancel: function(){}
				}
				//alert(shareData.desc);
				wx.onMenuShareAppMessage(shareData);
				wx.onMenuShareTimeline(shareData);
			});
		});
	});
}

function WXshare(title,url,desc,img){
	var a = navigator.userAgent;
	if(a.indexOf('MicroMessenger')>-1){
		var _match = a.match(/MicroMessenger\/([0-9\.]+)/);
		var version = _match[1];
		if(version>'6'){
			jsApiShare(title,desc,img,url);			
		}
		else{
			shareApiOld(title,desc,img,url);
		}
	}
}
if(is_weixn() == true){WXshare(title,WXurl,WXmsg,WXimg);}
*******/
//游戏结束回调函数
function __4399finishgame(note){
	if(is_weixn() == true){//仅仅在微信中才有效
		// 游戏名使用{name},分数使用{score},排行名次使用{rank},战胜率使用{percent} 
		var html5FinishTrips = html5FinishTrip.replace('{name}',gamename).replace('{score}',note);
		//openWin("show",html5FinishTrips);
		//WXshare(title,WXurl,html5FinishTrips,WXimg);
		///WXshare(html5FinishTrips,WXurl,title,WXimg);//直接修改标题
	}
}

function openWin(flag,note) {
	var pop = document.getElementById('pop');
	var shadow = document.getElementById('shadow');
	if (flag == 'show') {
		pop.style.left = parseInt((viewable_width - 280)/2)+"px";
		pop.style.top = parseInt((viewable_height - 250)/2)+"px";
		pop.style.display = 'block';
		shadow.style.display = 'block';
	}else{
		pop.style.display = 'none';
		shadow.style.display = 'none';
	}
	if(note){
		note = '<center><img width="171" height="44" src="/images/word.png"></center>' + note;
		document.getElementById("html5FinishTrip").innerHTML = note;
	}
}

function openWin2(flag,note) {
	var pop = document.getElementById('pop2');
	var shadow = document.getElementById('shadow');
	if (flag == 'show') {
		pop.style.left = parseInt((viewable_width - 280)/2)+"px";
		pop.style.top = parseInt((viewable_height - 156)/2)+"px";
		pop.style.display = 'block';
		shadow.style.display = 'block';
	}else{
		pop.style.display = 'none';
		shadow.style.display = 'none';
	}
	if(note){
		note = '<center><img width="171" height="44" src="/images/word.png" style="margin-bottom:7px;"><br>'+note+'</center>';
		document.getElementById("message").innerHTML = note;
	}
}

function showshare(){
	document.getElementById('share').style.display = 'block';
	document.getElementById('pop').style.display = 'none';
}

function closeshare(){
	document.getElementById('share').style.display = 'none';
	document.getElementById('shadow').style.display = 'none';
}

function resumeGame(){
	document.getElementById('pop').style.display = 'none';
	document.getElementById('shadow').style.display = 'none';
}

function closetrip(){
	document.getElementById('pop2').style.display = 'none';
	document.getElementById('shadow').style.display = 'none';
}

(function() {
	// 监听 message方式 
	var WindowMessageHandler = {  
		//初始化
		init: function() {  
			var that = this;  
			window.addEventListener('message', function(e) { 
				console.log("收到信息：",e,e.origin,e.data);
				if (!that.isValidOrigin(e.origin)) {  
					return;  
				}  
				var methodName = 'handle' + e.data.eventType.charAt(0).toUpperCase() + e.data.eventType.slice(1);  
				if (typeof that[methodName] === 'function') {  
					that[methodName](e.data['data']);  
				}
			});  
		},  
		
		// 对gamelink这个iframe 发送postMessage
		sendMessage: function(data, targetOrigin) {  
			targetOrigin = targetOrigin || "*";  
			var receiver = document.getElementById('gamelink');  
			if (receiver && receiver.contentWindow) {  
				receiver.contentWindow.postMessage(data, targetOrigin);  
			} else {  
				console.error('Receiver window not found');  
			}  
		},

		//判断是否来自4399.com的消息
		isValidOrigin: function(origin) {  
			return origin.includes("4399.com");  
		},
		
		// 重置 resize orientation的方法。
		handleResetResize: function(data) {  
			if (data.is_open === 1) { 
				window.is_hide_trip = true;
			} else {  
				window.is_hide_trip = false;
			}  
		},  

		// 退出全屏
		handleTopExitFullScreen : function(data){
			try {
				if (document.exitFullscreen) {
					document.exitFullscreen();
				} else if (document.mozCancelFullScreen) {
					document.mozCancelFullScreen();
				} else if (document.webkitExitFullscreen) {
					document.webkitExitFullscreen();
				} else if (document.msExitFullscreen) {
					document.msExitFullscreen();
				}
			} catch (error) {
				console.error(error);
			}
		},

	  	// 全屏代码 
		handleTopFullScreen: function(data) {  
			try {
				var domEl = document.documentElement;
				if (domEl.requestFullscreen) {
				domEl.requestFullscreen();
				} else if (domEl.mozRequestFullScreen) {
				domEl.mozRequestFullScreen();
				} else if (domEl.webkitRequestFullscreen) {
				domEl.webkitRequestFullscreen();
				} else if (domEl.msRequestFullscreen) {
				domEl.msRequestFullscreen();
				}
			} catch (error) {
				console.error(error);
			}
	  	},

		// 判断是否全屏状态 
		handleTopSupportedFullScreen: function(data) {  
			var isEnabled =
			document.fullscreenEnabled ||
			document.webkitFullscreenEnabled ||
			document.mozFullScreenEnabled ||
			document.msFullscreenEnabled;
			this.sendMessage({
				eventType: "setSupportedFullScreen",
				data: {
				isSupportedFullScreen: isEnabled,
				},
			});
		}  
	};  
	
	WindowMessageHandler.init();  
  })();