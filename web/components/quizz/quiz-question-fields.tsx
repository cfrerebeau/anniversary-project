'use client'

import { BALabel } from '@/components/design/eyebrow'

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 4
export const OPTION_PLACEHOLDERS = ['Micro-ondes', 'Four', 'Réfrigérateur', 'Plaque de cuisson']

type Props = {
  question: string
  options: string[]
  correctIndex: number
  onChangeQuestion: (v: string) => void
  onChangeOption: (i: number, v: string) => void
  onAddOption: () => void
  onRemoveOption: (i: number) => void
  onSetCorrect: (i: number) => void
  disabled?: boolean
}

export function QuizQuestionFields({
  question,
  options,
  correctIndex,
  onChangeQuestion,
  onChangeOption,
  onAddOption,
  onRemoveOption,
  onSetCorrect,
  disabled = false,
}: Props) {
  return (
    <>
      <div className="mb-[14px]">
        <BALabel>La question</BALabel>
        <textarea
          className="ba-input"
          rows={3}
          placeholder="ex. Que ne trouve t'on PAS dans la cuisine de Brice et Alix ?"
          value={question}
          onChange={(e) => onChangeQuestion(e.target.value)}
          style={{ resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
          maxLength={280}
          required
          minLength={8}
          disabled={disabled}
        />
        <div className="text-[11px] text-ink-mute mt-[6px] ml-[2px] flex justify-between">
          <span>Une vraie histoire, transformée en devinette.</span>
          <span>{question.length}/280</span>
        </div>
      </div>

      <div className="mb-[14px]">
        <BALabel>Les réponses possibles · coche la bonne</BALabel>
        <div role="radiogroup" aria-label="Bonne réponse" className="flex flex-col gap-[8px]">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-[8px]">
              <button
                type="button"
                role="radio"
                aria-checked={correctIndex === i}
                onClick={() => onSetCorrect(i)}
                aria-label={`Marquer l'option ${i + 1} comme bonne réponse`}
                className="ba-btn shrink-0 flex items-center justify-center rounded-full"
                disabled={disabled}
                style={{
                  width: 28,
                  height: 28,
                  background:
                    correctIndex === i ? 'var(--color-olive)' : 'transparent',
                  border: `1px solid ${
                    correctIndex === i ? 'var(--color-olive)' : 'var(--color-paper-edge)'
                  }`,
                  color: correctIndex === i ? 'var(--color-paper)' : 'var(--color-ink-mute)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {correctIndex === i ? '✓' : ''}
              </button>
              <input
                className="ba-input"
                placeholder={OPTION_PLACEHOLDERS[i] ?? `Réponse ${i + 1}`}
                value={opt}
                onChange={(e) => onChangeOption(i, e.target.value)}
                maxLength={120}
                required
                disabled={disabled}
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(i)}
                  aria-label={`Retirer l'option ${i + 1}`}
                  className="ba-btn shrink-0 text-ink-mute"
                  disabled={disabled}
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={onAddOption}
            disabled={disabled}
            className="ba-btn w-full mt-[10px] flex items-center justify-between text-[13px] text-ink-soft"
            style={{
              border: '1.5px dashed var(--color-paper-edge)',
              background: 'transparent',
              padding: '10px 14px',
              borderRadius: 10,
            }}
          >
            <span className="flex items-center gap-[8px]">
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              <span>Ajouter une autre réponse</span>
            </span>
            <span className="text-ink-mute font-mono text-[11px]">
              {options.length}/{MAX_OPTIONS}
            </span>
          </button>
        )}
      </div>
    </>
  )
}
