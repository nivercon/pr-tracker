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
  const fetchPrs = fetchPrsWorker(kv);
  const updateToken = updateTokensWorker(kv);

  await kv.listenQueue(async (msg) => {
    await fetchPrs(msg);
    await updateToken(msg);
  });
}
