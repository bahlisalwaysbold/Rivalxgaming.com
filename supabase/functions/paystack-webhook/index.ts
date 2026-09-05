// Supabase Edge Function: verifies Paystack webhooks server-side and
// marks an entry as paid. This is the ONLY thing allowed to do that —
// the browser can never mark itself as paid, which is what makes this
// scam-proof on both sides.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy paystack-webhook
//
// Then set two secrets (never put these in your frontend code):
//   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxx
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
//
// Finally, in your Paystack dashboard → Settings → API Keys & Webhooks,
// set the Webhook URL to:
//   https://<your-project-ref>.supabase.co/functions/v1/paystack-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// service_role bypasses Row Level Security — that's intentional and
// safe here, because this code only ever runs on Supabase's servers,
// never in the browser, and the secret key never leaves this function.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function verifySignature(rawBody: string, signature: string | null) {
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return computed === signature;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  // Reject anything not genuinely signed by Paystack — this is what
  // stops someone from faking a "payment successful" call directly.
  const valid = await verifySignature(rawBody, signature);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const reference = event.data.reference;

    const { error } = await supabase
      .from("entries")
      .update({ payment_status: "paid" })
      .eq("paystack_ref", reference)
      .eq("payment_status", "pending"); // don't re-process an already-paid entry

    if (error) {
      console.error("Failed to mark entry as paid:", error.message);
      return new Response("Database error", { status: 500 });
    }
  }

  // Always respond 200 quickly so Paystack doesn't keep retrying.
  return new Response("ok", { status: 200 });
});
