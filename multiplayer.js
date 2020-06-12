import RoomClient from './client/RoomClient.js';

/* const defaultIceServers = [
  {'urls': 'stun:stun.stunprotocol.org:3478'},
  {'urls': 'stun:stun.l.google.com:19302'},
]; */

const roomAlphabetStartIndex = 'A'.charCodeAt(0);
const roomAlphabetEndIndex = 'Z'.charCodeAt(0)+1;
const roomIdLength = 4;
function makeId() {
  let result = '';
  for (let i = 0; i < roomIdLength; i++) {
    result += String.fromCharCode(roomAlphabetStartIndex + Math.floor(Math.random() * (roomAlphabetEndIndex - roomAlphabetStartIndex)));
  }
  return result;
}

class XRChannelConnection extends EventTarget {
  constructor(url, options = {}) {
    super();

    // this.rtcWs = new WebSocket(url);
    this.connectionId = makeId();
    this.peerConnections = [];
    this.microphoneMediaStream = options.microphoneMediaStream;
    this.videoMediaStream = options.videoMediaStream;

    const _addPeerConnection = peerConnectionId => {
      let peerConnection = this.peerConnections.find(peerConnection => peerConnection.connectionId === peerConnectionId);
      if (!peerConnection) {
        peerConnection = new XRPeerConnection(peerConnectionId);
        /* peerConnection.token = this.connectionId < peerConnectionId ? -1 : 0;
        peerConnection.needsNegotiation = false;
        peerConnection.negotiating = false;
        peerConnection.peerConnection.onnegotiationneeded = e => {
          console.log('negotiation needed', peerConnection.token, peerConnection.negotiating);
          if (peerConnection.token !== 0 && !peerConnection.negotiating) {
            if (peerConnection.token !== -1) {
              clearTimeout(peerConnection.token);
              peerConnection.token = -1;
            }
            peerConnection.needsNegotiation = false;
            peerConnection.negotiating = true;

            _startOffer(peerConnection);
          } else {
            peerConnection.needsNegotiation = true;
          }
        }; */
      }
      return peerConnection;
    };

    const {roomName, displayName} = options;
    let sendDataChannel = null;
    const dialogClient = new RoomClient({
      url: `${url}?roomId=${roomName}&peerId=${this.connectionId}`,
      displayName,
    });
    dialogClient.addEventListener('addsend', async e => {
      const {data: {dataProducer: {id, _dataChannel}}} = e;
      console.log('add send', _dataChannel);
      if (_dataChannel.readyState !== 'open') {
        await new Promise((accept, reject) => {
          const _open = e => {
            accept();

            // _dataChannel.flushMessageQueue();
            _dataChannel.removeEventListener('open', _open);
          };
          _dataChannel.addEventListener('open', _open);
        });
      }
      sendDataChannel = _dataChannel;
      // console.log('sending...');
      // _dataChannel.send('lol');
    });
    dialogClient.addEventListener('removesend', e => {
      const {data: {dataProducer: {id, _dataChannel}}} = e;
      console.log('remove send', _dataChannel);
      sendDataChannel = null;
    });
    dialogClient.addEventListener('addreceive', e => {
      const {data: {peerId, dataConsumer: {id, _dataChannel}}} = e;
      console.log('add data reveive', peerId, _dataChannel);
      /* _dataChannel.addEventListener('message', e => {
        console.log('got data message', peerId, e);
      }); */
      if (peerId) {
        const peerConnection = _addPeerConnection(peerId);
        peerConnection.setDataChannel(_dataChannel);
      }
    });
    dialogClient.addEventListener('removereceive', e => {
      const {data: {peerId, dataConsumer: {id, _dataChannel}}} = e;
      console.log('remove data receive', peerId, _dataChannel);

      if (peerId) {
        _removePeerConnection(peerId);
      }
    });
    dialogClient.addEventListener('addreceivestream', e => {
      const {data: {peerId, consumer: {id, _track}}} = e;
      console.log('add receive stream', peerId, _track);
      if (peerId) {
        const peerConnection = _addPeerConnecation(peerId);
        peerConnection.addTrack(_track);
      }
    });
    dialogClient.addEventListener('removereceivestream', e => {
      const {data: {peerId, consumer: {id, _track}}} = e;
      console.log('remove receive stream', peerId, _track);
      if (peerId) {
        const peerConnection = _addPeerConnection(peerId);
        peerConnection.removeTrack(_track);
      }
    });

    (async () => {
      console.log('join 1');
      await dialogClient.join();
      console.log('join 2');
      await dialogClient.enableChatDataProducer();
      // await dialogClient.enableMic();
      // await dialogClient.enableWebcam();
      console.log('join 3');
    })();

    /* this.rtcWs.onopen = () => {
      // console.log('presence socket open');

      this.rtcWs.send(JSON.stringify({
        method: 'init',
        connectionId: this.connectionId,
      }));

      this.dispatchEvent(new CustomEvent('open'));
    };
    const _addPeerConnection = peerConnectionId => {
      let peerConnection = this.peerConnections.find(peerConnection => peerConnection.connectionId === peerConnectionId);
      if (!peerConnection) {
        peerConnection = new XRPeerConnection(peerConnectionId);
        peerConnection.token = this.connectionId < peerConnectionId ? -1 : 0;
        peerConnection.needsNegotiation = false;
        peerConnection.negotiating = false;
        peerConnection.peerConnection.onnegotiationneeded = e => {
          console.log('negotiation needed', peerConnection.token, peerConnection.negotiating);
          if (peerConnection.token !== 0 && !peerConnection.negotiating) {
            if (peerConnection.token !== -1) {
              clearTimeout(peerConnection.token);
              peerConnection.token = -1;
            }
            peerConnection.needsNegotiation = false;
            peerConnection.negotiating = true;

            _startOffer(peerConnection);
          } else {
            peerConnection.needsNegotiation = true;
          }
        };
        peerConnection.peerConnection.onicecandidate = e => {
          // console.log('ice candidate', e.candidate);

          this.rtcWs.send(JSON.stringify({
            dst: peerConnectionId,
            src: this.connectionId,
            method: 'iceCandidate',
            candidate: e.candidate,
          }));
        };
        peerConnection.peerConnection.oniceconnectionstatechange = () => {
          if (peerConnection.peerConnection.iceConnectionState == 'disconnected') {
            peerConnection.close();
          }
        };
        peerConnection.onclose = () => {
          const index = this.peerConnections.indexOf(peerConnection);
          if (index !== -1) {
            this.peerConnections.splice(index, 1);
          }
        };

        this.peerConnections.push(peerConnection);
        this.dispatchEvent(new CustomEvent('peerconnection', {
          detail: peerConnection,
        }));

        if (this.microphoneMediaStream) {
          // peerConnection.peerConnection.addStream(this.microphoneMediaStream);
          const tracks = this.microphoneMediaStream.getAudioTracks();
          for (let i = 0; i < tracks.length; i++) {
            // console.log('add track for remote', tracks[i]);
            peerConnection.peerConnection.addTrack(tracks[i]);
          }
        }
        if (this.videoMediaStream) {
          // peerConnection.peerConnection.addStream(this.microphoneMediaStream);
          const tracks = this.videoMediaStream.getVideoTracks();
          for (let i = 0; i < tracks.length; i++) {
            // console.log('add track for remote', tracks[i]);
            peerConnection.peerConnection.addTrack(tracks[i]);
          }
        }
      }
    };
    const _removePeerConnection = peerConnectionId => {
      const index = this.peerConnections.findIndex(peerConnection => peerConnection.connectionId === peerConnectionId);
      if (index !== -1) {
        this.peerConnections.splice(index, 1)[0].close();
      } else {
        console.warn('no such peer connection', peerConnectionId, this.peerConnections.map(peerConnection => peerConnection.connectionId));
      }
    };
    const _startOffer = peerConnection => {
      peerConnection.peerConnection
        .createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })
        .then(offer => {
          // console.log('create offer');
          return peerConnection.peerConnection.setLocalDescription(offer).then(() => offer);
        })
        .then(offer => {
          this.rtcWs.send(JSON.stringify({
            dst: peerConnection.connectionId,
            src: this.connectionId,
            method: 'offer',
            offer,
          }));
        });
    };
    this.rtcWs.onmessage = e => {
      // console.log('got message', e.data);

      const data = JSON.parse(e.data);
      const {method} = data;
      if (method === 'join') {
        const {connectionId: peerConnectionId} = data;
        _addPeerConnection(peerConnectionId);
      } else if (method === 'offer') {
        const {src: peerConnectionId, offer} = data;

        const peerConnection = this.peerConnections.find(peerConnection => peerConnection.connectionId === peerConnectionId);
        if (peerConnection) {
          peerConnection.peerConnection.setRemoteDescription(offer)
            .then(() => {
              // console.log('create answer');
              return peerConnection.peerConnection.createAnswer();
            })
            .then(answer => peerConnection.peerConnection.setLocalDescription(answer).then(() => answer))
            .then(answer => {
              this.rtcWs.send(JSON.stringify({
                dst: peerConnectionId,
                src: this.connectionId,
                method: 'answer',
                answer,
              }));
            }).then(() => new Promise((accept, reject) => {
              const _recurse = () => {
                if (peerConnection.peerConnection.signalingState === 'stable') {
                  accept();
                } else {
                  peerConnection.peerConnection.addEventListener('signalingstatechange', _recurse, {
                    once: true,
                  });
                }
              };
              _recurse();
            }));
        } else {
          console.warn('no such peer connection', peerConnectionId, this.peerConnections.map(peerConnection => peerConnection.connectionId));
        }
      } else if (method === 'answer') {
        const {src: peerConnectionId, answer} = data;

        const peerConnection = this.peerConnections.find(peerConnection => peerConnection.connectionId === peerConnectionId);
        if (peerConnection) {
          peerConnection.peerConnection.setRemoteDescription(answer)
            .then(() => {
              peerConnection.negotiating = false;
              peerConnection.token = 0;

              this.rtcWs.send(JSON.stringify({
                dst: peerConnectionId,
                src: this.connectionId,
                method: 'token',
              }));
            });
        } else {
          console.warn('no such peer connection', peerConnectionId, this.peerConnections.map(peerConnection => peerConnection.connectionId));
        }
      } else if (method === 'iceCandidate') {
        const {src: peerConnectionId, candidate} = data;

        const peerConnection = this.peerConnections.find(peerConnection => peerConnection.connectionId === peerConnectionId);
        if (peerConnection) {
          peerConnection.peerConnection.addIceCandidate(candidate)
            .catch(err => {
              // console.warn(err);
            });
        } else {
          console.warn('no such peer connection', peerConnectionId, this.peerConnections.map(peerConnection => peerConnection.connectionId));
        }
      } else if (method === 'token') {
        const {src: peerConnectionId} = data;

        const peerConnection = this.peerConnections.find(peerConnection => peerConnection.connectionId === peerConnectionId);
        if (peerConnection) {
          if (peerConnection.needsNegotiation) {
            peerConnection.token = -1;
            peerConnection.needsNegotiation = false;
            peerConnection.negotiating = true;

            _startOffer(peerConnection);
          } else {
            peerConnection.token = setTimeout(() => {
              peerConnection.token = 0;

              this.rtcWs.send(JSON.stringify({
                dst: peerConnectionId,
                src: this.connectionId,
                method: 'token',
              }));
            }, 500);
          }
        } else {
          console.warn('no such peer connection', peerConnectionId, this.peerConnections.map(peerConnection => peerConnection.connectionId));
        }
      } else if (method === 'leave') {
        const {connectionId: peerConnectionId} = data;
        _removePeerConnection(peerConnectionId);
      } else {
        this.dispatchEvent(new MessageEvent('message', {
          data: e.data,
        }));
      }
    };
    this.rtcWs.onclose = () => {
      clearInterval(pingInterval);
      console.log('rtc ws got close');

      this.dispatchEvent(new CustomEvent('close'));
    };
    this.rtcWs.onerror = err => {
      console.warn('rtc error', err);
      clearInterval(pingInterval);

      this.dispatchEvent(new ErrorEvent('error', {
        message: err.stack,
      }));
    };
    const pingInterval = setInterval(() => {
      this.rtcWs.send(JSON.stringify({
        method: 'ping',
      }));
    }, 30*1000); */
  }

