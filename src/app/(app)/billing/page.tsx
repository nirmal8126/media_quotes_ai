export default function BillingPage() {
  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6 shadow-card-2">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Billing</p>
          <h1 className="text-2xl font-bold text-dark">Plans, invoices, and payments</h1>
          <p className="text-sm text-gray-6">
            Track subscription status, usage, and invoices. Connect your billing provider to surface live data.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-gray-3 bg-gray-1 p-6 text-sm text-gray-6">
        Replace this with your Stripe/Razorpay data, invoices, and plan management UI. Navigation is ready for when the
        integration is wired up.
      </div>
    </div>
  );
}
