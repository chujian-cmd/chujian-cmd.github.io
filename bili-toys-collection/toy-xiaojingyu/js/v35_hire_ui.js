
"use strict";
window.V35HireUI = {
action: function () { return { key: "hire", icon: "briefcase", label: "扩编" }; },
panel: function (ui) {
var s = ui.core.state;
var c = ui.core.cfg;
var HR = window.V35Hire ? window.V35Hire.roles(ui.core) : Object.assign({}, (c.V35 && c.V35.HIRE_ROLES) || {});
if (!ui.core.embodiedAvailable || !ui.core.embodiedAvailable()) delete HR.embodied;
var order = s.hireOrder;
var v35on = ui.core.v35On && ui.core.v35On();
if (!v35on) return '<div class="om-empty"><div class="om-empty-tip">（当前版本无需扩编）</div></div>';
var labels = { pretrain: "预训练工程师", data: "数据工程师", post: "后训练工程师", embodied: "具身智能工程师" };
var roles = Object.keys(HR).map(function (key) {
return { key: key, label: HR[key].label || labels[key] || key, wait: HR[key].waitMin || [3, 3] };
});
var cost = c.RECRUIT_COST || 0;
var all = roles.map(function (r) { return r.key; });
if (!Array.isArray(ui._hireRoles)) ui._hireRoles = [];
var sel = ui._hireRoles.filter(function (k) { return all.indexOf(k) >= 0; });
ui._hireRoles = sel;
var totalCost = cost * Math.max(1, sel.length);
var costTxt = totalCost > 0 ? ' · ' + Math.round(totalCost / 10000) + ' 万' : '';
var poor = totalCost > 0 && (s.funding || 0) < totalCost;
var waiting = (s.candidates || []).length;
var hint = waiting > 0
? '<div class="hire-note">📋 有 ' + waiting + ' 位人选在「招聘」页等你面试，点击左侧「招聘」查看（人选有时效，别拖太久）</div>'
: '';
var aliveN = (s.engineers || []).filter(function (e) { return !e.resigned; }).length;
var capN = ui.core.seatCap ? ui.core.seatCap() : 4;
var full = aliveN >= capN;
if (full) {
hint += '<div class="hire-note warn">🚪 座位已满（' + aliveN + '/' + capN + '）：先辞退一人，再来发布需求</div>';
}
var roleCards = roles.map(function (r) {
var on = sel.indexOf(r.key) >= 0;
var dis = order || poor || full ? ' dim' : '';
return '<div class="hire-role' + (on ? ' on' : '') + dis + '" data-action="hire-pick" data-role="' + r.key + '">'
+ '<div class="hr-name">' + r.label + (on ? '<i class="hr-tick">✓</i>' : '') + '</div>'
+ '<div class="hr-meta">预计需要 ' + (r.wait[0] === r.wait[1] ? (r.wait[0] + ' 周') : (r.wait[0] + '~' + r.wait[1] + ' 周')) + '</div>'
+ '<div class="hr-pick">' + (on ? '已勾选' : '点击勾选') + '</div>'
+ '</div>';
}).join('');
if (poor) {
roleCards += '<div class="hire-note warn">经费不足：发布一次需求要 ' + Math.round(totalCost / 10000) + ' 万（勾选 ' + Math.max(1, sel.length) + ' 个岗位）</div>';
}
var bar = order ? '' : '<div class="hire-bar">'
+ '<button class="skew-btn ghost" type="button" data-action="hire-all"' + (poor || full ? ' disabled' : '') + '>全选全部岗位</button>'
+ '<button class="skew-btn pink" type="button" data-action="hire-order"' + (sel.length && !poor && !full ? '' : ' disabled') + '>'
+ '🔍 发布需求' + (sel.length ? '（' + sel.length + ' 类）' : '') + costTxt + '</button>'
+ '</div><div class="hire-note">每个勾选岗位独立寻访 1~3 人（勾 2 个岗位 = 2~6 人）</div>';
var rule = (c.UI_CFG || {}).HIRE_WAIT_RULE;
if (!order && rule) hint += '<div class="hire-note">' + ui.escHtml(rule) + '</div>';
var status = '';
if (order) {
var tpw = (c.V35 && c.V35.TICKS_PER_WEEK) || 6;
var leftTicks = Math.max(0, order.left);
var totalTicks = Math.max(1, order.total || tpw);
var leftWeek = Math.max(1, Math.ceil(leftTicks / tpw));
var pct = Math.max(0, Math.min(100, Math.round((1 - leftTicks / totalTicks) * 100)));
var names = ((order.roles && order.roles.length) ? order.roles : [order.role]).map(function (r) {
return ((HR[r] || {}).label) || r;
}).join('、');
var rush = window.V35Hire && window.V35Hire.rushOptions ? window.V35Hire.rushOptions(ui.core) : null;
var rushBar = rush ? '<div class="hire-rush-bar"><button class="skew-btn gold" type="button" data-action="hire-rush"'
+ ((s.funding || 0) < rush.cost || leftTicks <= 0 ? ' disabled' : '')
+ '>加急招聘 · ' + rush.costText + '（缩短 ' + rush.weeks + ' 周）</button>'
+ '<div class="hire-note">只缩短招聘等待；本轮未找到人仍会按原规则重试。</div></div>' : '';
status = '<div class="hire-status">'
+ '<div class="hs-title">🔍 正在筛选简历：' + names + '（第 ' + order.attempt + ' 轮）</div>'
+ '<div class="hs-bar"><i style="width:' + pct + '%"></i></div>'
+ '<div class="hs-tip">还需 ' + leftWeek + ' 周 · 找到的人会进「招聘」页的候选人列表</div>'
+ (order.attempt > 1 && window.V35Hire ? '<div class="hire-note" data-hire-retry>' + ui.escHtml(V35Hire.retryNotice(ui.core)) + '</div>' : '')
+ rushBar
+ '</div>';
}
return '<div class="hire-panel">' + hint + roleCards + bar + status + '</div>';
}
};
