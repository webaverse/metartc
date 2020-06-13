import Avatar from 'https://avatars.exokit.org/avatars.js';
import avatarModels from 'https://avatar-models.exokit.org/avatar-models.js';
import ModelLoader from 'https://model-loader.exokit.org/model-loader.js';

const modelUpdateRate = 50;
const peerPoseUpdateRate = 50;
const localVector = new THREE.Vector3();

let rig = null;
let modelUrl = null;
const _alignRigHandsToHead = rig => {
  rig.inputs.leftGamepad.position.copy(rig.inputs.hmd.position).add(localVector.set(0.3, -0.15, -0.5).applyQuaternion(rig.inputs.hmd.quaternion));
  rig.inputs.leftGamepad.quaternion.copy(rig.inputs.hmd.quaternion);
  rig.inputs.rightGamepad.position.copy(rig.inputs.hmd.position).add(localVector.set(-0.3, -0.15, -0.5).applyQuaternion(rig.inputs.hmd.quaternion));
  rig.inputs.rightGamepad.quaternion.copy(rig.inputs.hmd.quaternion);
};
export async function initLocalRig() {
  const {url} = avatarModels[0];
  modelUrl = `https://avatar-models.exokit.org/${url}`;
  const model = await ModelLoader.loadModelUrl(modelUrl);
  model.scene.traverse(o => {
    o.frustumCulled = false;
  });
  rig = new Avatar(model, {
    fingers: true,
    hair: true,
    visemes: true,
    decapitate: false,
    microphoneMediaStream: null,
    // debug: !newModel,
  });
  rig.inputs.hmd.position.set(-2 + Math.random()*4, 1.2, Math.random()*-1);
  rig.inputs.hmd.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  _alignRigHandsToHead(rig);
  rig.update();
  return rig;
}
export function updatePlayerFromCamera(camera) {
  if (rig) {
    rig.inputs.hmd.position.copy(camera.position);
    rig.inputs.hmd.quaternion.copy(camera.quaternion);
    _alignRigHandsToHead(rig);

    rig.update();
  }
}
export function updatePlayerFromXr(xr, camera) {
  if (rig) {
    const {cameras} = xr.getCamera(camera);
    for (let i = 0; i < cameras.length; i++) {
      const camera = cameras[i];
      camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
    }
    rig.inputs.hmd.position
      .copy(cameras[0].position)
      .add(cameras[1].position)
      .divideScalar(2);
    rig.inputs.hmd.quaternion
      .copy(cameras[0].quaternion)
      .slerp(cameras[1].quaternion, 0.5);

    for (let i = 0; i < 2; i++) {
      const controller = xr.getController(i);
      const controllerGrip = xr.getControllerGrip(i);
      if (controller.userData.data && controller.userData.data.handedness === 'left') {
        rig.inputs.rightGamepad.position.copy(controllerGrip.position);
        rig.inputs.rightGamepad.quaternion.copy(controllerGrip.quaternion);
        
        const {gamepad} = controller.userData.data;
        window.userData = {data: controller.userData.data};
        rig.inputs.rightGamepad.pointer = gamepad.buttons[0].value;
        rig.inputs.rightGamepad.grip = gamepad.buttons[1].value;
      } else if (controller.userData.data && controller.userData.data.handedness === 'right') {
        rig.inputs.leftGamepad.position.copy(controllerGrip.position);
        rig.inputs.leftGamepad.quaternion.copy(controllerGrip.quaternion);
        
        const {gamepad} = controller.userData.data;
        rig.inputs.leftGamepad.pointer = gamepad.buttons[0].value;
        rig.inputs.leftGamepad.grip = gamepad.buttons[1].value;
      }
    }

    rig.update();
  }
}
export function updatePlayerFromArrays(xr, hmd, left, right) {
  if (rig) {
    window.rig = rig;
    const localMatrix = new THREE.Matrix4();
    const localScale = new THREE.Vector3();

    localMatrix.fromArray(hmd);
    localMatrix.decompose(rig.inputs.hmd.position, rig.inputs.hmd.quaternion, localScale);
    localMatrix.fromArray(left);
    localMatrix.decompose(rig.inputs.rightGamepad.position, rig.inputs.rightGamepad.quaternion, localScale);
    localMatrix.fromArray(right);
    localMatrix.decompose(rig.inputs.leftGamepad.position, rig.inputs.leftGamepad.quaternion, localScale);

    rig.update();
  }
}
export function updatePlayerDefault() {
  rig && rig.update();
}
export function getRigBoneTexture() {
  if (rig && rig.skinnedMeshes.length > 0) {
    const skeleton = rig.skinnedMeshes[0].skeleton;
    return skeleton.boneTexture.image.data.slice(0, skeleton.bones.length*16);
  } else {
    return null;
  }
}
const heightFactor = 1;//_getHeightFactor(peerConnection.rig.height);
export function bindChannelConnection(channelConnection) {
  channelConnection.addEventListener('open', e => {
    const updateInterval = setInterval(() => {
      channelConnection.send(JSON.stringify({
        method: 'model',
        // src: channelConnection.connectionId,
        dst: null,
        url: modelUrl,
      }));
    }, modelUpdateRate);
    const updateInterval1 = setInterval(() => {
      if (rig) {
        const hmd = {
          position: localVector.copy(rig.inputs.hmd.position).divideScalar(heightFactor).toArray(),
          quaternion: rig.inputs.hmd.quaternion.toArray(),
          scaleFactor: rig.inputs.hmd.scaleFactor,
        };
        const gamepads = [
          {
            position: localVector.copy(rig.inputs.leftGamepad.position).divideScalar(heightFactor).toArray(),
            quaternion: rig.inputs.leftGamepad.quaternion.toArray(),
            pointer: rig.inputs.leftGamepad.pointer,
            grip: rig.inputs.leftGamepad.grip,
            visible: true,
          },
          {
            position: localVector.copy(rig.inputs.rightGamepad.position).divideScalar(heightFactor).toArray(),
            quaternion: rig.inputs.rightGamepad.quaternion.toArray(),
            pointer: rig.inputs.rightGamepad.pointer,
            grip: rig.inputs.rightGamepad.grip,
            visible: true,
          },
        ];
        channelConnection.send(JSON.stringify({
          method: 'pose',
          // src: channelConnection.connectionId,
          dst: null,
          hmd,
          gamepads,
        }));
      }
    }, peerPoseUpdateRate);

    channelConnection.addEventListener('close', e => {
      console.log('send model', modelUrl);
      
      clearInterval(updateInterval);
      clearInterval(updateInterval2);
    }, {once: true});
  }, {once: true});
}
export function bindPeerConnection(peerConnection, container) {
  console.log('bind peer connection', peerConnection);

  peerConnection.username = 'Anonymous';
  peerConnection.rig = null;
  peerConnection.rigUrl = null;
  peerConnection.microphoneMediaStream = null;
  peerConnection.screenshareMediaStream = null;

  peerConnection.addEventListener('close', () => {
    console.log('peer connection close', peerConnection);

    if (peerConnection.rig) {
      container.remove(peerConnection.rig.model);
    }
  }, {once: true});
  /* peerConnection.addEventListener('pose', e => {
    const {rig} = peerConnection;
    if (rig) {
      const {detail: data} = e;
      const {hmd, gamepads} = data;

      rig.starts.hmd.position.copy(peerConnection.rig.inputs.hmd.position);
      rig.starts.hmd.rotation.copy(peerConnection.rig.inputs.hmd.quaternion);
      rig.starts.hmd.scaleFactor = peerConnection.rig.inputs.hmd.scaleFactor;
      rig.starts.gamepads[0].position.copy(peerConnection.rig.inputs.leftGamepad.position);
      rig.starts.gamepads[0].rotation.copy(peerConnection.rig.inputs.leftGamepad.quaternion);
      rig.starts.gamepads[0].pointer = peerConnection.rig.inputs.leftGamepad.pointer;
      rig.starts.gamepads[0].grip = peerConnection.rig.inputs.leftGamepad.grip;
      rig.starts.gamepads[1].position.copy(peerConnection.rig.inputs.rightGamepad.position);
      rig.starts.gamepads[1].rotation.copy(peerConnection.rig.inputs.rightGamepad.quaternion);
      rig.starts.gamepads[1].pointer = peerConnection.rig.inputs.rightGamepad.pointer;
      rig.starts.gamepads[1].grip = peerConnection.rig.inputs.rightGamepad.grip;

      rig.targets.hmd.position.fromArray(hmd.position);
      rig.targets.hmd.rotation.fromArray(hmd.quaternion);
      rig.targets.hmd.scaleFactor = hmd.scaleFactor;
      rig.targets.gamepads[0].position.fromArray(gamepads[0].position);
      rig.targets.gamepads[0].rotation.fromArray(gamepads[0].quaternion);
      rig.targets.gamepads[0].pointer = gamepads[0].pointer;
      rig.targets.gamepads[0].grip = gamepads[0].grip;
      rig.targets.gamepads[1].position.fromArray(gamepads[1].position);
      rig.targets.gamepads[1].rotation.fromArray(gamepads[1].quaternion);
      rig.targets.gamepads[1].pointer = gamepads[1].pointer;
      rig.targets.gamepads[1].grip = gamepads[1].grip;
      rig.targets.timestamp = Date.now();
    }
  }); */
  peerConnection.addEventListener('mediastream', e => {
    const audioTracks = e.detail.getAudioTracks();
    if (audioTracks.length > 0) {
      peerConnection.microphoneMediaStream = e.detail;
    }
    const videoTracks = e.detail.getVideoTracks();
    if (videoTracks.length > 0) {
      peerConnection.screenshareMediaStream = e.detail;
    }
    if (peerConnection.rig) {
      if (audioTracks.length > 0) {
        peerConnection.rig.setMicrophoneMediaStream(peerConnection.microphoneMediaStream, {
          muted: false,
        });
      }
      if (videoTracks.length > 0) {
        peerConnection.dispatchEvent(new CustomEvent('screenshare', {
          detail: peerConnection.screenshareMediaStream,
        }));
      }
    }
  });
  peerConnection.addEventListener('message', async e => {
    // const data = JSON.parse(e.data);
    const {data} = e;
    const {method} = data;
    if (method === 'username') {
      const {name} = data;
      peerConnection.username = name;

      /* if (peerConnection.rig && peerConnection.rig.nametagMesh) {
        peerConnection.rig.nametagMesh.setName(name);
      } */
    } else if (method === 'pose') {
      const {rig} = peerConnection;
      if (rig) {
        // const {detail: data} = e;
        const {hmd, gamepads} = data;

        rig.starts.hmd.position.copy(peerConnection.rig.inputs.hmd.position);
        rig.starts.hmd.rotation.copy(peerConnection.rig.inputs.hmd.quaternion);
        rig.starts.hmd.scaleFactor = peerConnection.rig.inputs.hmd.scaleFactor;
        rig.starts.gamepads[0].position.copy(peerConnection.rig.inputs.leftGamepad.position);
        rig.starts.gamepads[0].rotation.copy(peerConnection.rig.inputs.leftGamepad.quaternion);
        rig.starts.gamepads[0].pointer = peerConnection.rig.inputs.leftGamepad.pointer;
        rig.starts.gamepads[0].grip = peerConnection.rig.inputs.leftGamepad.grip;
        rig.starts.gamepads[1].position.copy(peerConnection.rig.inputs.rightGamepad.position);
        rig.starts.gamepads[1].rotation.copy(peerConnection.rig.inputs.rightGamepad.quaternion);
        rig.starts.gamepads[1].pointer = peerConnection.rig.inputs.rightGamepad.pointer;
        rig.starts.gamepads[1].grip = peerConnection.rig.inputs.rightGamepad.grip;

        rig.targets.hmd.position.fromArray(hmd.position);
        rig.targets.hmd.rotation.fromArray(hmd.quaternion);
        rig.targets.hmd.scaleFactor = hmd.scaleFactor;
        rig.targets.gamepads[0].position.fromArray(gamepads[0].position);
        rig.targets.gamepads[0].rotation.fromArray(gamepads[0].quaternion);
        rig.targets.gamepads[0].pointer = gamepads[0].pointer;
        rig.targets.gamepads[0].grip = gamepads[0].grip;
        rig.targets.gamepads[1].position.fromArray(gamepads[1].position);
        rig.targets.gamepads[1].rotation.fromArray(gamepads[1].quaternion);
        rig.targets.gamepads[1].pointer = gamepads[1].pointer;
        rig.targets.gamepads[1].grip = gamepads[1].grip;
        rig.targets.timestamp = Date.now();
      }
    } else if (method === 'model') {
      const {url} = data;

      if (peerConnection.rigUrl !== url) {
        console.log('change peer rig model to url', url, peerConnection.rigUrl);

        if (peerConnection.rig) {
          container.remove(peerConnection.rig.model);
          peerConnection.rig.destroy();
        }

        peerConnection.rigUrl = url;

        const model = url ? await ModelLoader.loadModelUrl(url) : null;
        model.scene.traverse(o => {
          o.frustumCulled = false;
        });
        peerConnection.rig = new Avatar(model, {
          fingers: true,
          hair: true,
          visemes: true,
          microphoneMediaStream: peerConnection.microphoneMediaStream,
          muted: false,
          debug: !model,
        });
        peerConnection.rig.url = url;
        container.add(peerConnection.rig.model);

        peerConnection.rig.starts = {
          hmd: {
            position: peerConnection.rig.inputs.hmd.position.clone(),
            rotation: peerConnection.rig.inputs.hmd.quaternion.clone(),
            scaleFactor: peerConnection.rig.inputs.hmd.scaleFactor,
          },
          gamepads: [
            {
              position: peerConnection.rig.inputs.leftGamepad.position.clone(),
              rotation:  peerConnection.rig.inputs.leftGamepad.quaternion.clone(),
              pointer: peerConnection.rig.inputs.leftGamepad.pointer,
              grip: peerConnection.rig.inputs.leftGamepad.grip,
            },
            {
              position: peerConnection.rig.inputs.rightGamepad.position.clone(),
              rotation: peerConnection.rig.inputs.rightGamepad.quaternion.clone(),
              pointer: peerConnection.rig.inputs.rightGamepad.pointer,
              grip: peerConnection.rig.inputs.rightGamepad.grip,
            },
          ],
        };
        peerConnection.rig.targets = {
          hmd: {
            position: new THREE.Vector3(),
            rotation: new THREE.Quaternion(),
            scaleFactor: 1,
          },
          gamepads: [
            {
              position: new THREE.Vector3(),
              rotation: new THREE.Quaternion(),
              pointer: 0,
              grip: 0,
            },
            {
              position: new THREE.Vector3(),
              rotation: new THREE.Quaternion(),
              pointer: 0,
              grip: 0,
            },
          ],
          timestamp: Date.now(),
        };
        peerConnection.rig.update = (_update => function update() {
          const now = Date.now();
          const {timestamp} = peerConnection.rig.targets;
          const lerpFactor = Math.min(Math.max((now - timestamp) / (peerPoseUpdateRate*2), 0), 1);

          peerConnection.rig.inputs.hmd.quaternion.copy(peerConnection.rig.starts.hmd.rotation).slerp(peerConnection.rig.targets.hmd.rotation, lerpFactor);
          peerConnection.rig.inputs.hmd.position.copy(peerConnection.rig.starts.hmd.position).lerp(
            localVector.copy(peerConnection.rig.targets.hmd.position).multiplyScalar(heightFactor),
            lerpFactor
          );
          peerConnection.rig.inputs.hmd.scaleFactor = peerConnection.rig.starts.hmd.scaleFactor * (1-lerpFactor) + peerConnection.rig.targets.hmd.scaleFactor * lerpFactor;

          peerConnection.rig.inputs.leftGamepad.position.copy(peerConnection.rig.starts.gamepads[0].position).lerp(
            localVector.copy(peerConnection.rig.targets.gamepads[0].position).multiplyScalar(heightFactor),
            lerpFactor
          );
          peerConnection.rig.inputs.leftGamepad.quaternion.copy(peerConnection.rig.starts.gamepads[0].rotation).slerp(peerConnection.rig.targets.gamepads[0].rotation, lerpFactor);
          peerConnection.rig.inputs.leftGamepad.pointer = peerConnection.rig.starts.gamepads[0].pointer * (1-lerpFactor) + peerConnection.rig.targets.gamepads[0].pointer * lerpFactor;
          peerConnection.rig.inputs.leftGamepad.grip = peerConnection.rig.starts.gamepads[0].grip * (1-lerpFactor) + peerConnection.rig.targets.gamepads[0].grip * lerpFactor;

          peerConnection.rig.inputs.rightGamepad.position.copy(peerConnection.rig.starts.gamepads[1].position).lerp(
            localVector.copy(peerConnection.rig.targets.gamepads[1].position).multiplyScalar(heightFactor),
            lerpFactor
          );
          peerConnection.rig.inputs.rightGamepad.quaternion.copy(peerConnection.rig.starts.gamepads[1].rotation).slerp(peerConnection.rig.targets.gamepads[1].rotation, lerpFactor);
          peerConnection.rig.inputs.rightGamepad.pointer = peerConnection.rig.starts.gamepads[1].pointer * (1-lerpFactor) + peerConnection.rig.targets.gamepads[1].pointer * lerpFactor;
          peerConnection.rig.inputs.rightGamepad.grip = peerConnection.rig.starts.gamepads[1].grip * (1-lerpFactor) + peerConnection.rig.targets.gamepads[1].grip * lerpFactor;

          _update.apply(this, arguments);
        })(peerConnection.rig.update);
      }
    } else {
      console.warn('invalid method', {method});
    }
  });
}