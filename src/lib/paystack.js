// 1. Create a Paystack account at https://paystack.com and complete
//    the business verification (needed before you can receive live payouts).
// 2. Settings → API Keys & Webhooks → copy your Public Key.
// 3. Add it to `.env.local`:
//      VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxx
// 4. Add the Paystack inline script to index.html before shipping:
//      <script src="https://js.paystack.co/v1/inline.js"></script>
// 5. Set up a webhook (server-side, e.g. a Supabase Edge Function) pointed
//    at Paystack's webhook URL to confirm payment before marking a player
//    as "entered" — never trust the client-side callback alone for that.

// A unique reference tying together: the pending `entries` row, the
// Paystack checkout, and the webhook that later confirms payment.
// Generated client-side but the payment itself can never be faked
// client-side — only Paystack's signed webhook can mark it "paid".
export function generatePaystackRef() {
  return `rx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function payTournamentEntry({ email, amountNaira, reference, onSuccess, onClose }) {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!publicKey || typeof window === "undefined" || !window.PaystackPop) {
    alert(
      "Paystack isn't configured yet. Add VITE_PAYSTACK_PUBLIC_KEY to .env.local and the Paystack <script> tag to index.html."
    );
    return;
  }

  const handler = window.PaystackPop.setup({
    key: publicKey,
    email,
    amount: amountNaira * 100, // Paystack expects the amount in kobo
    currency: "NGN",
    ref: reference,
    callback: (response) => onSuccess?.(response),
    onClose: () => onClose?.(),
  });

  handler.openIframe();
}
