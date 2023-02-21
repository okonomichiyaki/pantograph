export class Status {
  static Initial = new Status('initial', 'app starting', '🔄', true);
  static Waiting = new Status('waiting', 'waiting for opponent to join', '🔄', true);

  static Connecting = new Status('connecting', 'connecting to server', '🔄', true);
  static Connected = new Status('connected', 'connected to server', '✅', false);
  static Disconnected = new Status('disconnected', 'disconnected from server', '⚠️', true);

  static Ready = new Status('ready', 'ready to start call', '☎️', false);
  static Calling = new Status('calling', 'call in progress', '✅', false);
  static LocalVideo = new Status('local', 'local video started', '➡️', false);
  static RemoteVideo = new Status('remote', 'remote video received', '⬅️', false);
  static BothVideo = new Status('both', 'video connected', '↔️️', false);
  static NoCamera = new Status('nocamera', 'unable to find camera', '❌', false);

  static Demo = new Status('demo', 'DEMO MODE', '', false);

  constructor(name, description, emoji, busy) {
    this.name = name;
    this.description = description;
    this.emoji = emoji;
    this.busy = busy;
  }
  toString() {
    return this.name;
  }
  isBusy() {
    return this.busy;
  }
}
