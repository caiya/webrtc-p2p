var log = require('./log').log

var connections = {},   // 链接列表
  partner = {},       // 用于在对等端进行映射
  messagesFor = {};   // 包含要发送给客户的消息的数组

// 排队发送json响应
function webrtcResponse(response, res) {
  log('Replying with webrtc response ' + JSON.stringify(response))
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(response))
  res.end()
}

// webrtc发送error响应
function webrtcError(err, res) {
  log('Replying with webrtc error ' + err)
  webrtcResponse({ 'err': err }, res)
}

// 处理XHR http请求，以使用给定密钥进行连接
function connect(info) {
  var res = info.res,
    query = info.query,
    thisConnection,
    newId = function () {
      return Math.floor(Math.random() * 1000000000)
    },
    connectFirstParty = function () {
      if (thisConnection.status === 'connected') {
        // 删除配对和任何存储的信息
        delete partner[thisConnection.ids[0]]
        delete partner[thisConnection.ids[1]]
        delete messagesFor[thisConnection.ids[0]]
        delete messagesFor[thisConnection.ids[1]]
      }
      connections[query.key] = {}
      thisConnection = connections[query.key]
      thisConnection.status = 'waiting'
      thisConnection.ids = [newId()]
      webrtcResponse({
        id: thisConnection.ids[0],
        status: thisConnection.status
      }, res)
    },
    connectSecondParty = function () {
      thisConnection.ids[1] = newId()
      partner[thisConnection.ids[0]] = thisConnection.ids[1]
      partner[thisConnection.ids[1]] = thisConnection.ids[0]
      messagesFor[thisConnection.ids[0]] = []
      messagesFor[thisConnection.ids[1]] = []
      thisConnection.status = 'connected'
      webrtcResponse({
        id: thisConnection.ids[1],
        status: thisConnection.status
      }, res)
    }
  log('Request handler connect was called.')
  if (query && query.key) {
    var thisConnection = connections[query.key] || { 'status': 'new' }
    if (thisConnection.status === 'waiting') {    // 前半部分就绪
      connectSecondParty()
      return
    } else {        // 必须为新连接或为‘connected’状态
      connectFirstParty()
      return
    }
  } else {
    webrtcError('No recognizable query key', res)
  }
}

exports.connect = connect

// 对info.postData.message中的消息进行排队处理，已发送至具体info.postData.id中的id的伙伴
function sendMessage(info) {
  log('PostData received is *** ' + info.postData + ' ***')
  var postData = JSON.parse(info.postData),
    res = info.res;
  if (typeof postData === 'undefined') {
    webrtcError('No posted data in JSON format!', res)
    return
  }
  if (typeof (postData.message) === 'undefined') {
    webrtcError('No message received!', res)
    return
  }
  if (typeof (postData.id) === 'undefined') {
    webrtcError('No id received with message!', res)
    return
  }
  if (typeof (partner[postData.id]) === 'undefined') {
    webrtcError('Invalid id ' + postData.id, res)
    return
  }
  if (typeof (messagesFor[partner[postData.id]]) === 'undefined') {
    webrtcError('Invalid id ' + postData.id, res)
    return
  }
  messagesFor[partner[postData.id]].push(postData.message)
  log('Saving message *** ' + postData.message + ' *** for delivery to id ' + partner[postData.id])

  webrtcResponse('Saving message *** ' + postData.message + ' *** for delivery to id ' + partner[postData.id], res)
}

exports.send = sendMessage

// 返回所有队列获取info.postData.id的消息
function getMessages(info) {
  var postData = JSON.parse(info.postData),
    res = info.res;
  if (typeof postData === 'undefined') {
    webrtcError('No posted data in JSON format!', res)
    return
  }
  if (typeof (postData.id) === 'undefined') {
    webrtcError('No id received with message!', res)
    return
  }
  if (typeof (messagesFor[partner[postData.id]]) === 'undefined') {
    webrtcError('Invalid id ' + postData.id, res)
    return
  }
  log('Sending messages *** ' + JSON.stringify(messagesFor[partner[postData.id]]) + ' *** to id ' + postData.id)
  webrtcResponse({
    msgs: messagesFor[postData.id]
  }, res)
  messagesFor[postData.id] = []
}

exports.get = getMessages
