import UsageTracker from '../components/system/UsageTracker'

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold mb-2">Config & Settings</h1>
        <p className="text-text-secondary">
          Profile switching is exposed server-side at <code>/api/rate-limits/switch</code>.
          The live gateway cache is summarized below.
        </p>
      </div>

      <UsageTracker />
    </div>
  )
}
