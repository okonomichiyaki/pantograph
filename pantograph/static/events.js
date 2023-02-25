export class StatusEvent {
  constructor(key, name, description, emoji='', toast=false) {
    this.key = key;
    this.name = name;
    this.description = description;
    this.emoji = emoji;
    this.toast = toast;
  }
  toString() {
    const json = JSON.stringify(this.description);
    return [this.key, this.name, json].join(':');
  }
}
