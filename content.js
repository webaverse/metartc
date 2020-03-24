let ids = 0;
const callbacks = {};
window.xrchrome = {
  async request(method, args) {
    const id = ++ids;

    postMessage({
      _xrcreq: true,
      method,
      args,
      id,
    }, '*', []);

    let accept, reject;
    const p = new Promise((a, r) => {
      accept = a;
      reject = r;
    });
    callbacks[id] = (error, result) => {
      if (!error) {
        accept(result);
      } else {
        reject(error);
      }
    };
    return await p;
  }
};
window.addEventListener('message', m => {
  if (m.data && m.data._xrcres) {
    const {id, error, result} = m.data;
    const cb = callbacks[id];
    if (cb) {
      cb(error, result);
      delete callbacks[id];
    }
  } else if (m.data && m.data._xrcevent) {
    const {event, data} = m.data;
    window.dispatchEvent(new MessageEvent(event, {data}));
  }
});

/* window.xrchrome.request('test', [])
  .then(res => {
    console.log(res);
  }); */