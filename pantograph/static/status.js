
export function updateMembers(members) {
    const corp = members.find(m => m.side === 'corp');
    const runner = members.find(m => m.side === 'runner');
    const runnerNick = runner ? runner.nickname : '?';
    const corpNick = corp ? corp.nickname : '?';

    const spectators = members.filter(m => m.side === 'spectator').map(m => m.nickname);
    const matchText = `${runnerNick} (runner) vs. ${corpNick} (corp)`;
    const spectatorText = spectators.length > 0 ? `[${spectators.length} spectators: ${spectators.join(', ')}]` : '';
    document.getElementById('game-info').innerText = matchText + ' ' + spectatorText;
}
