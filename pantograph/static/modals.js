function findParentModal(elt) {
    let node = elt;
    while (node.nodeName !== 'DIALOG' && node.nodeName !== 'BODY') {
        node = node.parentElement;
    }
    if (node.nodeName === 'DIALOG') {
        return node;
    } else {
        return null;
    }
}

export function closeModal(e) {
    const target = e.target;
    const parent = findParentModal(target);
    if (parent) {
        parent.removeAttribute('open');
    }
}

export function createOpenHandler(id, callback, required) {
    return async (e) => {
        const json = await showModal(id, required);
        callback(json);
    };
}

function checkForm(modal, required, json) {
    console.log(json);
    if (!required || required.length === 0) {
        return true;
    }
    let ok = true;
    for (const key of required) {
        const inputs = modal.querySelectorAll('input.' + key);
        for (const input of inputs) {
            if (json[key] && input.getAttribute('aria-invalid')) {
                input.setAttribute('aria-invalid', false);
                ok = ok && true;
            } else if (!json[key]) {
                input.setAttribute('aria-invalid', true);
                ok = false;
            }
        }
    }
    return ok;
}

export async function showModal(id, required) {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById(id);
        if (!modal) {
            console.log(`no modal with id={id}`);
            reject(null);
        }

        modal.setAttribute('open','');
        const closeButtons = modal.querySelectorAll('.close-modal');
        for (const button of closeButtons) {
            button.addEventListener('click', (e) => {
                closeModal(e);
                resolve(null);
            });
        }
        const confirm = modal.querySelector('.confirm-modal');
        if (confirm) {
            confirm.addEventListener('click', (e) => {
                const form = modal.querySelector('form');
                if (form) {
                    const name = form.name;
                    const json = Object.fromEntries(new FormData(document.forms[name]));
                    console.log('got data from form: ', json);
                    if (checkForm(modal, required, json)) {
                        modal.removeAttribute('open');
                        resolve(json);
                    }
                } else {
                    modal.removeAttribute('open');
                    resolve({});
                }
            });
        }
    });
}

export function prepareModal(buttonId, modalId, callback, required) {
    const button = document.getElementById(buttonId);
    if (!button) {
        return false;
    }
    button.addEventListener('click', createOpenHandler(modalId, callback, required));
    return true;
}
