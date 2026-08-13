'use client'

import { useState } from 'react'
import { Star, Wand2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Lead,
  PipelineStage,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
} from '@/types/lead'

const STAGE_ACCENTS: Record<PipelineStage, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-amber-500',
  replied: 'bg-violet-500',
  meeting: 'bg-cyan-600',
  proposal: 'bg-orange-500',
  won: 'bg-emerald-600',
  lost: 'bg-stone/60',
}

function stageOf(lead: Lead): PipelineStage {
  return lead.pipelineStage ?? 'new'
}

function BoardCard({
  lead,
  onGenerate,
  onStageChange,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  lead: Lead
  onGenerate: (lead: Lead) => void
  onStageChange: (id: string, stage: PipelineStage) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  dragging: boolean
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      className={cn(
        'group bg-card border border-sand rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition-all',
        'hover:border-signal/40 hover:shadow-sm',
        dragging && 'opacity-40'
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-stone/40 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink leading-tight truncate">{lead.businessName}</p>
          <p className="text-xs text-stone mt-0.5 truncate">
            {lead.category}
            {lead.city ? ` · ${lead.city}${lead.state ? `, ${lead.state}` : ''}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border',
            lead.leadScore >= 80
              ? 'bg-signal-50 text-signal border-signal/20'
              : lead.leadScore >= 50
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-paper-2 text-stone border-sand'
          )}
        >
          {lead.leadScore}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2.5 pl-5">
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-stone">
          {lead.rating != null ? (
            <>
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {lead.rating}
              {lead.reviewCount != null && <span className="text-stone/60">({lead.reviewCount})</span>}
            </>
          ) : (
            <span className="text-stone/50">No rating</span>
          )}
          {!lead.website && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-signal-50 text-signal font-sans font-medium">
              No site
            </span>
          )}
        </span>
        <button
          onClick={() => onGenerate(lead)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-signal hover:text-signal-600 transition-colors"
          title="Generate outreach"
        >
          <Wand2 className="w-3 h-3" />
          Outreach
        </button>
      </div>
      {/* Touch/keyboard fallback: drag-and-drop is mouse-only */}
      <div className="mt-2 pl-5 lg:hidden">
        <select
          value={stageOf(lead)}
          onChange={(e) => onStageChange(lead.id, e.target.value as PipelineStage)}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-[11px] border border-sand rounded-lg px-2 py-1 bg-paper-2 text-ink-soft focus:outline-none focus:ring-2 focus:ring-signal/20"
          aria-label={`Stage for ${lead.businessName}`}
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function PipelineBoard({
  leads,
  onStageChange,
  onGenerate,
}: {
  leads: Lead[]
  onStageChange: (id: string, stage: PipelineStage) => void
  onGenerate: (lead: Lead) => void
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<PipelineStage | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(id)
  }

  const handleDrop = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    setOverStage(null)
    setDraggingId(null)
    if (!id) return
    const lead = leads.find((l) => l.id === id)
    if (lead && stageOf(lead) !== stage) {
      onStageChange(id, stage)
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory lg:snap-none">
      {PIPELINE_STAGES.map((stage) => {
        const column = leads.filter((l) => stageOf(l) === stage)
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (overStage !== stage) setOverStage(stage)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null)
            }}
            onDrop={(e) => handleDrop(e, stage)}
            className={cn(
              'snap-start shrink-0 w-[272px] rounded-2xl border transition-colors flex flex-col max-h-[70vh]',
              overStage === stage
                ? 'border-signal bg-signal-50/50'
                : 'border-sand bg-paper-2/50'
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-sand/70">
              <span className={cn('w-2 h-2 rounded-full', STAGE_ACCENTS[stage])} />
              <span className="text-xs font-semibold tracking-wide uppercase text-ink-soft">
                {PIPELINE_STAGE_LABELS[stage]}
              </span>
              <span className="ml-auto text-xs font-mono font-semibold text-stone bg-card border border-sand px-1.5 py-0.5 rounded-md">
                {column.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-2 overflow-y-auto">
              {column.length === 0 ? (
                <p className="text-[11px] text-stone/60 text-center py-6 px-2">
                  {stage === 'new' ? 'Saved leads start here' : 'Drag leads here'}
                </p>
              ) : (
                column.map((lead) => (
                  <BoardCard
                    key={lead.id}
                    lead={lead}
                    onGenerate={onGenerate}
                    onStageChange={onStageChange}
                    onDragStart={handleDragStart}
                    onDragEnd={() => { setDraggingId(null); setOverStage(null) }}
                    dragging={draggingId === lead.id}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
