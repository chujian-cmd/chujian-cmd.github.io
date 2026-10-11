/**
 * 播放logo进度条
 */
 function showLogoProgress(time) {
    if (!time) {
        return;
    }
    var playLogoTimeInterval = time / 100;
    var logoFrameName = "#api4399_logoFrame";
    var tempProgressNum = 0;
    playProgress();


    /**
     * 播放进度条
     */
    function playProgress() {
        tempProgressNum++;
        progress(tempProgressNum);
        if (tempProgressNum < 100) {
            setTimeout(playProgress, playLogoTimeInterval);
        }
    }

    /**
     * 进度条控制
     * @param progressNum
     * @param progressStr
     */
    function progress(progressNum, progressStr) {
        var div = getChildOfName(logoFrameName);
        if (!div) {
            div = createLogoFrame();
        }
        var pie1 = getChildOfName(".pie1");
        var pie2 = getChildOfName(".pie2");
        var percent = getChildOfName(".word em");
        var rotate = progressNum * 3.6; //角度
        if (rotate >= 0 && rotate <= 180) {
            setRotate(pie1, rotate);
        } else if (rotate >= 180 && rotate <= 360) {
            setRotate(pie1, 180);
            pie2.style.background = "#fff000";
            setRotate(pie2, rotate);
        }
        percent.innerHTML = progressNum + "%";
        if (progressNum >= 100) {
            setTimeout(hideProgress, 500);
        }

    }

    /**
     * 隐藏LOGO层
     */
    function hideProgress() {
        div.style.display = "none";
    }

    /**
     * 创建LOGO层
     */
    function createLogoFrame() {
        var css = [
                logoFrameName + " {opacity:1;position:fixed;left:0;top:0;z-index:9947483646;width:100%;height:100%;z-index:9947483646;font-size:12px;color:#585649;background:url(//h.4399.com/images/play/bg.png) center top no-repeat #32aae4;}",
                logoFrameName + " .cf{overflow:hidden;*zoom:1}",
                logoFrameName + " .cf:after{content:'';display:block;height:0;clear:both;}",
                logoFrameName + " .fl{float:left;}",
                logoFrameName + " .fr{float:right;}",
                logoFrameName + " .logo{position:fixed;top:12%;left:50%;margin-left:-100px;z-index:3}",
                logoFrameName + " .footer{position:fixed;bottom:10%;left:50%;margin-left:-110px;z-index:2}",
                logoFrameName + " .box{position:fixed;top:50%;left:50%;width:400px;margin:-134px 0 0 -200px;z-index:1}",
                logoFrameName + " .box p{height:36px;line-height:36px;color:#116498;font-size:12px;text-align:center}",
                logoFrameName + " .load{position:relative;top:0;left:50%;width:100px;height:100px;margin-left:-50px;}",
                logoFrameName + " .load .circle{position:absolute;top:0;left:0;width:100px;height:100px;background:#fff;border-radius:50%}",
                logoFrameName + " .load .pie1,.load .pie2{position:absolute;width:100px;height:100px;background:#fff000;clip:rect(0,50px,100px,0);border-radius:50%;}",//transition:all .2s ease;-webkit-transition:all .2s ease;-o-transition:all .2s ease;
                logoFrameName + " .load .pie2{background:#fff;}",
                logoFrameName + " .load .cover{position:relative;top:5px;left:5px;width:90px;height:90px;background:#45ccff;border-radius:50%}",
                logoFrameName + " .word{position:absolute;top:30px;left:0;width:100px;text-align:center}",
                logoFrameName + " .word span{font-size:12px;display:block;line-height:30px;color:#fff;margin:0;padding:0;list-style:none;vertical-align:middle;}",
                logoFrameName + " .word em{font-size:12px;color:#fff000;margin:0;padding:0;list-style:none;font-style:normal;vertical-align:top;}",
                logoFrameName + " .agetxt{text-align: center;margin-top: 56px;color: #116498;position: relative;z-index: 3;}",
                logoFrameName + " .footer{bottom: 4%;}",
                logoFrameName + " .ageBtn{position: fixed;right:15px;top:80%;z-index: 2;}",
                logoFrameName + " .ageBtn img{width: 40px;height: 52px;display: block;}",
                logoFrameName + " .pop-limit{width: 300px;background-color: #fff;border-radius: 10px;padding:10px 5px;position: absolute;top: 14%;left: 50%;margin-left: -155px;z-index: 100;display: none;text-align: justify;color: #666 ;font-size: 12px;text-align: justify;}",
                logoFrameName + " .pop-limit .pop-close{font-size: 16px;position: absolute;right: 10px;top: 10px;cursor: pointer;width: 20px;height:20px;color: #fff;text-align: center;line-height: 20px;background-color: #f60;}",
                logoFrameName + " .pop-limit .pop-tit{text-align: center;font-size: 16px;line-height: 30px;font-weight: 700;}",
                logoFrameName + " .pop-limit .pop-limittxt{max-height: 300px;overflow: hidden;overflow-y: auto;}",
                logoFrameName + " .pop-limit .pop-limittxt p { margin-top:10px; position: relative;*zoom:1;padding: 0 10px 0 24px;}",
                logoFrameName + " .pop-limit .pop-limittxt p i{width: 16px;height: 16px;text-align: center;line-height: 16px;background-color: #66c852;color: #fff;position: absolute;left:4px;top: 0px;border-radius: 50%;font-size: 12px;}",
                logoFrameName + " .pop-limittxt li a {color: #f60;text-decoration: underline;}",
                "@media screen and (min-width:600px) { #api4399_logoFrame .pop-limit{width: 500px;margin-left: -255px;top: 8%;}#api4399_logoFrame .footer{display: none;}#api4399_logoFrame .agetxt{margin-top: 10px;}#api4399_logoFrame .box{margin:-60px 0 0 -200px}#api4399_logoFrame .logo{top: 5%;}#api4399_logoFrame .box{top: 40%;}#api4399_logoFrame .load{width: 80px;height: 80px;}#api4399_logoFrame .box p{height: 30px;line-height: 30px;}#api4399_logoFrame .load .circle{width:80px;height: 80px;}#api4399_logoFrame .load .pie1, .load .pie2{width: 80px;height: 80px;clip: rect(0,40px,80px,0);}#api4399_logoFrame .load .cover{width: 70px;height: 70px;}#api4399_logoFrame .word{top: 18px;width: 80px;}"
               

        ];
        createStyle(css.join(""));
        div = document.createElement("div");
        div.id = logoFrameName.slice(1);
        div.innerHTML = [
            '<div class="logo">',
            '<img src="//h.4399.com/images/play/logo_1.png" width="200"/>',
            '</div>',
            '<div class="box">',
            '<div class="load">',
            '<div class="circle"></div>',
            '<div class="pie1"></div>',
            '<div class="pie2"></div>',
            '<div class="cover"></div>',
            '<div class="word">',
            '<span>游戏载入中...</span>',
            '<em>0%</em>',
            '</div>',
            '</div>',
            '<p>（如长时间无响应，请刷新页面）</p>',
            '<p>抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。</p>',
            '<p>适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。</p>',
            '<p>游戏纠纷处理电话：0592-5054399</p>',
            '<div class="agetxt"></div>',
            '</div>',
            '<div class="ageBtn" id="ageBtn"></div>',
            '<div class="footer">',
            '<img src="//h.4399.com/images/play/footer.png" width="220"/>',
            '</div>',
            '<div class="pop-limit"  id="poplimit"> <span class="pop-close" id="popClose">×</span><div class="pop-tit">适龄提示</div><div class="pop-limittxt"></div></div>'
        ].join(" ");
        document.body.appendChild(div);
        div.addEventListener("touchstart", stopEvent);
        div.addEventListener("mousedown", stopEvent);
        shiling();
        return div;
    }

    /**
     * 创建CSS样式表
     * @param css
     * @param cssDoc
     */
    function createStyle(css, cssDoc) {
        var doc = cssDoc || document;
        var style = doc.createElement("style");
        style.type = "text/css";
        doc.getElementsByTagName("head")[0].appendChild(style);
        if (style.styleSheet)
            style.styleSheet.cssText = css;
        else
            style.appendChild(doc.createTextNode(css));
    }

    /**
     * 依照对象名获取对象
     * @param name              对象名
     * @param parent            父类
     */
    function getChildOfName(name, parent) {
        parent = parent || document;
        return parent.querySelector(name);
    }

    /**
     * 设置对应组件的旋转属性
     * @param element       组件
     * @param rotate        旋转角度
     */
    function setRotate(element, rotate) {
        element.style.webkitTransform = "rotate(" + rotate + "deg)";
        element.style.MozTransform = "rotate(" + rotate + "deg)";
        element.style.msTransform = "rotate(" + rotate + "deg)";
        element.style.OTransform = "rotate(" + rotate + "deg)";
        element.style.transform = "rotate(" + rotate + "deg)";
    }

    /**
     * 监听点击事件 并禁止向下传递，用于面板下不可点击
     * @param e
     */
    function stopEvent(e) {
        if (e) {
            // e.preventDefault();
            e.stopPropagation();
        }
    }
}


    //适龄
	function shiling(){
        var nURL = location.hostname.replace(".h.4399.com","").replace("h.4399.com","");
        if(nURL==""){
            nURL = "www.4399.com";
        }else{
            nURL = nURL+".4399.com";
        }
        $.ajax({
            dataType:'script',
            scriptCharset:'utf-8',
            url:"//"+nURL+"/age/"+nFlashId+".js",
            success:function(){
                $(".pop-limittxt").html(age__str);
                $("#ageBtn").html('<img src="'+age__ageimg+'"/>');

                $(".ageBtn").click(function(){
                    $(".pop-limit").fadeIn();
                })
                $("#poplimit .pop-close").click(function(){
                    $(".pop-limit").fadeOut();
                })
            }
        });
    }
    shiling();

    function show_adult_notice_in_page(){
        $(".agetxt").html('您的认证信息为成年，不受防沉迷限制');
        try{
            var frm = document.getElementById('gamelink'); 
			if(frm.contentWindow && typeof frm.contentWindow.show_adult_notice_in_page == 'function'){
				$(frm).load(function(){//等iframe加载完毕  
					frm.contentWindow.show_adult_notice_in_page();
				});
			}
        }catch(e){}
    }