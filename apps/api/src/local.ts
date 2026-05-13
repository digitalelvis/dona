import { serve } from "@hono/node-server";

import { compose } from "./compose.js";

const port = (() => {
  const raw = process.env.PORT;
  if (raw === undefined || raw === "") return 3000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3000;
})();

const { app } = compose();

serve({ fetch: app.fetch, port }, ({ port: bound }) => {
  console.log(JSON.stringify({ msg: "api listening", port: bound }));
});
