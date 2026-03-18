export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function pickEventType() {
  return Math.random() < 0.5 ? "BOMB" : "BONUS";
}

export function newId() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

export function genTeamCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}