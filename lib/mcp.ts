import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient as createMCPClient } from "ai";

import { PLATFORM_API_KEY } from "./taintedEnvVar";

// Apparently, we need a new client every time
export const getScientaMcpClient = async () => {
  const url = new URL(
    "https://platform-mcp-452652483423.europe-west4.run.app/mcp/",
  );
  return await createMCPClient({
    transport: new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${PLATFORM_API_KEY}`,
        },
      },
    }),
  });
};
