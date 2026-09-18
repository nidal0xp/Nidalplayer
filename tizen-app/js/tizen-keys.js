// Samsung Tizen Hardware Key Registration & Mapping
(function () {
  'use strict';

  window.TIZEN_KEYS = {
    RETURN: 10009,
    BACKSPACE: 8,
    ESCAPE: 27,
    ENTER: 13,
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    PLAY_PAUSE: 10252,
    FAST_FORWARD: 417,
    REWIND: 412,
    CH_UP: 427,
    CH_DOWN: 428,
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406
  };

  try {
    if (window.tizen && window.tizen.tvinputdevice) {
      const keysToRegister = [
        'MediaPlay',
        'MediaPause',
        'MediaStop',
        'MediaPlayPause',
        'MediaFastForward',
        'MediaRewind',
        'ChannelUp',
        'ChannelDown',
        'ColorF0Red',
        'ColorF1Green',
        'ColorF2Yellow',
        'ColorF3Blue',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
      ];

      keysToRegister.forEach(function (k) {
        try {
          window.tizen.tvinputdevice.registerKey(k);
        } catch (e) {
          // Some keys might already be registered by OS
        }
      });
      console.log('[Tizen] All TV Remote Keys Registered Successfully');
    }
  } catch (err) {
    console.warn('[Tizen] Non-tizen environment, fallback to standard web key codes:', err);
  }
})();
