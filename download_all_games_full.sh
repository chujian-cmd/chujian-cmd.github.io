#!/bin/bash

cd /storage/emulated/0/html存放地

echo "📥 开始完整批量下载游戏..."

# 1. 射击外星人
echo "⬇️ 下载 射击外星人 (完整)..."
mkdir -p sniping-aliens && cd sniping-aliens
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "https://cos.umgame.cn/minigame_remote/minigame/client/snipingaliensremote/remote/h5/tt_47/web-mobile/index.html?time=1788613744625" 2>/dev/null
cd ..

# 2. 纸牌人生·穿越法则
echo "⬇️ 下载 纸牌人生·穿越法则 (完整)..."
mkdir -p zhipai-rensheng && cd zhipai-rensheng
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "https://gamebm.keepmobi.com/web-games/zhiPaiRenSheng/chuanYueFaZe/web-mobile/index.html" 2>/dev/null
cd ..

# 3. 莫里特攻
echo "⬇️ 下载 莫里特攻 (完整)..."
mkdir -p moritegong && cd moritegong
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "https://static-cdn.zhouhy.net/h5/project/qingdu/web/moritegong/1/web-mobile/index.html" 2>/dev/null
cd ..

# 4. 万宁象棋大招版
echo "⬇️ 下载 万宁象棋大招版 (完整)..."
mkdir -p wanning-xiangqi && cd wanning-xiangqi
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "https://gamebm.keepmobi.com/web-games/wan-ning-xiang-qi/v20250616/web-mobile/index.html" 2>/dev/null
cd ..

# 5. 我真不是老六
echo "⬇️ 下载 我真不是老六 (完整)..."
mkdir -p laoliu && cd laoliu
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "https://spwinner.cdn.xiaojing.work/dy_wo_zhen_bu_shi_lao_liu/mobile/index.html" 2>/dev/null
cd ..

# 6. 反击日记
echo "⬇️ 下载 反击日记 (完整)..."
mkdir -p counterattack && cd counterattack
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "https://game2.sfplay.net/CounterattackDiary/v1/" 2>/dev/null
cd ..

# 7. 赛车游戏
echo "⬇️ 下载 赛车游戏 (完整)..."
mkdir -p thecar && cd thecar
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "https://game2.sfplay.net/thecar/" 2>/dev/null
cd ..

# 8. IP 地址游戏（未知）
echo "⬇️ 下载 IP 地址游戏 (完整)..."
mkdir -p jmdxzzd && cd jmdxzzd
wget -r -l 5 -np -k -p --page-requisites --adjust-extension --no-check-certificate --user-agent="Mozilla/5.0" "http://47.92.128.120:18080/jmdxzzd/index.html" 2>/dev/null
cd ..

echo "🎉 所有游戏完整下载完成！"
