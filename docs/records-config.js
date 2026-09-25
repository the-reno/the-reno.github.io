'use strict';
// Public service address only. No administrator credential is stored here.
window.RONU_RECORDS = Object.freeze({
  enabled: true,
  origin: "https://ronu-records.rafatreno.workers.dev",
  feedback: {
    enabled: true,
    endpoint: "https://ronu-records.rafatreno.workers.dev/api/feedback"
  }
});
