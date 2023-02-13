export function getCookies() {
    const cookies = document.cookie.split('; ');
    const results = {};
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        let pair = cookie.split('=');
        results[pair[0]] = pair[1];
    }
    return results;
}
