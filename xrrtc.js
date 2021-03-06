const defaultIceServers = [
  {'urls': 'stun:stun.stunprotocol.org:3478'},
  {'urls': 'stun:stun.l.google.com:19302'},
];

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

    this.rtcWs = new WebSocket(url);
    this.connectionId = makeId();
    this.peerConnections = [];
    this.microphoneMediaStream = options.microphoneMediaStream;
    this.videoMediaStream = options.videoMediaStream;
    this.open = true;

    this.rtcWs.onopen = () => {
      // console.log('presence socket open');

      this.rtcWs.send(JSON.stringify({
        method: 'init',
        connectionId: this.connectionId,
      }));

      this.dispatchEvent(new MessageEvent('open'));
    };
    const _addPeerConnection = peerConnectionId => {
      let peerConnection = this.peerConnections.find(peerConnection => peerConnection.connectionId === peerConnectionId);
      /* if (peerConnection && !peerConnection.open) {
        peerConnection.close();
        peerConnection = null;
      } */
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
        this.dispatchEvent(new MessageEvent('peerconnection', {
          data: peerConnection,
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
          data: JSON.parse(e.data),
        }));
      }
    };
    this.rtcWs.onclose = () => {
      clearInterval(pingInterval);
      console.log('rtc ws got close');

      if (this.open) {
        this.open = false;
        this.dispatchEvent(new MessageEvent('close'));
      }
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
    }, 30*1000);
  }

  close() {
    if (this.open) {
      this.open = false;
      this.dispatchEvent(new MessageEvent('close'));
    }

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

    this.peerConnection = new RTCPeerConnection({
      iceServers: defaultIceServers,
    });
    this.open = true;
    this.sendChannelOpen = false;
    this.queue = [];

    /* this.peerConnection.onaddstream = e => {
      this.dispatchEvent(new MessageEvent('mediastream', {
        data: e.stream,
      }));
    }; */
    this.peerConnection.ontrack = e => {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(e.track);
      this.dispatchEvent(new MessageEvent('mediastream', {
        data: mediaStream,
      }));
    };

    const sendChannel = this.peerConnection.createDataChannel('sendChannel');
    this.peerConnection.sendChannel = sendChannel;
    let pingInterval = 0;
    sendChannel.onopen = () => {
      this.sendChannelOpen = true;
      const queue = this.queue.slice();
      this.queue.length = 0;
      for (let i = 0; i < queue.length; i++) {
        const [method, data] = queue[i];
        this.send(method, data);
      }
    };
    sendChannel.onclose = () => {
      console.log('send channel got close');

      this.sendChannelOpen = false;

      _cleanup();
    };
    sendChannel.onerror = err => {
      // console.log('data channel local error', err);
    };
    /* let watchdogTimeout = 0;
    const _kick = () => {
      if (watchdogTimeout) {
        clearTimeout(watchdogTimeout);
        watchdogTimeout = 0;
      }
      watchdogTimeout = setTimeout(() => {
        this.peerConnection.close();
      }, 5000);
    };
    _kick(); */
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

        const j = JSON.parse(e.data);
        const [method, data] = j;
        this.dispatchEvent(new MessageEvent(method, {
          data,
        }));

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
        this.dispatchEvent(new MessageEvent('close'));
      }
      if (this.token !== -1) {
        clearTimeout(this.token);
        this.token = -1;
      }
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = 0;
      }
    };
  }

  close() {
    this.peerConnection.close();
    this.peerConnection.sendChannel && this.peerConnection.sendChannel.close();
    this.peerConnection.recvChannel && this.peerConnection.recvChannel.close();
  }

  send(method, data) {
    if (this.sendChannelOpen) {
      this.peerConnection.sendChannel.send(JSON.stringify([method, data]));
    } else {
      this.queue.push([method, data]);
    }
  }

  /* update(hmd, gamepads) {
    this.send(JSON.stringify({
      method: 'pose',
      hmd,
      gamepads,
    }));
  } */
}

export {
  XRChannelConnection,
  XRPeerConnection,
};