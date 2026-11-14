/* Shared MOD panel; each platform supplies its own reward adapter. */
(function(){
 var adapter=window.RoadKingModPlatform||{id:'233',requestReward:function(){return window.request233Reward?window.request233Reward():Promise.resolve({success:false,reason:'sdk_missing'});},hostName:'233 乐园'};
 var fanAuthorized=false;
 var root=document.documentElement;root.setAttribute('data-platform','toy');
 var extras=[['storm','雷雨','密集雨丝与偶尔闪电'],['fog','薄雾','柔和雾气，远景朦胧'],['snow','大雪','飘雪与冬日能见度']];
 // All preferences and formal unlocks use the common store installed by boot.js.
 var settings=window.RoadKingSettings,enabled=[];
 function sync(){enabled=settings.get('assistant').weather;root.setAttribute('data-weather-enabled',enabled.join(','));}
 sync();
 var ball=document.createElement('button');ball.type='button';ball.className='mod233-ball';ball.setAttribute('aria-label','打开粉丝助手');ball.textContent='粉丝\n助手';document.body.appendChild(ball);
 var overlay=document.createElement('div');overlay.className='mod233-overlay';overlay.hidden=true;
 var categories=[['drive','驾驶增强']];
 var cards={drive:[['invincible','无敌驾驶','碰撞不受伤，撞飞其他车辆','盾'],['cruise','定速驾驶','保持目标速度，踩刹车退出','速'],['speed','极速模式','最高速度上限提升至 9999','∞'],['drone','无人机常驻','正常、狂暴模式也可召唤无人机','飞'],['autoReverse','掉头倒车','掉头完成后自动切换倒车挡','↶']]};
 function card(item){var extra=item[0]==='rampInterval'?'<div class="mod233-interval"><label for="mod233-ramp-interval">出现间隔 <output id="mod233-ramp-value" for="mod233-ramp-interval">1000 米</output></label><input id="mod233-ramp-interval" type="range" min="200" max="2000" step="100" value="1000" aria-label="斜坡车出现间隔" disabled><div><span>200 米 · 频繁</span><span>2000 米 · 稀少</span></div></div>':item[0]==='cruise'?'<div class="mod233-setting"><span>目标速度</span><span class="mod233-value">300 <small>km/h</small></span></div>':item[0]==='density'?'<div class="mod233-pills"><span>空路</span><span>稀疏</span><span class="selected">正常</span><span>密集</span></div>':'';return '<article class="mod233-card"><div class="mod233-card-head"><span class="mod233-icon" aria-hidden="true">'+item[3]+'</span><div><h3>'+item[1]+'</h3><p>'+item[2]+'</p></div></div>'+extra+'<div class="mod233-card-foot"><span class="mod233-access" data-state="'+item[0]+'"></span><button type="button" data-feature="'+item[0]+'" aria-label="关注作者解锁'+item[1]+'"><span aria-hidden="true">▷</span> 关注作者解锁</button></div></article>';}
 overlay.innerHTML='<section class="mod233-panel" role="dialog" aria-modal="true" aria-labelledby="mod233-title"><header><div><h2 id="mod233-title">粉丝助手</h2></div><button type="button" data-close aria-label="关闭粉丝助手">×</button></header><div class="mod233-tabs" role="tablist" aria-label="模组分类">'+categories.map(function(c,i){return '<button type="button" role="tab" data-tab="'+c[0]+'" id="mod233-tab-'+c[0]+'" aria-controls="mod233-page-'+c[0]+'" aria-selected="'+(i===0)+'">'+c[1]+'</button>';}).join('')+'</div><div class="mod233-content">'+categories.map(function(c,i){return '<div id="mod233-page-'+c[0]+'" role="tabpanel" aria-labelledby="mod233-tab-'+c[0]+'" '+(i?'hidden':'')+'>'+cards[c[0]].map(card).join('')+'</div>';}).join('')+'</div><div class="mod233-status" hidden></div></section>';
 overlay.querySelector('.mod233-tabs').remove();var page=overlay.querySelector('[role=tabpanel]');page.setAttribute('role','group');page.removeAttribute('aria-labelledby');page.setAttribute('aria-label','驾驶增强');document.body.appendChild(overlay);
 var unlockedFeatures={},previewOn={},target=300,densityMode='normal',rampInterval=1000;
 function readPreferences(){
  var s=settings.get();unlockedFeatures=fanAuthorized?{invincible:true,cruise:true,speed:true,drone:true,autoReverse:true}:{};previewOn=s.mods.on;
  target=s.mods.target;densityMode=s.mods.density;rampInterval=s.mods.rampInterval;
 }
 function publishMods(patch){
  if(patch)settings.set('mods',patch);
  readPreferences();sync();
  var data={on:previewOn,unlocked:unlockedFeatures,target:target,density:densityMode,rampInterval:rampInterval};
  root.setAttribute('data-mod-settings',JSON.stringify(data));
 }
 function setFeature(k,on){var patch={};patch[k]=on;publishMods({on:patch});}
 publishMods();
 window.addEventListener('mod233-cancel-cruise',function(){setFeature('cruise',false);paint();overlay.querySelector('.mod233-status').textContent='已踩刹车，定速驾驶退出';});
 function isWeather(k){return extras.some(function(x){return x[0]===k;});}
 function paint(){categories.forEach(function(c){cards[c[0]].forEach(function(item){var k=item[0],on=!!previewOn[k]&&unlockedFeatures[k]===true,unlocked=unlockedFeatures[k]===true,b=overlay.querySelector('[data-feature="'+k+'"]'),state=overlay.querySelector('[data-state="'+k+'"]');
 state.textContent=unlocked?(on?'已启用':'已关闭'):'';
 b.textContent=unlocked?(on?'关闭':'启用'):'▷ 关注作者解锁';b.setAttribute('aria-label',(unlocked?(on?'关闭':'启用'):'关注作者解锁')+item[1]);b.setAttribute('data-unlocked',String(unlocked));
 var article=b.closest('article');article.classList.toggle('is-unlocked',unlocked);
 var interval=article.querySelector('#mod233-ramp-interval');if(interval){interval.disabled=!unlocked;interval.value=String(rampInterval);overlay.querySelector('#mod233-ramp-value').textContent=rampInterval+' 米';}
 var settings=article.querySelector('.mod233-setting');if(settings&&!settings.querySelector('button'))settings.innerHTML='<span>目标速度</span><button id="mod233-speed" type="button" data-speed-edit aria-label="设置目标速度" aria-haspopup="dialog">300</button><small>km/h</small>';
 if(settings){var input=settings.querySelector('button');input.disabled=!unlocked;input.textContent=String(target);}
 var pills=article.querySelector('.mod233-pills');if(pills&&!pills.querySelector('button'))pills.innerHTML=['空路','稀疏','正常','密集'].map(function(label){return '<button type="button" data-density="'+label+'" aria-pressed="'+(label==='正常')+'">'+label+'</button>';}).join('');
 if(pills)pills.querySelectorAll('button').forEach(function(button){button.disabled=!unlocked;button.setAttribute('aria-pressed',String({'空路':'empty','稀疏':'sparse','正常':'normal','密集':'dense'}[button.dataset.density]===densityMode));});
 });});}
 var keypad=document.createElement('div'),draft='',replaceDigit=true;
 keypad.className='mod233-keypad';keypad.hidden=true;
 keypad.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="mod233-keypad-title"><header><h3 id="mod233-keypad-title">目标速度</h3><button type="button" data-pad="cancel" aria-label="取消输入">×</button></header><div class="mod233-keypad-value"><output aria-live="polite">300</output><small>km/h</small></div><p>0–300 km/h</p><div class="mod233-keypad-grid">'+['1','2','3','4','5','6','7','8','9','clear','0','delete'].map(function(k){return '<button type="button" data-pad="'+k+'">'+(k==='clear'?'清空':k==='delete'?'删除':k)+'</button>';}).join('')+'</div><button type="button" class="mod233-keypad-confirm" data-pad="ok">确认</button></section>';
 overlay.appendChild(keypad);
 function closeKeypad(){keypad.hidden=true;overlay.querySelector('.mod233-panel').removeAttribute('aria-hidden');var edit=overlay.querySelector('[data-speed-edit]');if(edit)edit.focus({preventScroll:true});}
 function padKey(k){
  if(k==='cancel'){closeKeypad();return;}
  if(k==='ok'){target=Math.min(300,Number(draft)||0);publishMods({target:target});paint();closeKeypad();return;}
  if(k==='clear'){draft='';replaceDigit=false;}
  else if(k==='delete'){draft=draft.slice(0,-1);replaceDigit=false;}
  else if(/^\d$/.test(k)){if(replaceDigit){draft='';replaceDigit=false;}if(draft.length<3)draft=String(Math.min(300,Number(draft+k)));}
  keypad.querySelector('output').textContent=draft||'0';
 }
 var adBusy=false;function unlockWithAd(){}
 function scalePanel(){
  if(overlay.hidden)return;
  var style=getComputedStyle(overlay),w=overlay.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0),h=overlay.clientHeight-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0);
  overlay.style.setProperty('--fan-scale',String(Math.max(.01,Math.min(1,w/720,h/540))));
  overlay.style.setProperty('--fan-pad-scale',String(Math.max(.01,Math.min(1,w/340,h/430))));
 }
 window.addEventListener('resize',scalePanel);window.addEventListener('game-layout-change',scalePanel);
 if(typeof ResizeObserver==='function')new ResizeObserver(scalePanel).observe(overlay);
 var oldFocus;
 function open(keyboard){if(root.dataset.multiplayerActive==='true'||window.roadKingMultiplayer)return;if(!window.RoadKingToyFanGate||!window.RoadKingToyFanGate(function(){fanAuthorized=true;publishMods();open(keyboard);})){fanAuthorized=false;publishMods();return;}paint();overlay.hidden=false;scalePanel();ball.setAttribute('aria-expanded','true');oldFocus=keyboard?document.activeElement:null;if(keyboard)overlay.querySelector('[data-close]').focus({preventScroll:true});}
 function close(){if(adBusy)return;keypad.hidden=true;overlay.querySelector('.mod233-panel').removeAttribute('aria-hidden');overlay.hidden=true;ball.setAttribute('aria-expanded','false');if(oldFocus)ball.focus({preventScroll:true});}
 overlay.addEventListener('click',function(e){
  if(adBusy)return;
  if(!keypad.hidden){var pad=e.target.closest('[data-pad]');if(pad)padKey(pad.dataset.pad);else if(e.target===keypad)closeKeypad();return;}
  if(e.target.closest('[data-speed-edit]')){if(unlockedFeatures.cruise!==true)return;draft=String(target);replaceDigit=true;keypad.querySelector('output').textContent=draft;keypad.hidden=false;overlay.querySelector('.mod233-panel').setAttribute('aria-hidden','true');keypad.querySelector('[data-pad="ok"]').focus({preventScroll:true});return;}

  if(e.target===overlay||e.target.closest('[data-close]')){close();return;}
  var tab=e.target.closest('[data-tab]');if(tab){overlay.querySelectorAll('[data-tab]').forEach(function(t){t.setAttribute('aria-selected',String(t===tab));});categories.forEach(function(c){overlay.querySelector('#mod233-page-'+c[0]).hidden=c[0]!==tab.dataset.tab;});overlay.querySelector('.mod233-content').scrollTop=0;return;}
  var density=e.target.closest('[data-density]');if(density){densityMode={'空路':'empty','稀疏':'sparse','正常':'normal','密集':'dense'}[density.dataset.density];publishMods({density:densityMode,on:{density:true}});paint();overlay.querySelector('.mod233-status').textContent='车流已调整';return;}
  var b=e.target.closest('[data-feature]');if(!b)return;var k=b.dataset.feature;
  if(unlockedFeatures[k]!==true){unlockWithAd(k);return;}
  setFeature(k,!previewOn[k]);paint();overlay.querySelector('.mod233-status').textContent=previewOn[k]?(isWeather(k)?'已加入随机天气':'功能已启用'):'功能已关闭，恢复默认';

 });
 overlay.addEventListener('keydown',function(e){e.stopPropagation();if(!keypad.hidden){if(/^\d$/.test(e.key)||['Backspace','Delete','Enter','Escape'].indexOf(e.key)>=0){e.preventDefault();padKey({'Backspace':'delete','Delete':'clear','Enter':'ok','Escape':'cancel'}[e.key]||e.key);return;}}else if(e.key==='Escape')close();if(e.key==='Tab'){var buttons=Array.prototype.filter.call((keypad.hidden?overlay:keypad).querySelectorAll('button,input'),function(b){return !b.disabled&&!b.closest('[hidden]');}),first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus({preventScroll:true});}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus({preventScroll:true});}}});
 overlay.addEventListener('input',function(e){
  if(e.target.id==='mod233-ramp-interval'){rampInterval=Number(e.target.value);overlay.querySelector('#mod233-ramp-value').textContent=rampInterval+' 米';publishMods({rampInterval:rampInterval,on:{rampInterval:true}});overlay.querySelector('.mod233-status').textContent='';}
 });
 overlay.addEventListener('keyup',function(e){e.stopPropagation();});
 // Store normalized positions separately for portrait and landscape.
 var positions=settings.get('assistant').positions;
 function orientation(){return root.getAttribute('data-orientation')==='landscape'?'landscape':'portrait';}
 function bounds(){return {x:Math.max(0,document.body.clientWidth-ball.offsetWidth-8),y:Math.max(0,document.body.clientHeight-ball.offsetHeight-8)};}
 function savePosition(){var b=bounds();positions[orientation()]={x:b.x?Math.max(0,Math.min(1,(ball.offsetLeft-4)/b.x)):0,y:b.y?Math.max(0,Math.min(1,(ball.offsetTop-4)/b.y)):0};var patch={};patch[orientation()]=positions[orientation()];settings.set('assistant',{positions:patch});}
 function restorePosition(){positions=settings.get('assistant').positions;var p=positions[orientation()],b=bounds();if(p){ball.style.left=(4+p.x*b.x)+'px';ball.style.top=(4+p.y*b.y)+'px';ball.style.right='auto';}else{ball.style.left='';ball.style.top='';ball.style.right='';}}
 var drag=null,moved=false;
 restorePosition();
 window.addEventListener('load',restorePosition);
 ball.addEventListener('pointerdown',function(e){if(drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:ball.offsetLeft,top:ball.offsetTop};moved=false;ball.setPointerCapture(e.pointerId);e.preventDefault();});
 ball.addEventListener('pointermove',function(e){if(!drag||e.pointerId!==drag.id)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)moved=true;if(!moved)return;var rotated=root.dataset.rotated==='true';var x=drag.left+(rotated?dy:dx),y=drag.top+(rotated?-dx:dy);var b=bounds();ball.style.left=Math.max(4,Math.min(4+b.x,x))+'px';ball.style.top=Math.max(4,Math.min(4+b.y,y))+'px';ball.style.right='auto';});
 ball.addEventListener('pointerup',function(e){if(!drag||drag.id!==e.pointerId)return;if(moved)savePosition();drag=null;});
 ball.addEventListener('pointercancel',function(){if(drag&&moved)savePosition();drag=null;});
 ball.addEventListener('lostpointercapture',function(){if(drag&&moved)savePosition();drag=null;});
 ball.addEventListener('click',function(e){if(e.detail===0||!moved)open(e.detail===0);});
 function syncOnlineMode(){
  var online=root.dataset.multiplayerActive==='true'||!!window.roadKingMultiplayer;
  ball.hidden=online;ball.disabled=online;
  if(online){overlay.hidden=true;keypad.hidden=true;ball.setAttribute('aria-expanded','false');drag=null;}
 }
 new MutationObserver(syncOnlineMode).observe(root,{attributes:true,attributeFilter:['data-multiplayer-active']});
 window.addEventListener('game-home-restored',syncOnlineMode);
 syncOnlineMode();
 window.addEventListener('game-layout-change',function(){drag=null;restorePosition();});
 settings.subscribe(function(change){
  if(change.sections.indexOf('mods')>=0||change.sections.indexOf('unlocks')>=0){publishMods();paint();}
  if(change.sections.indexOf('assistant')>=0)restorePosition();
 });
 window.addEventListener('game-home-restored',function(){publishMods();paint();restorePosition();});
 window.addEventListener('pageshow',function(){publishMods();paint();restorePosition();});
})();
