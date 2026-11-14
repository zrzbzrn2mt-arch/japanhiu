'use strict';
// Client-side slip resize so phone photos fit under the ~3.5 MB server/Vercel limit.
(function () {
  var MAX_EDGE = 1600;
  var MAX_BYTES = Math.floor(3.5 * 1024 * 1024);
  var QUALITY = 0.85;

  function hintFor(input, text) {
    var parent = input.parentElement;
    var el = parent && parent.querySelector('.slip-hint');
    if (!el) {
      el = document.createElement('div');
      el.className = 'slip-hint small';
      input.insertAdjacentElement('afterend', el);
    }
    el.textContent = text || '';
  }

  async function resizeImage(file) {
    var bmp = await createImageBitmap(file);
    try {
      var scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
      var w = Math.max(1, Math.round(bmp.width * scale));
      var h = Math.max(1, Math.round(bmp.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(bmp, 0, 0, w, h);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', QUALITY); });
      return blob;
    } finally {
      if (bmp.close) bmp.close();
    }
  }

  async function onChange(ev) {
    var input = ev.target;
    var file = input.files && input.files[0];
    if (!file) { hintFor(input, ''); return; }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > MAX_BYTES) {
        hintFor(input, 'ไฟล์ PDF ใหญ่เกิน 3.5 MB กรุณาเลือกไฟล์ที่เล็กกว่า');
        input.value = '';
      } else {
        hintFor(input, '');
      }
      return;
    }
    if (!/^image\//.test(file.type)) return;
    try {
      var blob = await resizeImage(file);
      if (!blob) throw new Error('toBlob failed');
      if (blob.size > MAX_BYTES) {
        hintFor(input, 'รูปยังใหญ่เกิน 3.5 MB แม้ย่อแล้ว กรุณาเลือกภาพอื่น');
        input.value = '';
        return;
      }
      var dt = new DataTransfer();
      var name = (file.name.replace(/\.[^.]+$/, '') || 'slip') + '.jpg';
      dt.items.add(new File([blob], name, { type: 'image/jpeg' }));
      input.files = dt.files;
      var from = (file.size / 1024 / 1024).toFixed(2);
      var to = (blob.size / 1024 / 1024).toFixed(2);
      hintFor(input, file.size > blob.size ? ('ย่อรูปแล้ว (' + from + ' MB → ' + to + ' MB)') : ('ขนาดไฟล์ ' + to + ' MB'));
    } catch (e) {
      if (file.size > MAX_BYTES) {
        hintFor(input, 'ไม่สามารถย่อรูปนี้ได้ และไฟล์ใหญ่เกิน 3.5 MB กรุณาบันทึกเป็น JPEG หรือเลือกภาพที่เล็กกว่า');
        input.value = '';
      } else {
        hintFor(input, '');
      }
    }
  }

  function bind(el) {
    if (el.dataset.slipBound) return;
    el.dataset.slipBound = '1';
    el.addEventListener('change', onChange);
  }

  function scan() {
    document.querySelectorAll('input[type="file"][name="slip"]').forEach(bind);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
