// Session manager for kminigame (per-channel)
const sessions = new Map();

export function setSession(channelId, data) {
  clearSession(channelId);
  sessions.set(channelId, data);
}

export function getSession(channelId) {
  return sessions.get(channelId);
}

export function hasSession(channelId) {
  return sessions.has(channelId);
}

export function clearSession(channelId) {
  const session = sessions.get(channelId);
  if (session && session.timeout) clearTimeout(session.timeout);
  sessions.delete(channelId);
}
