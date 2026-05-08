import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Database, Loader2, SendHorizontal, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    getChatbotReply,
    getConfiguredChatbotMode,
    type ChatbotHistoryTurn,
    type ChatbotMode,
} from '../lib/chatbot';
import './support-chatbot.css';

type UIMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    mode?: ChatbotMode;
};

const QUICK_PROMPTS = [
    'Best tours available right now',
    'Show activities in Goa',
    'My booking status',
    'What is my account verification status?',
];

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const MODE_LABELS: Record<ChatbotMode, string> = {
    ai: 'AI + Database',
    'rule-based': 'Rule-Based Database',
};

export const SupportChatbot: React.FC = () => {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<UIMessage[]>([{
        id: 'welcome',
        role: 'assistant',
        mode: getConfiguredChatbotMode(),
        text: 'Hi. Ask about listings, prices, bookings, favorites, or account status.',
    }]);
    const [headerMode, setHeaderMode] = useState<ChatbotMode>(getConfiguredChatbotMode());
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const history = useMemo<ChatbotHistoryTurn[]>(
        () => messages.map((message) => ({ role: message.role, text: message.text })),
        [messages]
    );

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }, [messages, loading, open]);

    if (pathname === '/auth') return null;

    const submitQuestion = async (question: string) => {
        const normalized = question.trim();
        if (!normalized || loading) return;

        const userMessage: UIMessage = {
            id: createMessageId(),
            role: 'user',
            text: normalized,
        };
        const nextHistory = [...history, { role: 'user' as const, text: normalized }];

        setMessages((prev) => [...prev, userMessage]);
        setLoading(true);
        setText('');

        try {
            const reply = await getChatbotReply({
                question: normalized,
                userId: user?.id || null,
                history: nextHistory,
            });

            setHeaderMode(reply.mode);
            setMessages((prev) => [...prev, {
                id: createMessageId(),
                role: 'assistant',
                text: reply.text,
                mode: reply.mode,
            }]);
        } catch (error) {
            console.error('Chatbot failed:', error);
            setMessages((prev) => [...prev, {
                id: createMessageId(),
                role: 'assistant',
                mode: 'rule-based',
                text: 'I could not process that request right now. Please try again.',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        await submitQuestion(text);
    };

    return (
        <div className={`tbp-chatbot ${open ? 'is-open' : ''}`}>
            <button
                type="button"
                className="tbp-chatbot-fab"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-controls="tbp-chatbot-panel"
            >
                {open ? <X size={22} /> : <span className="tbp-chatbot-fab-label">AI</span>}
            </button>

            <section id="tbp-chatbot-panel" className="tbp-chatbot-panel glass" aria-hidden={!open}>
                <header className="tbp-chatbot-header">
                    <div className="tbp-chatbot-header-left">
                        <span className="tbp-chatbot-logo"><Bot size={16} /></span>
                        <div>
                            <strong>Vagabond Assistant</strong>
                            <p>
                                {headerMode === 'ai' ? <Sparkles size={12} /> : <Database size={12} />}
                                {MODE_LABELS[headerMode]}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="tbp-chatbot-close"
                        onClick={() => setOpen(false)}
                        aria-label="Close assistant"
                    >
                        <X size={16} />
                    </button>
                </header>

                <div className="tbp-chatbot-quick">
                    {QUICK_PROMPTS.map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => { void submitQuestion(prompt); }}
                            disabled={loading}
                        >
                            {prompt}
                        </button>
                    ))}
                </div>

                <div className="tbp-chatbot-messages" ref={scrollRef}>
                    {messages.map((message) => (
                        <article
                            key={message.id}
                            className={`tbp-chatbot-message ${message.role === 'assistant' ? 'assistant' : 'user'}`}
                        >
                            <p>{message.text}</p>
                            {message.role === 'assistant' && message.mode && (
                                <span className="tbp-chatbot-source">{MODE_LABELS[message.mode]}</span>
                            )}
                        </article>
                    ))}
                    {loading && (
                        <div className="tbp-chatbot-loading">
                            <Loader2 size={14} className="animate-spin" />
                            Thinking...
                        </div>
                    )}
                </div>

                <form className="tbp-chatbot-form" onSubmit={handleSubmit}>
                    <input
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder="Ask your system question..."
                        aria-label="Chatbot question input"
                    />
                    <button type="submit" disabled={loading || !text.trim()} aria-label="Send question">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
                    </button>
                </form>
            </section>
        </div>
    );
};
