'use strict';

/**
 * Creates a client to talk to a server
 * @param {string} target the url where the server is
 * @param {Window} targetWindow the window where the server is. if null, an iframe will be created
 * @param {Object.<Function>} methods A dictionary of methods that can be run from the server
 * @returns {promise|*|Q.promise} a promise that will be resolved with the send(method, params) function
 * when the client has connected to the server
 */
export default function client(target, targetWindow, methods) {
  let count = 0,
      getTargetWindow;

  const targetOrigin = target.match(/(.+\/\/[^\/]+)\/?/)[1];
  const promises = [];
  const send = (method, ...args) => {
    const id = count++;

    return new Promise((resolve, reject) => {
      promises[id] = {
        resolve,
        reject
      };
      getTargetWindow()
        .postMessage(JSON.stringify({
          id,
          args,
          postmessageClientServerMethod: method
        }), targetOrigin);
    });
  };

  if (targetWindow) {
    getTargetWindow = () => targetWindow;
  } else {
    const iframe = document.createElement('iframe');

    iframe.src = target;
    iframe.style.cssText = 'position:absolute;left:-2px;top:-2px;width:1px;height:1px;';
    getTargetWindow = () => iframe.contentWindow;
    document.body.appendChild(iframe);
  }

  return new Promise((resolve) => {
    window.addEventListener('message', (event) => {
      if (event.source !== getTargetWindow() || event.origin !== targetOrigin) {
        return;
      }

      let data;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        // Unable to parse message from server
        return;
      }

      if (data.__postmessage) {
        if (data.postmessageClientServerInit) {
          // initialized handshake, return send function
          resolve(send);
        } else {
          const callPromise = promises[data.id];

          if (callPromise) {
            delete promises[data.id];

            if (data.error) {
              callPromise.reject(data.error);
            } else {
              callPromise.resolve(data.result);
            }
          } else if (methods.hasOwnProperty(data.method)) {
            methods[data.method](data.result);
          } else {
            throw new Error('Cannot find call promise for id ' + data.id);
          }
        }
      }
    });
  });
}
