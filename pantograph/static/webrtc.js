window.addEventListener("load", (event) => {
    (async () => {
        // request extra large constraints initially enables later access to higher res feed?
        // https://stackoverflow.com/questions/61130224/getusermedia-on-chrome-frequently-does-not-return-the-best-resolution
        await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {width:4096,height:2160}
        });
        let devices = await navigator.mediaDevices.enumerateDevices();
        var deviceSelect = document.getElementById('video-device');
        if (devices.length > 0) {
            deviceSelect.remove(0);
        }
        for (var i = 0; i < devices.length; i++) {
            var device = devices[i];
            if (device.kind === "videoinput") {
                console.log(device.label);
                deviceSelect.options.add(new Option(device.label, device.deviceId));
            }
        }
        if (devices.length > 0) {
            document.getElementById('start').style.display = 'inline-block';
        }
    })();

    window.start = function() {
        let video = document.getElementById('video');
        var device = document.getElementById('video-device').value;
        var constraints = {};
        if (device !== 'loading') {
            constraints.video = { // is having both device ID and width/height meaningful?
                deviceId: device,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            };
        }

        navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
            video.srcObject = stream;
            video.play();
            document.getElementById('media').style.display = 'block';
        }, function(err) {
            alert('Could not acquire media: ' + err);
        });
        document.getElementById('stop').style.display = 'inline-block';

        video.addEventListener('mousedown', (event) => {
            let x = event.offsetX;
            let y = event.offsetY;
            //console.log(`mousedown: ${x},${y}`);
        });
        video.addEventListener('mouseup', (event) => {
            let x = event.offsetX;
            let y = event.offsetY;
            //console.log(`mouseup: ${x},${y}`);
        });
        video.addEventListener('click', (event) => {
            let x = event.offsetX;
            let y = event.offsetY;
            const w = 300;
            const h = 300;
            //console.log(`click: ${x},${y}`);

            // crop the video feed:
            let output = document.getElementById('output');
            let ctx = output.getContext('2d');
            output.getContext('2d').drawImage(video, 0, 0, output.width, output.height);
            let imageData = ctx.getImageData(x - w / 2, y - h / 2, w, h);
            let crop = document.createElement("canvas");
            crop.width = w;
            crop.height = h;
            let cropctx = crop.getContext("2d");
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
                        // update card image:
                        var img = document.createElement('img');
                        var size = "large";
                        img.src = "https://static.nrdbassets.com/v1/" + size + "/" + response["code"] + ".jpg";
                        container.appendChild(img);
                    } else {
                        let unknown = document.createElement('p');
                        unknown.innerHTML = "?";
                        container.appendChild(unknown);
                    }
                })
                .catch(err => console.error(err));
        });
    };

    window.stop = function() {
        // TODO
    };

});
