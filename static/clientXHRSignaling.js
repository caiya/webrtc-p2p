var createSignalingChannel = function (key, handlers) {

  var id, status,
    doNothing = function () { },
    handlers = handlers || {},
    initHandler = function (h) {
      return ((typeof h === 'function') && h) || doNothing;
    },
    waitingHandler = initHandler(handlers.onWaiting),
    connectedHandler = initHandler(handlers.onConnected),
    messageHandler = initHandler(handlers.onMessage);


  // Set up connection with signaling server
  function connect(failureCB) {
    var failureCB = (typeof failureCB === 'function') ||
      function () { };

    // Handle connection response, which should be error or status
    //  of "connected" or "waiting"
    function handler() {
      if (this.readyState == this.DONE) {
        if (this.status == 200 && this.response != null) {
          var res = JSON.parse(this.response);
          if (res.err) {
            failureCB("error:  " + res.err);
            return;
          }

          // if no error, save status and server-generated id,
          // then start asynchronouse polling for messages
          id = res.id;
          status = res.status;
          poll();

          // run user-provided handlers for waiting and connected
          // states
          if (status === "waiting") {
            waitingHandler();
          } else {
            connectedHandler();
          }
          return;
        } else {
          failureCB("HTTP error:  " + this.status);
          return;
        }
      }
    }

    // open XHR and send the connection request with the key
    var client = new XMLHttpRequest();
    client.onreadystatechange = handler;
    client.open("GET", "/connect?key=" + key);
    client.send();
  }

  // poll() waits n ms between gets to the server.  n is at 10 ms
  // for 10 tries, then 100 ms for 10 tries, then 1000 ms from then
  // on. n is reset to 10 ms if a message is actually received.
  function poll() {
    var msgs;
    var pollWaitDelay = (function () {
      var delay = 10, counter = 1;

      function reset() {
        delay = 10;
        counter = 1;
      }

      function increase() {
        counter += 1;
        if (counter > 20) {
          delay = 1000;
        } else if (counter > 10) {
          delay = 100;
        }                          // else leave delay at 10
      }

      function value() {
        return delay;
      }

      return { reset: reset, increase: increase, value: value };
    } ());

    // getLoop is defined and used immediately here.  It retrieves
    // messages from the server and then schedules itself to run
    // again after pollWaitDelay.value() milliseconds.
    (function getLoop() {
      get(function (response) {
        var i, msgs = (response && response.msgs) || [];

        // if messages property exists, then we are connected   
        if (response.msgs && (status !== "connected")) {
          // switch status to connected since it is now!
          status = "connected";
          connectedHandler();
        }
        if (msgs.length > 0) {           // we got messages
          pollWaitDelay.reset();
          for (i = 0; i < msgs.length; i += 1) {
            handleMessage(msgs[i]);
          }
        } else {                         // didn't get any messages
          pollWaitDelay.increase();
        }

        // now set timer to check again
        setTimeout(getLoop, pollWaitDelay.value());
      });
    } ());
  }


  // This function is part of the polling setup to check for
  // messages from the other browser.  It is called by getLoop()
  // inside poll().
  function get(getResponseHandler) {

    // response should either be error or a JSON object.  If the
    // latter, send it to the user-provided handler.
    function handler() {
      if (this.readyState == this.DONE) {
        if (this.status == 200 && this.response != null) {
          var res = JSON.parse(this.response);
          if (res.err) {
            getResponseHandler("error:  " + res.err);
            return;
          }
          getResponseHandler(res);
          return res;
        } else {
          getResponseHandler("HTTP error:  " + this.status);
          return;
        }
      }
    }

    // open XHR and request messages for my id
    var client = new XMLHttpRequest();
    client.onreadystatechange = handler;
    client.open("POST", "/get");
    client.send(JSON.stringify({ "id": id }));
  }


  // Schedule incoming messages for asynchronous handling.
  // This is used by getLoop() in poll().
  function handleMessage(msg) {   // process message asynchronously
    setTimeout(function () { messageHandler(msg); }, 0);
  }


  // Send a message to the other browser on the signaling channel
  function send(msg, responseHandler) {
    var reponseHandler = responseHandler || function () { };

    // parse response and send to handler
    function handler() {
      if (this.readyState == this.DONE) {
        if (this.status == 200 && this.response != null) {
          var res = JSON.parse(this.response);
          if (res.err) {
            responseHandler("error:  " + res.err);
            return;
          }
          responseHandler(res);
          return;
        } else {
          responseHandler("HTTP error:  " + this.status);
          return;
        }
      }
    }

    // open XHR and send my id and message as JSON string
    var client = new XMLHttpRequest();
    client.onreadystatechange = handler;
    client.open("POST", "/send");
    var sendData = { "id": id, "message": msg };
    client.send(JSON.stringify(sendData));
  }


  return {
    connect: connect,
    send: send
  };

};
