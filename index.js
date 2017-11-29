var server = require('./server')
var log = require('./log').log
var port = process.argv[2] || 5001

var requestHandlers = require('./serverXHRSignalingChannel')

// 返回404
function notFound(info) {
  var res = info.res
  log('Request handler NotFound was called.')
  res.writeHead(404, {'Content-Type': 'text/plain'})
  res.write('404 Page Not Found')
  res.end()
}

var handle = {}

handle['/'] = notFound

handle['/connect'] = requestHandlers.connect
handle['/send'] = requestHandlers.send
handle['/get'] = requestHandlers.get

server.serveFilePath('static')
server.start(handle, port)
