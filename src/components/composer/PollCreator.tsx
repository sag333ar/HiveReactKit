/**
 * Poll attachment editor for ParentPostComposer.
 *
 * Mirrors the feature set of the standalone hPolls "Create Poll" surface so
 * a poll attached from the kit composer is indistinguishable on-chain from
 * one published by hPolls itself: vote-interpretation engines (Number of
 * Votes / HIVE→HP / Splinterlands / Arcade Colony / GLX / Hive-Engine
 * tokens), a short preview description, max-choice slider, voter-change
 * toggle, minimum account age, hide-results-until-voted, and the
 * community-restricted flag.
 *
 * The component returns a `PollData` object whose shape matches what the
 * Hive comment metadata expects (`preferred_interpretation`, `choices`,
 * `end_time`, etc.) so consumers can inline it into `json_metadata`
 * without further mapping.
 */
import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Info, Minus, Plus, X } from 'lucide-react'

/** Curated list of vote-weight interpretation engines hPolls supports. */
export const POLL_VOTE_INTERPRETATIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'number_of_votes', label: 'Number of Votes' },
  { key: 'token_hive_hp', label: 'Token: HIVE → HP' },
  { key: 'splinterlands_staked_sps', label: 'Splinterlands: Staked SPS' },
  { key: 'arcade_colony_staked_colony', label: 'Arcade Colony: Staked COLONY' },
  { key: 'genesis_league_sport_staked_glx', label: 'Genesis League Sport: Staked GLX' },
]

/** Hive-Engine tokens (and stake variants) that hPolls can interpret. The
 *  key follows the same `token_he_<slug>` pattern hPolls broadcasts. */
export const POLL_HE_VOTE_INTERPRETATIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'token_he_bee', label: 'BEE' },
  { key: 'token_he_leo', label: 'LEO' },
  { key: 'token_he_staked_leo', label: 'Staked LEO' },
  { key: 'token_he_zing', label: 'ZING' },
  { key: 'token_he_staked_zing', label: 'Staked ZING' },
  { key: 'token_he_woo', label: 'WOO' },
  { key: 'token_he_staked_woo', label: 'Staked WOO' },
  { key: 'token_he_crop', label: 'CROP' },
  { key: 'token_he_pkm', label: 'PKM' },
  { key: 'token_he_afit', label: 'AFIT' },
  { key: 'token_he_stem', label: 'STEM' },
  { key: 'token_he_staked_stem', label: 'Staked STEM' },
  { key: 'token_he_beer', label: 'BEER' },
  { key: 'token_he_staked_beer', label: 'Staked BEER' },
]

const ALL_INTERPRETATIONS = [...POLL_VOTE_INTERPRETATIONS, ...POLL_HE_VOTE_INTERPRETATIONS]

const labelForInterpretation = (key: string): string =>
  ALL_INTERPRETATIONS.find((i) => i.key === key)?.label ??
  POLL_VOTE_INTERPRETATIONS[0].label

export interface PollData {
  question: string
  choices: string[]
  end_time: number
  max_choices_voted: number
  allow_vote_changes: boolean
  filters: { account_age: number }
  ui_hide_res_until_voted: boolean
  /** Short user-facing summary surfaced by some clients above the choices. */
  description?: string
  /** Engine key used to weight votes (`number_of_votes`, `token_hive_hp`, …). */
  preferred_interpretation?: string
  /** Restrict voting to community members. Maps to `community_restricted`. */
  community_restricted?: boolean
}

export interface PollCreatorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (poll: PollData) => void
  initialData?: PollData | null
}

