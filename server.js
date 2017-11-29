var http = require('http')
var url = require('url')
var fs = require('fs')

var log = require('./log').log
var serveFileDir = ''

// 设置静态文件的路径
function setServeFilePath(path) {
  serveFileDir = path
}

exports.serveFilePath = setServeFilePath

// 创建路由处理程序
function start(handle, port) {
  function onRequest(req, res) {
    var urlData = url.parse(req.url, true),
      pathName = urlData.pathname,
      info = { 'res': res }
    log('Request for ' + pathName + ' received')
    route(handle, pathName, info)
  }

  http.createServer(onRequest).listen(port)
  log('Server started on port ' + port)
}

exports.start = start

// 确定请求的是静态文件还是自定义的路由
function route(handle, pathName, info) {
  log('About to route request for ', pathName)
  // 检查前导斜杠后的路径是否为可处理的现有文件
  var filePath = createFilePath(pathName)
  log('Attempting to locate ' + filePath)
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {   // 处理静态文件
      serveFile(filePath, info)
    } else {    // 必须为自定义路径
      handleCustom(handle, pathName, info)
    }
  })
}

// 先从给定路径名称中去除... ~等特殊字符，再向其开头添加serveFileDir
function createFilePath(pathName) {
  var components = pathName.substr(1).split('/')
  var filtered = new Array(), temp
  for (var i = 0, len = components.length; i < len; i++) {
    temp = components[i]
    if (temp == '..') continue    // 没有上级目录
    if (temp == '') continue    // 没有根目录
    temp = temp.replace(/~/g, '')   // 没有用户目录
    filtered.push(temp)
  }
  return serveFileDir + '/' + filtered.join('/')
}

// 打开指定文件，读取内容，将内容返回给客户端
function serveFile(filePath, info) {
  var res = info.res
  log('Serving file ' + filePath)
  fs.open(filePath, 'r', (err, fd) => {
    if (err) {
      log(err.message)
      noHandlerError(filePath, res)
      return
    }
    var readBuffer = new Buffer(20480)
    fs.read(fd, readBuffer, 0, 20480, 0, (err, readBytes) => {
      if (err) {
        log(err.message)
        fs.close(fd)
        noHandlerError(filePath, res)
        return
      }
      log('Just read ' + readBytes + ' bytes')
      if (readBytes > 0) {
        res.writeHead(200, { 'Content-Type': contentType(filePath) })
        res.write(readBuffer.toString('utf8', 0, readBytes))
      }
      res.end()
    })
  })
}

// 确定提取到的文件类型
function contentType(filePath) {
  var index = filePath.lastIndexOf('.')
  if (index > 0) {
    switch (filePath.substr(index + 1)) {
      case 'html':
        return 'text/html'
      case 'js':
        return 'application/javascript'
      case 'css':
        return 'text/css'
      case 'txt':
        return 'text/plain'
      default:
        return 'text/html'
    }
  }
  return 'text/html'
}

// 确定自定义路由的处理
function handleCustom(handle, pathName, info) {
  if (typeof handle[pathName] == 'function') {
    handle[pathName](info)
  } else {
    noHandlerError(pathName, info.res)
  }
}

// 404请求
function noHandlerError(pathName, res) {
  log('No request handler found for ' + pathName)
  res.writeHead(404, {'Content-Type': 'text/plain'})
  res.write('404 Page Not Found')
  res.end()
}
