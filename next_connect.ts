import { nextJsApiRouter } from "@connectrpc/connect-next";
import routes from "../../connect";

import type { NextApiHandler, PageConfig } from "next";

const api = nextJsApiRouter({ routes });

export default api.handler as NextApiHandler;
export const config: PageConfig = api.config;