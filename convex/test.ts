import { action } from "./_generated/server";

export const ping = action({
  handler: async () => {
    console.log("🔥 TEST ACTION WORKING");
  },
});
