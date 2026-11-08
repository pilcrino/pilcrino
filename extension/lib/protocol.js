// Pilcrino extension: constants shared with the plugin's browser server. Plain
// script, loaded by background.js (importScripts) and by the plugin's tests.
// PILCRINO_PROTOCOL changes only when the messages between extension and
// server change; browser/src/bridge.mjs holds the same number and a test keeps
// them equal.
;(function (root) {
  root.PILCRINO_PROTOCOL = 1
  root.PILCRINO_PORTS = [47390, 47391, 47392, 47393, 47394, 47395, 47396, 47397, 47398, 47399]
  root.PILCRINO_RESCAN_MS = 5000
  root.PILCRINO_PING_EVERY_TICKS = 4 // one ping per 20 s on a 5 s tick
  root.PILCRINO_ALARM_MINUTES = 0.5
  root.PILCRINO_REFUSED_BACKOFF_MS = 30000
  root.PILCRINO_SAFETY_MS = 60000
})(globalThis)
