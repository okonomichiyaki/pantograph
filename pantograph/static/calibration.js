export function calibrate(canvas, width, height) {
    return new Promise(resolve => {
        let down = false;
        let startX = 0;
        let startY = 0;

        let ctx = canvas.getContext('2d');
        ctx.canvas.width = width;
        ctx.canvas.height = height;

        function onMouseMove(e) {
            const offsetX = e.offsetX;
            const offsetY = e.offsetY;
            if (down) {
                let w = Math.abs(startX - offsetX);
                let h = Math.abs(startY - offsetY);
                let x = Math.min(startX, offsetX);
                let y = Math.min(startY, offsetY);
                console.log('mousemove drawing');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = "deeppink";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);
            }
        }

        function onMouseDown(e) {
            console.log('mousedown');
            down = true;
            startX = e.offsetX;
            startY = e.offsetY;
        }

        function onMouseUp(e) {
            console.log('mouseup');
            down = false;
            const offsetX = e.offsetX;
            const offsetY = e.offsetY;
            let pxw = Math.abs(startX - offsetX);
            let pxh = Math.abs(startY - offsetY);
            let ratiow = pxw / width;
            let ratioh = pxh / height;
            resolve( {pixel: {w: pxw, h: pxh}, ratio: {w: ratiow, h: ratioh}} );
        }

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mouseup', onMouseUp);
    });
}
