import { useState } from 'react'
import ServicesGrid from '../components/system/ServicesGrid'
import CronCalendar from '../components/system/CronCalendar'
import ServerVitals from '../components/system/ServerVitals'
import UsageTracker from '../components/system/UsageTracker'
import { usePolling } from '../hooks/usePolling'
import {
  getServices,
  runServiceAction,
  getCron,
  updateCron,
  getVitalsDetail,
  getRateLimits,
  switchRateLimitProfile,
} from '../lib/api'
import type { CronEntry, ServiceInfo } from '../lib/types'

export default function SystemPage() {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [cronSaving, setCronSaving] = useState(false)
  const services = usePolling(getServices, 5000)
  const cron = usePolling(getCron, 5000)
  const vitals = usePolling(getVitalsDetail, 5000)
  const rateLimits = usePolling(getRateLimits, 5000)

  const showFeedback = (message: string) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 3000)
  }

  const handleServiceAction = async (service: ServiceInfo, action: 'start' | 'stop' | 'restart') => {
    try {
      await runServiceAction(service.name, action)
      showFeedback(`${action} queued for ${service.display_name}`)
      await services.refetch()
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : `Failed to ${action} ${service.display_name}`)
    }
  }

  const handleCronChange = async (entries: CronEntry[]) => {
    try {
      setCronSaving(true)
      await updateCron(entries)
      await cron.refetch()
      showFeedback('Cron updated')
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Failed to update cron')
    } finally {
      setCronSaving(false)
    }
  }

  const handleSwitchProfile = async (profile: string) => {
    try {
      await switchRateLimitProfile(profile)
      await rateLimits.refetch()
      showFeedback(`Switched profile to ${profile}`)
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Failed to switch profile')
    }
  }

  return (
    <div className="min-h-full space-y-4">
      {feedback && (
        <div className="fixed right-6 top-16 z-50 rounded-md border border-border-default bg-bg-elevated px-3 py-2 font-mono text-xs text-text-primary shadow-lg">
          {feedback}
        </div>
      )}

      <div>
        <h1 className="text-lg font-semibold text-text-primary">System Health & Infrastructure</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Service controls, weekly cron schedule, host vitals, and live subscription usage.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <ServicesGrid
            services={services.data ?? []}
            loading={services.loading}
            onAction={handleServiceAction}
          />
          <CronCalendar
            entries={cron.data?.entries ?? []}
            loading={cron.loading}
            saving={cronSaving}
            onEntriesChange={handleCronChange}
          />
        </div>

        <div className="space-y-4">
          <ServerVitals vitals={vitals.data} loading={vitals.loading} />
          <UsageTracker
            data={rateLimits.data}
            loading={rateLimits.loading}
            onSwitchProfile={handleSwitchProfile}
          />
        </div>
      </div>
    </div>
  )
}
