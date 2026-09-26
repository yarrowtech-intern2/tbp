import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { GUIDELINE_MAX_ITEMS, GUIDELINE_MAX_LENGTH } from '../lib/listingGuidelines';
import './guideline-list-editor.css';

interface GuidelineListEditorProps {
    label: string;
    hint: string;
    icon: React.ReactNode;
    tone: 'do' | 'dont' | 'rule' | 'carry';
    items: string[];
    placeholder: string;
    disabled?: boolean;
    onChange: (items: string[]) => void;
}

export const GuidelineListEditor: React.FC<GuidelineListEditorProps> = ({
    label,
    hint,
    icon,
    tone,
    items,
    placeholder,
    disabled = false,
    onChange,
}) => {
    const [draft, setDraft] = useState('');
    const isFull = items.length >= GUIDELINE_MAX_ITEMS;

    const addItem = () => {
        const text = draft.trim().replace(/\s+/g, ' ').slice(0, GUIDELINE_MAX_LENGTH);
        if (!text || isFull) return;
        const exists = items.some((item) => item.toLowerCase() === text.toLowerCase());
        if (!exists) onChange([...items, text]);
        setDraft('');
    };

    return (
        <div className={`gle gle--${tone}`}>
            <div className="gle-head">
                <span className="gle-title">{icon}{label}</span>
                <span className="gle-count">{items.length}/{GUIDELINE_MAX_ITEMS}</span>
            </div>
            <p className="gle-hint">{hint}</p>

            {items.length > 0 && (
                <ul className="gle-list">
                    {items.map((item, index) => (
                        <li key={`${item}-${index}`}>
                            <span>{item}</span>
                            <button
                                type="button"
                                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                                aria-label={`Remove ${item}`}
                                disabled={disabled}
                            >
                                <X size={12} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="gle-add">
                <input
                    type="text"
                    value={draft}
                    maxLength={GUIDELINE_MAX_LENGTH}
                    placeholder={isFull ? 'Limit reached' : placeholder}
                    disabled={disabled || isFull}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        addItem();
                    }}
                />
                <button type="button" onClick={addItem} disabled={disabled || isFull || !draft.trim()}>
                    <Plus size={14} /> Add
                </button>
            </div>
        </div>
    );
};
