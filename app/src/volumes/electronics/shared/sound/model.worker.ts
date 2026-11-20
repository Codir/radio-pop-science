/// <reference lib="webworker" />
import { createHandler } from './handler';
import type { ToWorker } from './protocol';
declare const self: DedicatedWorkerGlobalScope;
const handler = createHandler(() => performance.now());
self.onmessage = (e: MessageEvent<ToWorker>) => {
  const out = handler.handle(e.data);
  if (out) self.postMessage(out.reply, { transfer: out.transfer });
};
