import { createPaypalOrder } from "./paypal";
import { createLynkOrder } from "./lynk";

export type Provider = "paypal" | "lynk";

export async function createOrder(
  provider: Provider,
  amountJmd: number,
  description: string
) {
  if (provider === "paypal") return createPaypalOrder(amountJmd, description);
  if (provider === "lynk") return createLynkOrder(amountJmd, description);
  throw new Error(`Unknown payment provider: ${provider}`);
}
