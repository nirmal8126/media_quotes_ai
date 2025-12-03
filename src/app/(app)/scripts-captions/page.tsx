export default function ScriptsCaptionsPage() {
  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6 shadow-card-2">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Scripts & Captions</p>
          <h1 className="text-2xl font-bold text-dark">Draft, review, and publish</h1>
          <p className="text-sm text-gray-6">
            Manage short-form scripts and captions, collaborate with editors, and export to your platforms.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-gray-3 bg-gray-1 p-6 text-sm text-gray-6">
        Hook this page up to your generation endpoints, queues, and approvals. Start by listing drafts or adding a “New
        script/caption” action here.
      </div>
    </div>
  );
}
