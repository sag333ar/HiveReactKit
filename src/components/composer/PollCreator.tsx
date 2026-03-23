import React, { useState } from 'react'
import { X } from 'lucide-react'

export interface PollData {
  question: string
  choices: string[]
  end_time: number
  max_choices_voted: number
  allow_vote_changes: boolean
  filters: { account_age: number }
  ui_hide_res_until_voted: boolean
}

export interface PollCreatorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (poll: PollData) => void
  initialData?: PollData | null
}

const MIN_CHOICES = 2
const MAX_CHOICES = 10

function defaultEndDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 16)
}

const PollCreator: React.FC<PollCreatorProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [question, setQuestion] = useState(initialData?.question ?? '')
  const [choices, setChoices] = useState<string[]>(
    initialData?.choices?.length ? initialData.choices : ['', '']
  )
  const [endDate, setEndDate] = useState(
    initialData?.end_time
      ? new Date(initialData.end_time * 1000).toISOString().slice(0, 16)
      : defaultEndDate()
  )
  const [maxChoicesVoted, setMaxChoicesVoted] = useState(initialData?.max_choices_voted ?? 1)
  const [allowVoteChanges, setAllowVoteChanges] = useState(initialData?.allow_vote_changes ?? true)
  const [accountAge, setAccountAge] = useState(initialData?.filters?.account_age ?? 0)
  const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState(
    initialData?.ui_hide_res_until_voted ?? false
  )

  if (!isOpen) return null

  const addChoice = () => {
    if (choices.length < MAX_CHOICES) setChoices([...choices, ''])
  }

  const removeChoice = (idx: number) => {
    if (choices.length > MIN_CHOICES) setChoices(choices.filter((_, i) => i !== idx))
  }

  const updateChoice = (idx: number, value: string) => {
    setChoices(choices.map((c, i) => (i === idx ? value : c)))
  }

  const filledChoices = choices.filter((c) => c.trim())
  const isValid =
    question.trim().length > 0 &&
    filledChoices.length >= MIN_CHOICES &&
    new Date(endDate).getTime() > Date.now()

  const handleSave = () => {
    if (!isValid) return
    onSave({
      question: question.trim(),
      choices: filledChoices,
      end_time: Math.floor(new Date(endDate).getTime() / 1000),
      max_choices_voted: Math.min(maxChoicesVoted, filledChoices.length),
      allow_vote_changes: allowVoteChanges,
      filters: { account_age: accountAge },
      ui_hide_res_until_voted: hideResultsUntilVoted,
    })
    onClose()
  }

  const inputClass =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none'
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white">Create Poll</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <div>
            <label className={labelClass}>Question</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question..." className={inputClass} maxLength={256} />
          </div>

          <div>
            <label className={labelClass}>Choices (min {MIN_CHOICES}, max {MAX_CHOICES})</label>
            <div className="space-y-2">
              {choices.map((choice, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" value={choice} onChange={(e) => updateChoice(idx, e.target.value)} placeholder={`Option ${idx + 1}`} className={inputClass} maxLength={128} />
                  {choices.length > MIN_CHOICES && (
                    <button type="button" onClick={() => removeChoice(idx)} className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-red-400" title="Remove option">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {choices.length < MAX_CHOICES && (
              <button type="button" onClick={addChoice} className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-medium">
                + Add option
              </button>
            )}
          </div>

          <div>
            <label className={labelClass}>Poll ends at</label>
            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} min={new Date().toISOString().slice(0, 16)} />
          </div>

          <div>
            <label className={labelClass}>Max choices a voter can select ({maxChoicesVoted})</label>
            <input type="range" min={1} max={Math.max(filledChoices.length, 1)} value={maxChoicesVoted} onChange={(e) => setMaxChoicesVoted(Number(e.target.value))} className="w-full accent-blue-500" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allowVoteChanges} onChange={(e) => setAllowVoteChanges(e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-gray-400">Allow voters to change their vote</span>
          </label>

          <div>
            <label className={labelClass}>Minimum account age to vote (days): {accountAge}</label>
            <input type="number" min={0} max={365} value={accountAge} onChange={(e) => setAccountAge(Math.max(0, Number(e.target.value)))} className={inputClass} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hideResultsUntilVoted} onChange={(e) => setHideResultsUntilVoted(e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-gray-400">Hide results until user has voted</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-gray-800">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!isValid} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700">
            Attach Poll
          </button>
        </div>
      </div>
    </div>
  )
}

export default PollCreator
