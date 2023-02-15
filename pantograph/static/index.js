import { prepareModal } from './modals.js';

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
            window.location.href = `/app/${id}?nickname=${nickname}&side=${side}`;
        })
        .catch(err => console.error(err));
}

window.addEventListener("load", (event) => {
    prepareModal('open-new-room', 'new-room-modal', createNewRoom, ['nickname']);
});
