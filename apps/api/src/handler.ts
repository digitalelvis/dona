import { handle } from "hono/aws-lambda";

import { compose } from "./compose.js";

const { app } = compose();
export const handler = handle(app);
