import { useState, useCallback } from 'react'
import type { AgentInfo } from '../../lib/api'
import { changeAgentModel, getStatus } from '../../lib/api'
import ConfirmDialog from '../ui/ConfirmDialog'
import type { ToastPayload } from '../../hooks/useToast'

const AVAILABLE_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'o3',
  'o4-mini',
  'gemini-2.5-pro',
]

const PROVIDER_COLORS: Record<string, { badge: string; text: string }> = {
  anthropic: { badge: 'bg-indigo-subtle text-indigo', text: 'text-indigo' },
  openai:    { badge: 'bg-emerald-subtle text-emerald', text: 'text-emerald' },
  google:    { badge: 'bg-blue-subtle text-blue', text: 'text-blue' },
}

function detectProvider(model: string): string {
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('o3') || model.startsWith('o4') || model.startsWith('gpt') || model.startsWith('codex')) return 'openai'
  if (model.startsWith('gemini')) return 'google'
  return 'anthropic'
}

interface ModelSelectorProps {
  agent: AgentInfo
  currentModel: string
  onToast: (toast: ToastPayload) => void
}

export default function ModelSelector({ agent, currentModel, onToast }: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  const provider = detectProvider(currentModel)
  const colors = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.anthropic

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val && val !== currentModel) {
      setSelectedModel(val)
    }
  }

  const handleCancel = () => {
    setSelectedModel(null)
  }

  const handleConfirm = useCallback(async () => {
    if (!selectedModel) return
    setChanging(true)
    setSelectedModel(null)

    onToast({ message: `Restarting gateway... Model change to ${selectedModel} in progress.`, variant: 'warning' })

    try {
      const result = await changeAgentModel(agent.id, selectedModel)
      if (!result.ok) {
        onToast({ message: `Model change failed: ${result.error}`, variant: 'error' })
        setChanging(false)
        return
      }

      // Poll status until gateway is back up
      let attempts = 0
      const maxAttempts = 20
      const poll = async () => {
        attempts++
        try {
          const status = await getStatus()
          if (status.gateway_up) {
            onToast({ message: `Model changed to ${selectedModel}. Gateway is back up.`, variant: 'success' })
            setChanging(false)
            return
          }
        } catch {
          // gateway still restarting
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 3000)
        } else {
          onToast({ message: 'Gateway restart is taking longer than expected. Check system status.', variant: 'warning' })
          setChanging(false)
        }
      }

      setTimeout(poll, 3000)
    } catch {
      onToast({ message: 'Model change request failed.', variant: 'error' })
      setChanging(false)
    }
  }, [agent.id, selectedModel, onToast])

  const newProvider = selectedModel ? detectProvider(selectedModel) : null
  const newColors = newProvider ? PROVIDER_COLORS[newProvider] ?? PROVIDER_COLORS.anthropic : null

  return (
    <div className="space-y-4">
      {/* Current model display */}
      <div>
        <div className="text-[11px] text-text-tertiary mb-1.5">Current Model</div>
        <span className={`inline-block px-2 py-0.5 rounded font-mono text-[11px] ${colors.badge}`}>
          {currentModel}
        </span>
      </div>

      {/* Model dropdown */}
      <div>
        <div className="text-[11px] text-text-tertiary mb-1.5">Change Model</div>
        <select
          value=""
          onChange={handleSelect}
          disabled={changing}
          className="w-full bg-bg-void border border-border-default rounded px-2 py-1.5 text-[12px] font-mono text-text-primary focus:outline-none focus:border-accent-amber disabled:opacity-50"
        >
          <option value="" disabled>Select a model...</option>
          {AVAILABLE_MODELS.filter(m => m !== currentModel).map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>

      {changing && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3 h-3 border-2 border-accent-amber border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-accent-amber">Restarting gateway...</span>
        </div>
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={selectedModel !== null}
        title="Model Change — Gateway Restart Required"
        confirmText={agent.id}
        confirmLabel="Confirm Change"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        message={
          <div>
            <div className="bg-accent-amber-subtle border border-accent-amber/20 rounded px-3.5 py-2.5 mb-4">
              <p className="text-[12px] text-accent-amber leading-relaxed">
                Changing the model will restart the OpenClaw gateway (~30s downtime).
                All active agent sessions will be interrupted.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[12px]">
              <span className="text-text-tertiary">{agent.id}:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] bg-bg-overlay text-text-secondary`}>
                {currentModel}
              </span>
              <span className="text-text-disabled">&rarr;</span>
              {selectedModel && newColors && (
                <span className={`px-2 py-0.5 rounded text-[11px] ${newColors.badge}`}>
                  {selectedModel}
                </span>
              )}
            </div>
          </div>
        }
      />
    </div>
  )
}
