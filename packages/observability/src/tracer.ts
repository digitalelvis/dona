import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { context, trace } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";

let provider: BasicTracerProvider | undefined;

/** Registers a minimal tracer provider for local / test; Lambda relies on the ADOT layer. */
export function initTracerIfLocal(serviceName: string): void {
  if (process.env.LAMBDA_TASK_ROOT !== undefined) return;
  if (provider !== undefined) return;
  context.setGlobalContextManager(new AsyncLocalStorageContextManager());
  const resource = Resource.default().merge(
    new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
  );
  provider = new BasicTracerProvider({ resource });
  provider.register();
}

/**
 * Active span trace id in X-Ray form `1-<8 hex>-<24 hex>`, or `undefined` if none.
 */
export function getTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span === undefined) return undefined;
  const { traceId } = span.spanContext();
  if (traceId === undefined || traceId === "") return undefined;
  if (traceId.length !== 32) return undefined;
  return `1-${traceId.slice(0, 8)}-${traceId.slice(8)}`;
}
