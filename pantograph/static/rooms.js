
export async function getRoom(roomId) {
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  };
  return fetch(`/room/${roomId}`, options)
      .then((response) => response.json())
      .catch((err) => console.error(err));
}
