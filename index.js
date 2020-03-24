#!/bin/bash

const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const ws = require('ws');

function jsonParse(s) {
  try {
    return JSON.parse(s);
  } catch(err) {
    return null;
  }
}
function makePromise() {
  let accept, reject;
  const p = new Promise((a, r) => {
    accept = a;
    reject = r;
  });
  p.accept = accept;
  p.reject = reject;
  return p;
}

const port = 3000;

const app = express();
app.use(express.static(__dirname));
const server = http.createServer(app);
const wss = new ws.Server({
  noServer: true,
});
wss.on('connection', async (s, req) => {
  // const o = url.parse(req.url, true);
  let localHandleMessage = null;
  s.on('message', async m => {
    if (localHandleMessage) {
      localHandleMessage(m);
    } else {
      if (typeof m === 'string') {
        const data = jsonParse(m);
        if (data) {
          const {method = '', args = []} = data;
          
          const messagePromises = [];
          for (let i = 0; i < args.length; i++) {
            if (args[i] === null) {
              const p = makePromise();
              p.then(v => {
                if (v.byteOffset % 4 !== 0) { // alignment
                  const ab = new ArrayBuffer(v.byteLength);
                  new Uint8Array(ab).set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
                  v = new v.constructor(ab);
                }
                args[i] = [v.buffer, v.byteOffset, v.byteLength];
              });
              messagePromises.push(p);
            }
          }
          if (messagePromises.length > 0) {
            let messagePromiseIndex = 0;
            localHandleMessage = m => {
              const messagePromise = messagePromises[messagePromiseIndex++];
              if (messagePromiseIndex >= messagePromises.length) {
                localHandleMessage = null;
              }
              if (typeof m === 'string') {
                messagePromise.accept(jsonParse(m));
              } else {
                messagePromise.accept(m);
              }
            };
            await Promise.all(messagePromises);
          }

          // console.log('calling', method, args);

          const o = handleMessage(method, args);
          const {error, result} = o;
          if (result && result.data && result.data instanceof ArrayBuffer) {
            console.log('send mirror texture', result.data);
            s.send('mirrorTexture');
            // s.send(Uint32Array.from([result.width]).buffer);
            // s.send(Uint32Array.from([result.height]).buffer);
            s.send(result.data);
          }
          s.send(JSON.stringify({
            error,
            result,
          }));
        }
      } else {
        console.warn('cannot handle message', m);
      }
    }
  });
  
  setEventHandler(e => {
    if (e.type === 'pose') {
      s.send(e.type);
      s.send(e.hmd);
      s.send(e.left);
      s.send(e.right);
    } else if (e.type === 'mirrorTexture') {
      s.send(e.type);
      s.send(e.data);
    }
  });
});
wss.on('error', err => {
  console.warn(err.stack);
});
const _ws = (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, s => {
    wss.emit('connection', s, req);
  });
};
server.on('upgrade', _ws);
server.listen(port);