import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getGoogleOAuth } from "@/lib/env";

// Public, read-only marketplace settings used for display (e.g. how long a
// free ad stays live). Admin editing happens via /api/admin/settings.
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    freeAdDays: settings.freeAdDays,
    topAdPriceJmd: settings.topAdPriceJmd,
    topAdDays: settings.topAdDays,
    vipAdPriceJmd: settings.vipAdPriceJmd,
    vipAdDays: settings.vipAdDays,
    signupsEnabled: settings.signupsEnabled,
    googleSignInEnabled: getGoogleOAuth() !== null,
  });
}