  disconnect() {
    this.rtcWs.close();
    this.rtcWs = null;

    for (let i = 0; i < this.peerConnections.length; i++) {
      this.peerConnections[i].close();
    }
    this.peerConnections.length = 0;
  }

  send(s) {
    this.rtcWs.send(s);
  }

  update(hmd, gamepads) {
    for (let i = 0; i < this.peerConnections.length; i++) {
      const peerConnection = this.peerConnections[i];
      if (peerConnection.open) {
        peerConnection.update(hmd, gamepads);
      }
    }
  }

  setMicrophoneMediaStream(microphoneMediaStream) {
    const {microphoneMediaStream: oldMicrophoneMediaStream} = this;
    if (oldMicrophoneMediaStream) {
      const oldTracks = oldMicrophoneMediaStream.getAudioTracks();
      for (let i = 0; i < this.peerConnections.length; i++) {
        const peerConnection = this.peerConnections[i];
        const senders = peerConnection.peerConnection.getSenders();
        const oldTrackSenders = oldTracks.map(track => senders.find(sender => sender.track === track));
        for (let j = 0; j < oldTrackSenders.length; j++) {
          peerConnection.peerConnection.removeTrack(oldTrackSenders[j]);
        }
      }
    }

    this.microphoneMediaStream = microphoneMediaStream;

    if (microphoneMediaStream) {
      const tracks = microphoneMediaStream.getAudioTracks();
      for (let i = 0; i < this.peerConnections.length; i++) {
        const peerConnection = this.peerConnections[i];
        for (let j = 0; j < tracks.length; j++) {
          peerConnection.peerConnection.addTrack(tracks[j]);
        }
      }
    }
  }
  
