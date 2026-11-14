
(function (w) {
'use strict';
if (!w.GameBus || !w.ArcadeGlue || w.__v2ArcadeActions) return;
w.__v2ArcadeActions = true;
w.GameBus.on('ui:action', event => {
if (event && event.action === 'arcade-open') w.ArcadeGlue.open(event.id || 'menu');
});
})(window);
