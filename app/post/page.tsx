"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PayPalCheckoutButtons from "../components/PayPalCheckoutButtons";
import DescriptionEditor from "../components/DescriptionEditor";
import MoneyInput from "../components/MoneyInput";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { MAX_PHOTOS } from "@/lib/data/categories";
import { downscaleImage } from "@/lib/resize-image";

const PARISHES = [
  "Kingston","St. Andrew","St. Catherine","Clarendon","Manchester","St. Elizabeth",
  "Westmoreland","Hanover","St. James","Trelawny","St. Ann","St. Mary","Portland","St. Thomas",
];

const CATEGORIES: Record<string, string[]> = {
  "Electronics & Appliances": ["Phones & Tablets","TVs & Audio","Computers & Laptops","Home Appliances","Generators & Inverters","Solar Equipment"],
  "Vehicles & Parts": ["Cars","Motorcycles & Scooters","Trucks, Vans & Buses","Auto Parts & Tyres","Boats & Marine"],
  "Property & Rentals": ["Houses for Rent","Apartments for Rent","Rooms for Rent","Houses for Sale","Land & Lots","Commercial Space","Vacation Rentals"],
  "Furniture & Home": ["Living Room","Bedroom","Kitchenware & Appliances","Office Furniture","Home Décor","Garden & Outdoor"],
  "Fashion & Beauty": ["Clothing","Shoes","Jewelry & Accessories","Hair & Wigs","Beauty Products"],
  "Agriculture & Farming": ["Livestock (Goats, Cows, Pigs)","Poultry","Crops & Ground Provisions","Farm Equipment & Tools","Pets & Pet Supplies"],
  "Baby & Kids": ["Baby Gear","Toys & Games","Kids Clothing","School Supplies & Uniforms"],
  "Sports, Music & Hobbies": ["Sound Systems & Instruments","Sporting Goods","Bicycles","Collectibles & Books"],
  "Tools & Building Materials": ["Hand & Power Tools","Building Materials (Zinc, Cement, Lumber)","Plumbing & Electrical Supplies","Paint & Hardware"],
  Other: ["Miscellaneous"],
};

type Step = "email" | "code" | "phone" | "details" | "plan" | "pay" | "done";

