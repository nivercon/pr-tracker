import { MessageTypes } from "./workers/workers.ts";

const kv = await Deno.openKv("https://api.deno.com/databases/4d993b9d-048f-487e-a3b9-f313c1c87210/connect");
await kv.enqueue({ type: MessageTypes.FETCH_PRS, userId: "jhonatacaiob" });
await kv.close();
