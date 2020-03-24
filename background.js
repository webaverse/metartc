// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// Declare extension default properties
/* let downloadsArray = [];
let initialState = {
  'savedImages': downloadsArray,
  'thumbnails': false,
  'saveImages': true
}; */

// Set extension setting on installation
/* chrome.runtime.onInstalled.addListener(function() {
}); */

/* console.log('listening 1', chrome.runtime.connectNative);

const inject = tab => {
  console.log('got tab', tab.id);
  chrome.tabs.executeScript(tab.id, {
    code: `
      window.lol = 'zol';
      window.document.lol = 'zol';
      // document.body.style.backgroundColor = "orange";
    `,  
  }, () => {
    console.log('ran script');
  })
};
chrome.tabs.onCreated.addListener(inject);
chrome.tabs.onUpdated.addListener(inject); */

const port = chrome.runtime.connectNative('com.exokit.xrchrome');
const cbs = [];
let continuationString = '';
const ports = [];
const _handleMessage = msg => {
  // console.log("received native", msg);
  const _processCb = msg => {
    if (cbs.length > 0) {
      const cb = cbs.shift();
      cb(msg);
    }
  };
  if (msg.continuation) {
    const {index, total, continuation} = msg;
    continuationString += continuation;
    if (index === total - 1) {
      const continuationMsg = JSON.parse(continuationString);
      continuationString = '';
      _handleMessage(continuationMsg);
    }
  } else if (msg.event) {
    const {event, data} = msg;
    for (let i = 0; i < ports.length; i++) {
      ports[i].postMessage({event, data});
    }
  } else {
    _processCb(msg);
  }
};
port.onMessage.addListener(_handleMessage);
port.onDisconnect.addListener(() => {
  console.log("disconnected native");
});
// port.postMessage({ text: "Hello, my_application" });

function proxyRequest(method, args, sendResponse) {
  port.postMessage({method, args});
  cbs.push(msg => {
    console.log('got proxy res', msg);
    if (msg && msg.error !== undefined && msg.result !== undefined) {
      sendResponse({
        error: msg.error,
        result: msg.result,
      });
    } else {
      sendResponse({
        error: 'internal error: ' + JSON.stringify(msg),
        result: null,
      });
    }
  });
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    /* console.log(sender.tab ?
      "from a content script:" + sender.tab.url :
      "from the extension"); */
    if (request && request.method && request.args) {
      const {method, args} = request;
      /* if (method === 'tabCapture') {
        (async () => {
          await new Promise(accept => { // XXX this can be a native wait
            setTimeout(accept, 500);
          });
          chrome.desktopCapture.chooseDesktopMedia(['window'], sender.tab, streamId => {
            sendResponse({
              error: null,
              result: streamId,
            });
          });
        })().catch(console.warn);
      } else { */
        proxyRequest(method, args, sendResponse);
      // }
    } else {
      sendResponse({
        pong: true,
      });
    }
    
    return true; // async
});

chrome.runtime.onConnect.addListener(port => {
  console.log('port connect', port);
  ports.push(port);
  port.onDisconnect.addListener(() => {
    console.log('port disconnect', port);
    ports.splice(ports.indexOf(port), 1);
  });
});

chrome.windows.onRemoved.addListener(windowId => {
  console.log('window removed', windowId);
  chrome.windows.getAll({}, windows => {
    console.log('got windows', windows);
    if (windows.length === 0) {
      console.log('calling terminate');
      proxyRequest('terminate', [], o => {
        console.log('get terminate result', o);
      });
    }
  });
});