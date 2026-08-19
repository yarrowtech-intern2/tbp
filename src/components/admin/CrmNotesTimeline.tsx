import React from 'react';
import { Loader2, Send } from 'lucide-react';

export type CrmNoteLike = {
    id: string;
    author_name: string;
    body: string;
    created_at: string;
};

const formatTimestamp = (value: string) => {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

type CrmNotesTimelineProps = {
    notes: CrmNoteLike[];
    loading: boolean;
    error: string | null;
    draft: string;
    onDraftChange: (value: string) => void;
    onSubmit: () => void;
    submitting: boolean;
    placeholder?: string;
};

export const CrmNotesTimeline: React.FC<CrmNotesTimelineProps> = ({
    notes,
    loading,
    error,
    draft,
    onDraftChange,
    onSubmit,
    submitting,
    placeholder,
}) => (
    <div className="crm-notes">
        <h3>Notes</h3>
        {loading ? (
            <p className="crm-inline-loading"><Loader2 size={14} className="animate-spin" /> Loading notes...</p>
        ) : error ? (
            <p className="rdb-error">{error}</p>
        ) : notes.length === 0 ? (
            <p className="rdb-empty">No notes yet.</p>
        ) : (
            <div className="crm-notes-list">
                {notes.map((note) => (
                    <div className="crm-note" key={note.id}>
                        <div className="crm-note-meta">
                            <strong>{note.author_name}</strong>
                            <small>{formatTimestamp(note.created_at)}</small>
                        </div>
                        <p>{note.body}</p>
                    </div>
                ))}
            </div>
        )}

        <form
            className="crm-note-form"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <textarea
                rows={2}
                placeholder={placeholder || 'Add a follow-up note...'}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
            />
            <button type="submit" className="crm-note-submit" disabled={submitting || !draft.trim()}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Add note
            </button>
        </form>
    </div>
);