  setVideoMediaStream(videoMediaStream) {
    const {videoMediaStream: oldVideoMediaStream} = this;
    if (oldVideoMediaStream) {
      const oldTracks = oldVideoMediaStream.getVideoTracks();
      for (let i = 0; i < this.peerConnections.length; i++) {
        const peerConnection = this.peerConnections[i];
        const senders = peerConnection.peerConnection.getSenders();
        const oldTrackSenders = oldTracks.map(track => senders.find(sender => sender.track === track));
        for (let j = 0; j < oldTrackSenders.length; j++) {
          peerConnection.peerConnection.removeTrack(oldTrackSenders[j]);
        }
      }
    }

    this.videoMediaStream = videoMediaStream;

    if (videoMediaStream) {
      const tracks = videoMediaStream.getVideoTracks();
      for (let i = 0; i < this.peerConnections.length; i++) {
        const peerConnection = this.peerConnections[i];
        for (let j = 0; j < tracks.length; j++) {
          peerConnection.peerConnection.addTrack(tracks[j]);
        }
      }
    }
  }
}

class XRPeerConnection extends EventTarget {
  constructor(peerConnectionId) {
    super();

    this.connectionId = peerConnectionId;
    this.open = false;

    /* this.peerConnection.ontrack = e => {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(e.track);
      this.dispatchEvent(new CustomEvent('mediastream', {
        detail: mediaStream,
      }));
    };

    const sendChannel = this.peerConnection.createDataChannel('sendChannel');
    this.peerConnection.sendChannel = sendChannel;
    let pingInterval = 0;
    sendChannel.onopen = () => {
      // console.log('data channel local open');

      this.open = true;
      this.dispatchEvent(new CustomEvent('open'));
    };
    sendChannel.onclose = () => {
      console.log('send channel got close');

      _cleanup();
    };
    sendChannel.onerror = err => {
      // console.log('data channel local error', err);
    };
    this.peerConnection.ondatachannel = e => {
      const {channel} = e;
      // console.log('data channel remote open', channel);
      channel.onclose = () => {
        // console.log('data channel remote close');
        this.peerConnection.close();
      };
      channel.onerror = err => {
        // console.log('data channel remote error', err);
      };
      channel.onmessage = e => {
        // console.log('data channel message', e.data);

        const data = JSON.parse(e.data);
        const {method} = data;
        if (method === 'pose') {
          this.dispatchEvent(new CustomEvent('pose', {
            detail: data,
          }))
        } else {
          this.dispatchEvent(new MessageEvent('message', {
            data: e.data,
          }));
        }

        // _kick();
      };
      this.peerConnection.recvChannel = channel;
    };
    this.peerConnection.close = (close => function() {
      _cleanup();

      return close.apply(this, arguments);
    })(this.peerConnection.close);
    const _cleanup = () => {
      if (this.open) {
        this.open = false;
        this.dispatchEvent(new CustomEvent('close'));
      }
      if (this.token !== -1) {
        clearTimeout(this.token);
        this.token = -1;
      }
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = 0;
      }
    }; */
  }
  close() {
    this.peerConnection.close();
    this.peerConnection.sendChannel && this.peerConnection.sendChannel.close();
    this.peerConnection.recvChannel && this.peerConnection.recvChannel.close();
  }

  setDataChannel(dataChannel) {
    console.log('set data channel', dataChannel);
  }
  addTrack(track) {
    console.log('add track', track);
  }
  removeTrack(track) {
    console.log('remove track', track);
  }

  send(s) {
    this.peerConnection.sendChannel.send(s);
  }

  update(hmd, gamepads) {
    this.send(JSON.stringify({
      method: 'pose',
      hmd,
      gamepads,
    }));
  }
}

export {
  makeId,
  XRChannelConnection,
  XRPeerConnection,
};