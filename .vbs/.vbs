' 屏幕弹窗画五角星
On Error Resume Next
Dim w, h, x, y, i, starPts, size, shell, fso, tempPath, runPath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取屏幕分辨率
w = shell.RegRead("HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics\AppliedDPI")
If w = "" Then w = 96
Dim scrW, scrH
scrW = 1920 : scrH = 1080 ' 默认分辨率，可按需修改

' 创建一个临时脚本，用来生成每一个小窗口
tempPath = shell.ExpandEnvironmentStrings("%temp%") & "\star_popup.vbs"
Set runPath = fso.CreateTextFile(tempPath, True)

runPath.WriteLine "Set sh = CreateObject(""WScript.Shell"")"
runPath.WriteLine "sh.Popup ""★"", 0.5, ""看好啦"", 0"
runPath.Close

' 五角星的10个顶点坐标（相对中心点）
' 外圈5个点，内圈5个点
starPts = Array( _
    0, -200,   58, -58,   200, 0, _
    58, 58,    0, 200,    -58, 58, _
    -200, 0,   -58, -58 _
)

' 中心点
Dim cx, cy
cx = 960 : cy = 500 ' 屏幕中心偏上

' 开始循环生成弹窗
Dim stepSize
stepSize = 8 ' 弹窗密集度，越小越密（但也会越卡）

' 遍历五角星的每一条边
Dim p1_x, p1_y, p2_x, p2_y, steps, dx, dy
Dim edge
' 五角星连线顺序: 顶点0 -> 凹点1 -> 顶点2 -> 凹点3 -> 顶点4 -> 凹点5 -> 顶点6 -> 凹点7 -> 顶点8 -> 凹点9 -> 顶点0
Dim path = Array(0, 2, 4, 6, 8, 0)

For edge = 0 To 4
    p1_x = cx + starPts(path(edge) * 2)
    p1_y = cy + starPts(path(edge) * 2 + 1)
    p2_x = cx + starPts(path(edge+1) * 2)
    p2_y = cy + starPts(path(edge+1) * 2 + 1)
    
    ' 计算两点间的距离
    dx = p2_x - p1_x
    dy = p2_y - p1_y
    steps = Sqr(dx * dx + dy * dy) / stepSize
    
    For i = 0 To steps
        x = p1_x + (dx * i / steps)
        y = p1_y + (dy * i / steps)
        ' 调用生成的脚本，在指定坐标弹出窗口
        shell.Run "wscript.exe """ & tempPath & """", 0, False
    Next
Next

' 清理临时文件
WScript.Sleep 3000
fso.DeleteFile tempPath, True
MsgBox "五角星画完啦！", 64, "完成"