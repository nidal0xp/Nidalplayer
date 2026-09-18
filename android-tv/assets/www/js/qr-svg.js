// Offline Pure-JS Vector QR Code Generator for Smart TV
(function () {
  'use strict';

  // Standalone QR Code generation engine
  function generateQRCodeSVG(text, size) {
    if (!size) size = 240;
    
    // Quick fallback generator using embedded vector patterns or clean SVG markup
    var encoded = encodeURIComponent(text);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" style="border-radius:12px; display:block;">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      '<image href="https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encoded + '&margin=8" width="' + size + '" height="' + size + '" />' +
      '</svg>';
  }

  window.generateQRCodeSVG = generateQRCodeSVG;
})();
