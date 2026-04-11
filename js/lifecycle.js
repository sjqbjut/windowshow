(function () {
  var tokenParamName = 'windowshowToken';
  var params;

  try {
    params = new URLSearchParams(window.location.search || '');
  } catch (error) {
    return;
  }

  var token = params.get(tokenParamName);
  if (!token) return;

  var pingUrl = '/__windowshow__/ping?' + tokenParamName + '=' + encodeURIComponent(token);
  var closeUrl = '/__windowshow__/close?' + tokenParamName + '=' + encodeURIComponent(token);
  var heartbeatIntervalMs = 4000;
  var heartbeatTimer = null;
  var closed = false;

  function send(url, preferBeacon) {
    if (preferBeacon && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(url, '');
        return;
      } catch (error) {
        // Fall back to fetch.
      }
    }

    if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        keepalive: true,
      }).catch(function () {
        // Ignore network errors during close/unload.
      });
    }
  }

  function ping() {
    if (closed) return;
    send(pingUrl, false);
  }

  function closeServer() {
    if (closed) return;
    closed = true;

    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    send(closeUrl, true);
  }

  ping();
  heartbeatTimer = window.setInterval(ping, heartbeatIntervalMs);

  window.addEventListener('beforeunload', closeServer);
  window.addEventListener('pagehide', closeServer);
})();
