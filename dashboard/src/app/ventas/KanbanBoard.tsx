'use client';

import { useState } from 'react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { STAGE_LABELS, STAGE_COLORS, STAGE_ORDER } from '@/lib/format';
import { moveContactStage } from './actions';

export interface KanbanContact {
  id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  stage: string;
  lead_score: number | null;
  interest_level: string | null;
  source_channel: string | null;
  last_inbound_at: string | null;
}

function Card({ contact }: { contact: KanbanContact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: contact.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 10 : undefined }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...style,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 8,
        boxShadow: 'var(--shadow)',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <a href={`/leads/${contact.id}`} style={{ fontWeight: 600, fontSize: 13.5 }}>
        {contact.display_name || contact.full_name || contact.phone || 'Sin nombre'}
      </a>
      <div style={{ marginTop: 6 }}>
        <span className="score-bar">
          <span style={{ width: `${contact.lead_score ?? 0}%` }} />
        </span>{' '}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{contact.lead_score ?? 0}</span>
      </div>
      {contact.source_channel && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{contact.source_channel}</div>
      )}
    </div>
  );
}

function Column({ stage, contacts }: { stage: string; contacts: KanbanContact[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: '1 1 0',
        minWidth: 220,
        background: isOver ? 'var(--panel-2)' : 'transparent',
        border: '1px dashed var(--border)',
        borderRadius: 12,
        padding: 12,
        transition: 'background .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="badge" style={{ background: STAGE_COLORS[stage] }}>
          {STAGE_LABELS[stage] ?? stage}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{contacts.length}</span>
      </div>
      {contacts.map((c) => (
        <Card key={c.id} contact={c} />
      ))}
      {contacts.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sin clientes</p>}
    </div>
  );
}

export default function KanbanBoard({
  contactsByStage,
}: {
  contactsByStage: Record<string, KanbanContact[]>;
}) {
  const [board, setBoard] = useState(contactsByStage);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const contactId = String(active.id);
    const newStage = String(over.id);

    let fromStage: string | null = null;
    for (const stage of Object.keys(board)) {
      if (board[stage].some((c) => c.id === contactId)) {
        fromStage = stage;
        break;
      }
    }
    if (!fromStage || fromStage === newStage) return;
    const stageBefore = fromStage;

    setBoard((prev) => {
      const contact = prev[stageBefore].find((c) => c.id === contactId);
      if (!contact) return prev;
      return {
        ...prev,
        [stageBefore]: prev[stageBefore].filter((c) => c.id !== contactId),
        [newStage]: [{ ...contact, stage: newStage }, ...(prev[newStage] ?? [])],
      };
    });

    moveContactStage(contactId, newStage);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
        {STAGE_ORDER.map((stage) => (
          <Column key={stage} stage={stage} contacts={board[stage] ?? []} />
        ))}
      </div>
    </DndContext>
  );
}
