# MetaRTC

Metaverse party system.

Abstracts WebRTC into rooms of peers. Uses a presence server to negotiate P2P connections and presents an API to transmit P2P data and media streams.

The presence server is [here](https://github.com/exokitxr/exokit-backend).

## API

To use the API, first import the script:

```
import {XRChannelConnection} from 'https://raw.githack.com/webaverse/metartc/doc/xrrtc.js';
```

Alternatively, you can clone the repo and include the files in your project.

### `XRChannelConnection`

Represents a WebSocket connection to the presence server. Create an `XRChannelConnection` to establish yourself as a peer in the room:

```
const roomId = 'meta'; // a string identifying the room
const channelConnection = new XRChannelConnection(`wss://presence.exokit.org/?c=${encodeURIComponent(roomId)}`);
```

#### `close() : void`

Closes the `XRChannelConnection` and any associated peers.

#### `'peerconnection' event`

Represents a peer joining the room.

```
channelConnection.addEventListener('peerconnection', e => {
  const peerConnection = e.data;
  // ...
});
```

#### `'close' event`

Emitted on the `XRChannelConnection` closing. Do not use the connection after this event.

### `XRPeerConnection`

Represents a connection to a peer. Emitted from `XRChannelConnection`.

#### `send(method : String, data : any) : void`

Sends the given `method` and `data` to the peer, where it will be emitted. `data` must be JSON-serializable.

```
// local
peerConnection.send('pose', {
  position: [1, 2, 3],
});

// remote
peerConnection.addEventListener('pose', e => {
  console.log(e.data); // logs [1, 2, 3]
});
```

#### `close() : void`

Forcefully closes the `XRPeerConnection`. Both ends will get a `close` event.

#### `'open' event`

Emitted on the peer connection opening for data transfer.

#### `'open' event`

Emitted on the `XRPeerConnection` closing. Do not use the connection after this event.

#### Other events

Any method passed to `send` will become an event type on the other end of the `XRPeerConnection`.

# TODO

- Document microphone media streams
- Document screenshare media streams