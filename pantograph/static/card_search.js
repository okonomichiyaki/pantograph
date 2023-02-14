export function handleClick(event) {
    // crop a 300x300 square from the video feed around the mouse click:

    const x = event.offsetX;
    const y = event.offsetY;
    const w = 300;
    const h = 300;

    const target = event.target;
    const {w: targetw, h: targeth} = getComputedDims(target);

    console.log(`click: ${event.target} ${x},${y}`);
    console.log(`target: (computed) ${targetw}x${targeth}, (video) ${target.videoWidth}x${target.videoHeight}`);

    // scale the x,y to match the element coords with video coords:
    const calcx = (x / targetw) * target.videoWidth;
    const calcy = (y / targeth) * target.videoHeight;
    const rx = calcx - w / 2;
    const ry = calcy - h / 2;

    console.log(`rect: ${rx},${ry},${w},${h}`);

    const imageData = cropFromVideo(target, rx, ry, w, h);
    const crop = document.getElementById('crop');
    const cropctx = crop.getContext("2d");
    cropctx.rect(0, 0, w, h);
    cropctx.fillStyle = 'white';
    cropctx.fill();
    cropctx.putImageData(imageData, 0, 0);

    // POST to server:
    const data = crop.toDataURL();
    const json = {'image': data};
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(json)
    };
    fetch('/recognize', options)
        .then(response => response.json())
        .then(response => {
            let container = document.getElementById('card-container');
            container.replaceChildren();
            if (response.length > 0) {
                for (const card of response) {
                    console.log(`received card(s) from server: ${card.title}`);
                }
                let card = response[0];
                // update card image:
                var img = document.createElement('img');
                var size = "large";
                img.src = "https://static.nrdbassets.com/v1/" + size + "/" + card.code + ".jpg";
                container.appendChild(img);
            } else {
                const unknown = document.createElement('div');
                //const p = document.createElement('p');
                unknown.innerHTML = "❓";
                //unknown.appendChild(p);
                unknown.id = "unknown-card";
                container.appendChild(unknown);
            }
        })
        .catch(err => console.error(err));
};
