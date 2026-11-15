# t

这是可以在 Android Studio 中打开并编译的应用工程。

- app/src/main/java 里的 MainActivity：用 WebView 打开这个应用的页面或本地文件。
- app/src/main/AndroidManifest.xml：包名、权限和图标。
- app/src/main/assets/app_config.json：WebToApp 写入 APK 的运行时配置。资源加密的安装包里这份文件是密文，这里是明文。
- app/src/main/res/xml/network_security_config.xml 与 res/raw/：网络信任设置。
- app/src/main/assets/www/ 与 assets/files/：本地 HTML、前端、画廊、启动画面和音频。不含 node_modules 与 .git。

用 Android Studio 打开这个文件夹即可同步并构建。压缩包不含签名密钥库，也不包含 WebToApp 壳的全部运行时。它可能包含你配置的激活密钥和代理凭据。