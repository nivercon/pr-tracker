import { fetchPrsWorker } from "./fetch_prs.ts";
import { updateTokensWorker } from "./update_token.ts";
export const enum MessageTypes {
  FETCH_PRS = 1,
  UPDATE_TOKEN = 2,
}

export type Message = {
  type: MessageTypes;
  userId: string;
  nextTask?: MessageTypes;
};

export async function registerWorkers(kv: Deno.Kv) {
  await kv.listenQueue(fetchPrsWorker(kv));
  await kv.listenQueue(updateTokensWorker(kv));
}
