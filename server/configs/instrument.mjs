import * as Sentry from "@sentry/node"

Sentry.init({
  dsn: "https://5a3d711d4b0aef547474f48a0fc35984@o4510935007494144.ingest.us.sentry.io/4510935023550464",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});