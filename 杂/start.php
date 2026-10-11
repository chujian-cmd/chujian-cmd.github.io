<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// ==================== 全部42个项目 ====================
$projects = [
    "1" => ["name" => "Holistic (人体识别)", "path" => "/storage/emulated/0/holistic_demo", "port" => "8080"],
    "2" => ["name" => "晃动工坊 (图片晃动)", "path" => "/storage/emulated/0/html存放地/晃动工坊", "port" => "8081"],
    "3" => ["name" => "Turbowarp (Scratch编辑器)", "path" => "/storage/emulated/0/html存放地/turbowarp.org", "port" => "8082"],
    "4" => ["name" => "2048 (经典小游戏)", "path" => "/storage/emulated/0/html存放地/2048", "port" => "8083"],
    "5" => ["name" => "3D Viewer (3D模型查看)", "path" => "/storage/emulated/0/html存放地/3dviewer", "port" => "8084"],
    "6" => ["name" => "copy.sh (个人主页+生命游戏)", "path" => "/storage/emulated/0/html存放地/copy.sh", "port" => "8085"],
    "7" => ["name" => "draw.io (绘图工具)", "path" => "/storage/emulated/0/html存放地/drawio", "port" => "8086"],
    "8" => ["name" => "xtype (射击游戏)", "path" => "/storage/emulated/0/html存放地/xtype", "port" => "8087"],
    "9" => ["name" => "Chihuahua Spin (魔性转狗)", "path" => "/storage/emulated/0/html存放地/chihuahuaspin", "port" => "8088"],
    "10" => ["name" => "That's The Finger (手指追鼠标)", "path" => "/storage/emulated/0/html存放地/thatsthefinger", "port" => "8089"],
    "11" => ["name" => "PetPetGenerator (摸摸头GIF)", "path" => "/storage/emulated/0/html存放地/petpetgenerator", "port" => "8090"],
    "12" => ["name" => "WeaveSilk (对称画图)", "path" => "/storage/emulated/0/html存放地/weavesilk", "port" => "8091"],
    "13" => ["name" => "Poetry Cloud (诗歌生成)", "path" => "/storage/emulated/0/html存放地/poetrycloud", "port" => "8092"],
    "14" => ["name" => "Canvas Painter (画板)", "path" => "/storage/emulated/0/html存放地/canvas-painter", "port" => "8093"],
    "15" => ["name" => "Markdown Previewer (Markdown预览)", "path" => "/storage/emulated/0/html存放地/markdown-previewer", "port" => "8094"],
    "16" => ["name" => "Minesweeper (扫雷)", "path" => "/storage/emulated/0/html存放地/minesweeper", "port" => "8095"],
    "17" => ["name" => "KoalasToTheMax (分形考拉)", "path" => "/storage/emulated/0/html存放地/KoalasToTheMax-master", "port" => "8096"],
    "18" => ["name" => "Long Doge Challenge (无限滚动柴犬)", "path" => "/storage/emulated/0/html存放地/longdoge", "port" => "8097"],
    "19" => ["name" => "Learn UI Name (UI视觉词典)", "path" => "/storage/emulated/0/html存放地/learn-ui/learnui.qiaomu.ai", "port" => "8098"],
    "20" => ["name" => "htmlgames-master (html游戏源码)", "path" => "/storage/emulated/0/html存放地/htmlgames-master", "port" => "8099"],
    "21" => ["name" => "maze-toys (迷宫)", "path" => "/storage/emulated/0/html存放地/maze-toys", "port" => "8100"],
    "22" => ["name" => "toms-toys (玩具合集)", "path" => "/storage/emulated/0/html存放地/toms-toys", "port" => "8101"],
    "23" => ["name" => "puginarug (整活)", "path" => "/storage/emulated/0/html存放地/puginarug", "port" => "8102"],
    "24" => ["name" => "cruel-toys-maze (迷宫)", "path" => "/storage/emulated/0/html存放地/cruel-toys-maze", "port" => "8103"],
    "25" => ["name" => "memory-toys (记忆配对)", "path" => "/storage/emulated/0/html存放地/memory-toys", "port" => "8104"],
    "26" => ["name" => "onesquareminesweeper (扫雷变体)", "path" => "/storage/emulated/0/html存放地/onesquareminesweeper", "port" => "8105"],
    "27" => ["name" => "cursoreffects (光标特效)", "path" => "/storage/emulated/0/html存放地/cursoreffects", "port" => "8106"],
    "28" => ["name" => "paint-toys (绘画工具)", "path" => "/storage/emulated/0/html存放地/paint-toys", "port" => "8107"],
    "29" => ["name" => "heeeeeeeey (整活)", "path" => "/storage/emulated/0/html存放地/heeeeeeeey", "port" => "8108"],
    "30" => ["name" => "paint-toys-sand (沙画)", "path" => "/storage/emulated/0/html存放地/paint-toys-sand", "port" => "8109"],
    "31" => ["name" => "sliding-toys (华容道)", "path" => "/storage/emulated/0/html存放地/sliding-toys", "port" => "8110"],
    "32" => ["name" => "ant-toys (蚂蚁模拟)", "path" => "/storage/emulated/0/html存放地/ant-toys", "port" => "8111"],
    "33" => ["name" => "patience-toys (呼吸灯)", "path" => "/storage/emulated/0/html存放地/patience-toys", "port" => "8112"],
    "34" => ["name" => "cant-not-tweet (整活)", "path" => "/storage/emulated/0/html存放地/cant-not-tweet", "port" => "8113"],
    "35" => ["name" => "smashthewalls (解压游戏)", "path" => "/storage/emulated/0/html存放地/smashthewalls", "port" => "8114"],
    "36" => ["name" => "burymewithmymoney (整活)", "path" => "/storage/emulated/0/html存放地/burymewithmymoney", "port" => "8115"],
    "37" => ["name" => "Breakout (打砖块)", "path" => "/storage/emulated/0/html存放地/breakout", "port" => "8116"],
    "38" => ["name" => "Tetris (俄罗斯方块)", "path" => "/storage/emulated/0/html存放地/tetris", "port" => "8117"],
    "39" => ["name" => "Snake (贪吃蛇)", "path" => "/storage/emulated/0/html存放地/snake", "port" => "8118"],
    "40" => ["name" => "Gesto Engine (手势识别引擎)", "path" => "/storage/emulated/0/html存放地/gesto-engine-main", "port" => "8119"],
    "41" => ["name" => "GooseHyperGlass (液态玻璃UI)", "path" => "/storage/emulated/0/html存放地/GooseHyperGlass-main", "port" => "8120"],
    "42" => ["name" => "Glass CDN (液态玻璃演示站)", "path" => "/storage/emulated/0/html存放地/glass.goose.cc.cd", "port" => "8121"]
];

$action = $_GET['action'] ?? '';
$key = $_GET['key'] ?? '';

// ==================== 接口 ====================

if ($action === 'list') {
    $list = [];
    foreach ($projects as $k => $p) {
        $list[$k] = ["name" => $p["name"], "port" => $p["port"]];
    }
    echo json_encode($list, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'start' && $key && isset($projects[$key])) {
    $p = $projects[$key];
    $cmd = "cd '{$p['path']}' && nohup python3 -m http.server {$p['port']} > /dev/null 2>&1 &";
    exec($cmd);
    sleep(1);
    echo json_encode([
        "success" => true,
        "message" => "✅ {$p['name']} 已启动",
        "url" => "http://127.0.0.1:{$p['port']}"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'stop') {
    exec('pkill -f "python -m http.server"');
    echo json_encode(["success" => true, "message" => "⏹ 已停止所有服务"], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'status') {
    exec('ps aux | grep "python -m http.server" | grep -v grep', $output);
    $running = [];
    foreach ($output as $line) {
        if (preg_match('/http\.server (\d+)/', $line, $matches)) {
            $running[] = $matches[1];
        }
    }
    echo json_encode(["running" => $running]);
    exit;
}

echo json_encode(["error" => "Invalid action"]);
?>
