"use client";

type CheckoutPayload = {
  keyId: string;
  subscriptionId: string;
  planName: string;
  name: string;
  email: string;
};

export async function openRazorpayCheckout(payload: CheckoutPayload) {
  await loadRazorpay();
  const RazorpayCtor = (
    window as unknown as {
      Razorpay: new (options: Record<string, unknown>) => { open: () => void };
    }
  ).Razorpay;
  return new Promise<void>((resolve, reject) => {
    const checkout = new RazorpayCtor({
      key: payload.keyId,
      subscription_id: payload.subscriptionId,
      name: "Vivexa DeployX",
      description: payload.planName,
      prefill: { name: payload.name, email: payload.email },
      theme: { color: "#0F6E56" },
      handler: () => resolve(),
      modal: { ondismiss: () => reject(new Error("Checkout closed before completion.")) },
    });
    checkout.open();
  });
}

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById("razorpay-checkout")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded."));
    document.body.appendChild(script);
  });
}
