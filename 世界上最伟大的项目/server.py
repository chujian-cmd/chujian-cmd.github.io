import http.server
import ssl

httpd = http.server.HTTPServer(('0.0.0.0', 8000), http.server.SimpleHTTPRequestHandler)

# 新版 Python 写法
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print("HTTPS 服务器已启动: https://localhost:8000")
httpd.serve_forever()
