import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './logout-confirm-modal.css';

type LogoutConfirmModalProps = {
    open: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
    open,
    busy = false,
    onConfirm,
    onCancel,
}) => {
    const noButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusTimer = window.setTimeout(() => noButtonRef.current?.focus(), 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) onCancel();
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.clearTimeout(focusTimer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [busy, onCancel, open]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="logout-confirm" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
            <button
                type="button"
                className="logout-confirm-backdrop"
                aria-label="Cancel sign out"
                disabled={busy}
                onClick={onCancel}
            />
            <section className="logout-confirm-card">
                <h2 id="logout-confirm-title">Are you sure!</h2>
                <p>You wanna leave us :(</p>
                <div className="logout-confirm-actions">
                    <button
                        type="button"
                        className="logout-confirm-btn logout-confirm-btn--yes"
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        Yes
                    </button>
                    <button
                        ref={noButtonRef}
                        type="button"
                        className="logout-confirm-btn logout-confirm-btn--no"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        No
                    </button>
                </div>
            </section>
        </div>,
        document.body,
    );
};
