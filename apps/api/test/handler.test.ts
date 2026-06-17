import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { describe, expect, it } from "vitest";

import { handler } from "../src/handler.js";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const handlerArtifact = join(distDir, "handler.mjs");

function minimalApiGwV2Event(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  const now = Date.now();
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/health",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "test-api",
      domainName: "test.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "test",
      http: {
        method: "GET",
        path: "/health",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "req-handler-1",
      routeKey: "$default",
      stage: "$default",
      time: new Date(now).toISOString(),
      timeEpoch: now,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

const minimalContext = {} as Context;

describe("Lambda handler", () => {
  it("GET /health returns 200 and body contains status ok", async () => {
    const result = await handler(minimalApiGwV2Event(), minimalContext);
    expect(result).toBeDefined();
    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body ?? "{}") as { status: string; traceId: string | null };
    expect(body.status).toBe("ok");
    expect(body.traceId).toBeNull();
  });
});

describe.skipIf(!existsSync(handlerArtifact))("Lambda handler build artefact", () => {
  it("dist/handler.mjs loads", async () => {
    const mod = await import(pathToFileURL(handlerArtifact).href);
    expect(typeof mod.handler).toBe("function");
  });

  it("GET /health via dist/handler.mjs", async () => {
    const { handler: builtHandler } = await import(pathToFileURL(handlerArtifact).href);
    const result = await builtHandler(minimalApiGwV2Event(), minimalContext);
    expect(result?.statusCode).toBe(200);
  });
});
