export function calibrate(canvas, width, height) {
  return new Promise((resolve) => {
    let down = false;
    let startX = 0;
    let startY = 0;

    const ctx = canvas.getContext('2d');
    ctx.canvas.width = width;
    ctx.canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.display = 'block';

    function onMouseMove(e) {
      const offsetX = e.offsetX;
      const offsetY = e.offsetY;
      if (down) {
        const w = Math.abs(startX - offsetX);
        const h = Math.abs(startY - offsetY);
        const x = Math.min(startX, offsetX);
        const y = Math.min(startY, offsetY);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'deeppink';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }
    }

    function onMouseDown(e) {
      down = true;
      startX = e.offsetX;
      startY = e.offsetY;
    }

    function onMouseUp(e) {
      down = false;
      const offsetX = e.offsetX;
      const offsetY = e.offsetY;
      const pxw = Math.abs(startX - offsetX);
      const pxh = Math.abs(startY - offsetY);
      const ratiow = pxw / width;
      const ratioh = pxh / height;

      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);

      resolve( {pixel: {w: pxw, h: pxh}, ratio: {w: ratiow, h: ratioh}} );
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
  });
}