export default function PostAdPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [parish, setParish] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [offerDays, setOfferDays] = useState("");

  const [plan, setPlan] = useState<"free" | "unlimited">("free");
  const [featured, setFeatured] = useState(false);
  const [listingId, setListingId] = useState<string | null>(null);
  const [freeAdDays, setFreeAdDays] = useState<number | null>(null);

  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { setFreeAdDays(d.freeAdDays); setGoogleEnabled(!!d.googleSignInEnabled); })
      .catch(() => {});
  }, []);

  // Already-logged-in users skip email verification entirely.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.user) return;
        setEmail(data.user.email);
        if (data.user.phone) {
          setPhone(data.user.phone);
          setStep("details");
        } else {
          setStep("phone");
        }
      } catch {
        // Not logged in or network issue — fall back to the email step.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function sendCode() {
    setError("");
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { setError("Could not send code"); return; }
      setStep("code");
    } catch {
      setError("Network issue while sending code. Check your connection and try again.");
    }
  }

  async function verifyCode() {
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid code"); return; }
      setStep("phone");
    } catch {
      setError("Network issue while verifying code. Check your connection and try again.");
    }
  }

  async function confirmPhone(skip = false) {
    setError("");
    if (!skip) {
      if (!phone) { setError("Enter a phone number, or skip for now"); return; }
      try {
        const res = await fetch("/api/me/phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (!res.ok) { setError("Could not save phone number"); return; }
      } catch {
        setError("Network issue while saving phone number. Check your connection and try again.");
        return;
      }
    }
    setStep("details");
  }

  async function uploadFile(file: File, type: "photo" | "video") {
    try {
      if (type === "photo") file = await downscaleImage(file);
      const ext = file.name.split(".").pop() || "bin";
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, ext, sizeBytes: file.size, type }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error || "Could not prepare file upload");

      let uploadRes: Response;
      try {
        uploadRes = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file
        });
      } catch {
        throw new Error(`Network error while uploading ${type}. Please try again.`);
      }

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload ${type}: HTTP ${uploadRes.status}`);
      }

      return { type, url: presign.publicUrl, sizeBytes: file.size };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(`Could not upload ${type}`);
    }
  }

  function confirmDetails() {
    setError("");
    if (!title || !parish || !category || !subcategory) {
      setError("Fill in title, parish, category, and subcategory");
      return;
    }
    if (title.trim().length < 3) {
      setError("Title must be at least 3 characters");
      return;
    }
    if (!description.trim()) {
      setError("Please add a description");
      return;
    }
    if (price && (!Number(price) || Number(price) < 1)) {
      setError("Asking price must be a positive amount, or leave it blank for offers-only");
      return;
    }
    if (photoFiles.length > MAX_PHOTOS) {
      setError(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setStep("plan");
  }

  // Creates the listing in its free/unfeatured form, then either finishes
  // (no payment needed) or moves to the PayPal step to upgrade it.
  async function createListingThenContinue() {
    setError("");
    setBusy(true);
    try {
      const media = [];
      for (const photo of photoFiles) {
        media.push(await uploadFile(photo, "photo"));
      }
      if (videoFile) media.push(await uploadFile(videoFile, "video"));

      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, instagramUrl: instagramUrl || undefined,
          parish, category, subcategory,
          askingPrice: price ? Number(price) : undefined,
          offerDays: offerDays ? Number(offerDays) : undefined,
          plan: "free", featured: false,
          mediaUrls: media,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not publish ad");

      setListingId(data.listing.id);
      setStep(plan === "unlimited" || featured ? "pay" : "done");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      if (message.toLowerCase().includes("network")) {
        setError("Network issue while publishing. Please try again.");
        return;
      }
      if (message.toLowerCase().includes("failed to fetch")) {
        setError("Could not reach the server while publishing. Please try again.");
        return;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function createPaypalOrder(): Promise<string> {
    const res = await fetch("/api/payments/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "paypal", unlimited: plan === "unlimited", featured, listingId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not start checkout");
    return data.orderId;
  }

  async function onPaypalApproved(orderId: string) {
    const res = await fetch("/api/payments/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, listingId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Payment did not complete");
    setStep("done");
  }

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1>Post an ad</h1>
      {error && <p className="error">{error}</p>}

      {step === "email" && checkingSession && (
        <div className="panel">
          <p className="note">Checking your account…</p>
        </div>
      )}

      {step === "email" && !checkingSession && (
        <div className="panel">
          {googleEnabled && (
            <>
              <GoogleSignInButton next="/post" />
              <div className="auth-divider">or continue with email</div>
            </>
          )}
          <div className="demo-note">We'll email you a one-time code to verify your account — no phone or SMS needed to sign up.</div>
          <div className="field">
            <label>Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          <button onClick={sendCode}>Send verification code</button>
        </div>
      )}

      {step === "code" && (
        <div className="panel">
          <div className="field">
            <label>Enter the 6-digit code we emailed you</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          </div>
          <button onClick={verifyCode}>Verify &amp; continue</button>
        </div>
      )}

      {step === "phone" && (
        <div className="panel">
          <div className="demo-note">
            Buyers will see this number to contact you directly. We don't verify it by SMS — just make sure it's correct.
          </div>
          <div className="field">
            <label>Phone number (optional, recommended)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 876 555 0100" />
          </div>
          <div className="btn-row">
            <button onClick={() => confirmPhone(false)}>Save &amp; continue</button>
            <button className="secondary" onClick={() => confirmPhone(true)}>Skip for now</button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="panel">
          <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field">
            <label>Asking price (J$, optional)</label>
            <MoneyInput value={price} onChange={setPrice} placeholder="Leave blank to just take offers" />
            <p className="note" style={{ margin: 0 }}>
              Buyers make offers either way — payment is arranged directly between you and the buyer, not through the site.
            </p>
          </div>
          <div className="field">
            <label>Parish</label>
            <select value={parish} onChange={(e) => setParish(e.target.value)}>
              <option value="">Select parish</option>
              {PARISHES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}>
              <option value="">Select category</option>
              {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {category && (
            <div className="field">
              <label>Subcategory</label>
              <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                <option value="">Select subcategory</option>
                {CATEGORIES[category].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Description</label>
            <DescriptionEditor value={description} onChange={setDescription} />
          </div>
          <div className="field"><label>Instagram or website (optional)</label><input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} /></div>
          <div className="field">
            <label>Photos (up to {MAX_PHOTOS})</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
                setPhotoFiles(files);
              }}
            />
            {photoFiles.length > 0 && (
              <p className="note">{photoFiles.length} photo{photoFiles.length === 1 ? "" : "s"} selected</p>
            )}
          </div>
          <div className="field"><label>Video (max 500MB)</label><input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} /></div>

          <div className="field">
            <label>Accept offers for</label>
            <select value={offerDays} onChange={(e) => setOfferDays(e.target.value)}>
              <option value="">As long as the ad is live</option>
              <option value="1">1 day</option><option value="3">3 days</option><option value="5">5 days</option><option value="7">7 days</option>
            </select>
          </div>
          <button onClick={confirmDetails}>Continue to ad plan</button>
        </div>
      )}

      {step === "plan" && (
        <div className="panel">
          <div className={`plan-option ${plan === "free" ? "sel" : ""}`} onClick={() => setPlan("free")}>
            <b>Free — {freeAdDays ?? 30} days</b><div className="note">Standard placement, expires automatically.</div>
          </div>
          <div className={`plan-option ${plan === "unlimited" ? "sel" : ""}`} onClick={() => setPlan("unlimited")}>
            <b>Unlimited duration</b><div className="note">Stays live until you remove it.</div>
          </div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} style={{ width: "auto" }} />
            <label style={{ margin: 0 }}>Feature at the top of the board</label>
          </div>
          <button disabled={busy} onClick={createListingThenContinue}>
            {busy ? "Publishing…" : plan === "unlimited" || featured ? "Continue to payment" : "Publish"}
          </button>
        </div>
      )}

      {step === "pay" && listingId && (
        <div className="panel">
          <p>Pay to activate {plan === "unlimited" ? "unlimited duration" : ""}{plan === "unlimited" && featured ? " + " : ""}{featured ? "featured placement" : ""}.</p>
          <div className="demo-note">
            PayPal settles in USD — your J$ fee is converted automatically at checkout.
          </div>
          <PayPalCheckoutButtons
            createOrder={createPaypalOrder}
            onApproved={onPaypalApproved}
            onError={(msg) => setError(msg)}
          />
          <p className="note" style={{ marginTop: 10 }}>
            Lynk checkout isn't available yet — see lib/payments/lynk.ts.
          </p>
        </div>
      )}

      {step === "done" && (
        <div className="panel">
          <h3>Published 🎉</h3>
          <p>Your ad is live.</p>
          <button onClick={() => router.push(`/listing/${listingId}`)}>View ad</button>
        </div>
      )}
    </div>
  );
}