const MIN_CHOICES = 2
const MAX_CHOICES = 10
const MAX_DESCRIPTION = 120

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
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [interpretation, setInterpretation] = useState<string>(
    initialData?.preferred_interpretation ?? 'number_of_votes'
  )
  const [communityRestricted, setCommunityRestricted] = useState(
    initialData?.community_restricted ?? false
  )
  const [isInterpOpen, setIsInterpOpen] = useState(false)
  const [showHeInterpOptions, setShowHeInterpOptions] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const interpRef = useRef<HTMLDivElement | null>(null)

  // Close vote-interpretation popover on outside click.
  useEffect(() => {
    if (!isInterpOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (!interpRef.current) return
      if (!interpRef.current.contains(e.target as Node)) {
        setIsInterpOpen(false)
        setShowHeInterpOptions(false)
      }
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [isInterpOpen])

  // Clamp max-choices when the option count drops below the slider value.
  useEffect(() => {
    setMaxChoicesVoted((prev) => Math.min(Math.max(prev, 1), Math.max(choices.length, 1)))
  }, [choices.length])

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
      description: description.trim().slice(0, MAX_DESCRIPTION) || undefined,
      preferred_interpretation: interpretation,
      community_restricted: communityRestricted,
    })
    onClose()
  }

  const inputClass =
    'w-full rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-3 py-2 text-sm text-white placeholder-[var(--hrk-text-tertiary)] focus:border-[var(--hrk-info)] focus:outline-none'
  const labelClass = 'block text-xs font-medium text-[var(--hrk-text-tertiary)] mb-1'

  // Plain function call — keep it out of `useMemo` so the hook count stays
  // identical regardless of `isOpen` (the modal returns early when closed,
  // so any hook below the gate would violate Rules of Hooks).
  const interpretationLabel = labelForInterpretation(interpretation)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-[var(--hrk-bg-app)] border border-[var(--hrk-border-subtle)] rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hrk-border-subtle)]">
          <h3 className="text-sm font-semibold text-white">Create Poll</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[var(--hrk-bg-surface)] rounded text-[var(--hrk-text-tertiary)]">
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
            <label className={labelClass}>
              Short preview description{' '}
              <span className="text-[var(--hrk-text-tertiary)]">({description.length}/{MAX_DESCRIPTION})</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
              placeholder="One-line summary shown above the choices (optional)"
              className={inputClass}
              maxLength={MAX_DESCRIPTION}
            />
          </div>

          <div>
            <label className={labelClass}>Choices (min {MIN_CHOICES}, max {MAX_CHOICES})</label>
            <div className="space-y-2">
              {choices.map((choice, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" value={choice} onChange={(e) => updateChoice(idx, e.target.value)} placeholder={`Option ${idx + 1}`} className={inputClass} maxLength={128} />
                  {choices.length > MIN_CHOICES && (
                    <button type="button" onClick={() => removeChoice(idx)} className="shrink-0 rounded p-1.5 text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface)] hover:text-red-400" title="Remove option">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {choices.length < MAX_CHOICES && (
              <button type="button" onClick={addChoice} className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium">
                <Plus className="h-3 w-3" /> Add option
              </button>
            )}
          </div>

          <div>
            <label className={labelClass}>Poll ends at</label>
            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} min={new Date().toISOString().slice(0, 16)} />
          </div>

          {/* Vote interpretation — same engine list hPolls publishes. */}
          <div ref={interpRef} className="relative">
            <label className={labelClass}>
              <span className="inline-flex items-center gap-1">
                Vote interpretation
                <Info className="h-3 w-3 text-[var(--hrk-text-tertiary)]" />
              </span>
            </label>
            <button
              type="button"
              onClick={() => { setIsInterpOpen((v) => !v); setShowHeInterpOptions(false); }}
              className={`${inputClass} flex items-center justify-between text-left`}
            >
              <span className="truncate">{interpretationLabel}</span>
              {isInterpOpen
                ? <ChevronUp className="h-4 w-4 text-[var(--hrk-text-tertiary)]" />
                : <ChevronDown className="h-4 w-4 text-[var(--hrk-text-tertiary)]" />}
            </button>
            {isInterpOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] shadow-xl">
                {POLL_VOTE_INTERPRETATIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setInterpretation(opt.key)
                      setIsInterpOpen(false)
                      setShowHeInterpOptions(false)
                    }}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-[var(--hrk-bg-surface)] ${
                      interpretation === opt.key ? 'text-blue-400' : 'text-[var(--hrk-text-primary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowHeInterpOptions((v) => !v)}
                  className="flex w-full items-center justify-between border-t border-[var(--hrk-border-subtle)] px-3 py-2 text-sm text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface)]"
                >
                  <span>Token: Hive-Engine</span>
                  {showHeInterpOptions
                    ? <ChevronUp className="h-3.5 w-3.5 text-[var(--hrk-text-tertiary)]" />
                    : <ChevronDown className="h-3.5 w-3.5 text-[var(--hrk-text-tertiary)]" />}
                </button>
                {showHeInterpOptions && (
                  <div className="border-t border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)]">
                    {POLL_HE_VOTE_INTERPRETATIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setInterpretation(opt.key)
                          setIsInterpOpen(false)
                          setShowHeInterpOptions(false)
                        }}
                        className={`block w-full text-left px-5 py-1.5 text-xs hover:bg-[var(--hrk-bg-surface)] ${
                          interpretation === opt.key ? 'text-blue-400' : 'text-[var(--hrk-text-secondary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced section — keep the modal short by default. */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)]"
          >
            {showAdvanced ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            Advanced settings
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t border-[var(--hrk-border-subtle)] pt-4">
              <div>
                <label className={labelClass}>Max choices a voter can select ({maxChoicesVoted})</label>
                <input
                  type="range"
                  min={1}
                  max={Math.max(filledChoices.length, 1)}
                  value={maxChoicesVoted}
                  onChange={(e) => setMaxChoicesVoted(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allowVoteChanges} onChange={(e) => setAllowVoteChanges(e.target.checked)} className="accent-blue-500" />
                <span className="text-xs text-[var(--hrk-text-tertiary)]">Allow voters to change their vote</span>
              </label>

              <div>
                <label className={labelClass}>Minimum account age to vote (days): {accountAge}</label>
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={accountAge}
                  onChange={(e) => setAccountAge(Math.max(0, Number(e.target.value)))}
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hideResultsUntilVoted} onChange={(e) => setHideResultsUntilVoted(e.target.checked)} className="accent-blue-500" />
                <span className="text-xs text-[var(--hrk-text-tertiary)]">Hide results until user has voted</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={communityRestricted}
                  onChange={(e) => setCommunityRestricted(e.target.checked)}
                  className="accent-blue-500"
                />
                <span className="text-xs text-[var(--hrk-text-tertiary)]">Restrict voting to community members</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--hrk-border-subtle)]">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface)]">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!isValid} className="rounded-[10px] bg-[var(--hrk-brand)] px-4 py-2 text-sm font-medium text-[var(--hrk-text-on-brand)] disabled:opacity-50 hover:bg-[var(--hrk-brand-hover)]">
            Attach Poll
          </button>
        </div>
      </div>
    </div>
  )
}

export default PollCreator
