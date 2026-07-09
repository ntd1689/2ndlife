import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const metadata = {
  title: "About 2ndLife — Jamaica's local marketplace",
  description:
    "2ndLife is Jamaica's local marketplace for buying and selling second-hand — post an ad for free, make offers, and deal directly with people in your parish.",
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const { freeAdDays } = await getSettings();

  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <h2 style={{ fontSize: 34 }}>About 2ndLife</h2>
      <p className="tagline" style={{ maxWidth: 640 }}>
        Give your items a second life. 2ndLife is Jamaica's local marketplace for
        buying, selling, and renting second-hand — right in your parish.
      </p>

      <div className="panel" style={{ maxWidth: "none", marginTop: 20 }}>
        <h3>Our mission</h3>
        <p>
          Every day, good things get thrown away while someone across town is
          looking for exactly that. 2ndLife exists to close that gap — to make it
          easy for Jamaicans to pass on what they no longer need and find what
          they do, close to home. Less waste, more value, and a little extra cash
          in the pocket. Second hand, second chance.
        </p>
      </div>

      <div className="panel" style={{ maxWidth: "none", marginTop: 16 }}>
        <h3>How it works</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>
            <b>Post your ad for free.</b> Snap a few photos, set an asking price
            (or leave it open to offers), and pick your parish and category. Your
            ad stays live free for the first {freeAdDays} days.
          </li>
          <li>
            <b>Buyers make offers.</b> Interested buyers send you offers right on
            the ad. You review them and accept the one you like.
          </li>
          <li>
            <b>Deal directly.</b> When you accept an offer, we share your contact
            details with that buyer so you can arrange payment and pickup between
            yourselves. 2ndLife never handles the item payment — you stay in
            control of the sale.
          </li>
        </ol>
      </div>

      <div className="panel" style={{ maxWidth: "none", marginTop: 16 }}>
        <h3>Why 2ndLife</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li><b>Built for Jamaica.</b> Browse by parish and shop local, from Kingston to Westmoreland.</li>
          <li><b>Free to start.</b> Your first {freeAdDays} days are on us — pay only if you want to keep an ad running longer or feature it.</li>
          <li><b>Offers, not haggling in the dark.</b> See every offer in one place and accept on your terms.</li>
          <li><b>Simple sign-up.</b> Verify with a one-time email code — no SMS, no hassle.</li>
          <li><b>Stand out when it matters.</b> Optional Top and VIP placements put your ad in front of more buyers.</li>
        </ul>
      </div>

      <div className="panel" style={{ maxWidth: "none", marginTop: 16 }}>
        <h3>Buy and sell with confidence</h3>
        <p>
          We want every deal to feel safe. Meet in a public place, inspect items
          before you pay, and keep conversations on the details that matter. If
          something isn't right, you can report any ad and our team will take a
          look. Because we don't process the item payment, you're never handing
          money to the site — you settle up directly with the other person.
        </p>
      </div>

      <div className="panel" style={{ maxWidth: "none", marginTop: 16 }}>
        <h3>Get in touch</h3>
        <p>
          Questions, feedback, or a partnership idea? We'd love to hear from you
          at{" "}
          <a href="mailto:sifts.ja@gmail.com" style={{ textDecoration: "underline" }}>
            sifts.ja@gmail.com
          </a>
          .
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
        <Link href="/post"><button>Post an ad</button></Link>
        <Link href="/"><button className="secondary">Browse the marketplace</button></Link>
      </div>
    </div>
  );
}
