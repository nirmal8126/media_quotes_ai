export default function PersonaPage() {
  return (
    <div className="rounded-2xl border border-gray-3 bg-white p-6 shadow-card-2">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Persona</p>
          <h1 className="text-2xl font-bold text-dark">Brand voice & targeting</h1>
          <p className="text-sm text-gray-6">
            Configure tone, audiences, and platform preferences for your generated content.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-gray-3 bg-gray-1 p-6 text-sm text-gray-6">
        Add persona fields, presets, and saving to your data source. This placeholder keeps navigation intact while you
        wire up the real controls.
      </div>
    </div>
  );
}
