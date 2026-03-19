export const PORT = process.env.PORT || 3001;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// FIX #7: Warn clearly if ADMIN_KEY is not set. The default "shd-admin" is in
// the public repo — anyone who finds it gets admin access to the live event.
// Set ADMIN_KEY in your .env before deploying.
if (!process.env.ADMIN_KEY) {
  console.warn(
    "[config] WARNING: ADMIN_KEY env var is not set. " +
    "Falling back to default — this is insecure in production. " +
    "Set ADMIN_KEY=<strong-random-string> in your .env file."
  );
}
export const ADMIN_KEY = process.env.ADMIN_KEY || "shd-admin";
export const OPERATOR_KEY = process.env.OPERATOR_KEY || "shd-operator";
export function isAdminKey(key) {
  return !!ADMIN_KEY && String(key || "") === ADMIN_KEY;
}

export function isOperatorKey(key) {
  const k = String(key || "");
  return (!!ADMIN_KEY && k === ADMIN_KEY) || (!!OPERATOR_KEY && k === OPERATOR_KEY);
}
export const DEFAULT_CFG = {
  lobbySeconds: 10,
  matchSeconds: 90,

  warnSeconds: 4,
  eventSecondsMin: 3,
  eventSecondsMax: 3,
  betweenEventSecondsMin: 8,
  betweenEventSecondsMax: 14,

  bombPenalty: 5,
  bonusGain: 2,

  mode: "SOLO",
  maxTeamSize: 5,
};

