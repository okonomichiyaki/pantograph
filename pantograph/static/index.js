import { prepareModal } from './modals.js';
import { calibrate } from './calibration.js';

function createNewRoom(json) {
    if (!json) {
        return;
    }
    const nickname = json['nickname'];
    const side = json["side"];
    const str = JSON.stringify(json);
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: str
    };
    fetch('/room', options)
        .then(response => response.json())
        .then(response => {
            const id = response["id"];
            console.log("created a new room: " + id);
            let path =  `/app/${id}`;
            let params = `nickname=${nickname}&side=${side}`;
            if (window.location.search.includes('mode')) {
                params = window.location.search + '&' + params;
            } else {
                params = '?' + params;
            }
            window.location.href = path + params;
        })
        .catch(err => console.error(err));
}

window.addEventListener("load", (event) => {
    prepareModal('new-room-button', 'new-room-modal', createNewRoom, ['nickname', 'format', 'side']);
});
