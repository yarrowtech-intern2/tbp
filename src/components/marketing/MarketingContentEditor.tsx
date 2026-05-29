import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import {
    APP_CONTENT_KEYS,
    DEFAULT_ABOUT_PAGE_CONTENT,
    DEFAULT_FOOTER_CONTENT,
    DEFAULT_HERO_MESSAGES,
    HERO_MESSAGE_MOODS,
    getPublicAppContent,
    normalizeAboutPageContent,
    normalizeSalesSettingsContent,
    saveAppContentValue,
    type AboutPageCard,
    type AboutPageContent,
    type FooterContent,
    type FooterLink,
    type HeroMessageMood,
    type HeroMessagesContent,
    type SalesSettingsContent,
} from '../../lib/appContent';

type MarketingContentEditorProps = {
    userId?: string | null;
    mode: 'greetings' | 'contact' | 'about';
};

type SalesSettingsEditorProps = {
    userId?: string | null;
    value: SalesSettingsContent;
    onSaved: (value: SalesSettingsContent) => void;
};

type FooterColumnForm = {
    title: string;
    links: FooterLink[];
};

type FooterForm = {
    description: string;
    copyright: string;
    columns: FooterColumnForm[];
    socials: FooterLink[];
};

const emptyLink = (): FooterLink => ({ label: '', href: '' });

const cleanLinks = (links: FooterLink[]): FooterLink[] => links
    .map((item) => ({
        label: item.label.trim(),
        href: item.href?.trim() || null,
    }))
    .filter((item) => item.label.length > 0);

const footerToForm = (footer: FooterContent): FooterForm => {
    const fallbackColumns = DEFAULT_FOOTER_CONTENT.columns;
    const columns = fallbackColumns.map((fallback, index) => {
        const source = footer.columns[index] || fallback;
        return {
            title: source.title || fallback.title,
            links: source.links.length > 0 ? source.links : fallback.links,
        };
    });

    return {
        description: footer.description,
        copyright: footer.copyright,
        columns,
        socials: footer.socials.length > 0 ? footer.socials : DEFAULT_FOOTER_CONTENT.socials,
    };
};

const formToFooter = (form: FooterForm): FooterContent => ({
    description: form.description.trim() || DEFAULT_FOOTER_CONTENT.description,
    copyright: form.copyright.trim() || DEFAULT_FOOTER_CONTENT.copyright,
    columns: form.columns.map((column, index) => {
        const fallback = DEFAULT_FOOTER_CONTENT.columns[index] || DEFAULT_FOOTER_CONTENT.columns[0];
        const links = cleanLinks(column.links);
        return {
            title: column.title.trim() || fallback.title,
            links: links.length > 0 ? links : fallback.links,
        };
    }),
    socials: cleanLinks(form.socials).length > 0 ? cleanLinks(form.socials) : DEFAULT_FOOTER_CONTENT.socials,
});

const messagesToForm = (messages: HeroMessagesContent): Record<HeroMessageMood, string[]> => HERO_MESSAGE_MOODS.reduce((acc, mood) => {
    acc[mood] = messages[mood].length > 0 ? messages[mood] : DEFAULT_HERO_MESSAGES[mood];
    return acc;
}, {} as Record<HeroMessageMood, string[]>);

const formToMessages = (form: Record<HeroMessageMood, string[]>): HeroMessagesContent => HERO_MESSAGE_MOODS.reduce((acc, mood) => {
    const rows = form[mood].map((line) => line.trim()).filter(Boolean);
    acc[mood] = rows.length > 0 ? rows : DEFAULT_HERO_MESSAGES[mood];
    return acc;
}, {} as HeroMessagesContent);

const aboutToForm = (about: AboutPageContent): AboutPageContent => ({
    ...about,
    backgroundImages: about.backgroundImages.length > 0 ? about.backgroundImages : DEFAULT_ABOUT_PAGE_CONTENT.backgroundImages,
    cards: DEFAULT_ABOUT_PAGE_CONTENT.cards.map((fallback, index) => about.cards[index] || fallback),
});

const formToAbout = (form: AboutPageContent): AboutPageContent => normalizeAboutPageContent({
    ...form,
    backgroundImages: form.backgroundImages.map((item) => item.trim()).filter(Boolean),
    cards: form.cards.map((card, index) => {
        const fallback = DEFAULT_ABOUT_PAGE_CONTENT.cards[index] || DEFAULT_ABOUT_PAGE_CONTENT.cards[0];
        return {
            ...card,
            id: card.id || fallback.id,
            label: card.label || fallback.label,
            title: card.title || fallback.title,
            shortText: card.shortText || fallback.shortText,
            fullText: card.fullText.map((line) => line.trim()).filter(Boolean),
            cta: card.cta?.label || card.cta?.href
                ? { label: card.cta?.label || fallback.cta?.label || 'Open', href: card.cta?.href || fallback.cta?.href || '/auth' }
                : fallback.cta,
        };
    }),
});

const moodLabel = (mood: HeroMessageMood) => {
    switch (mood) {
        case 'early': return 'Early Morning';
        case 'morning': return 'Morning';
        case 'afternoon': return 'Afternoon';
        case 'sunset': return 'Sunset';
        case 'evening': return 'Evening';
        case 'night': return 'Night';
    }
};

export const SalesSettingsEditor: React.FC<SalesSettingsEditorProps> = ({ userId, value, onSaved }) => {
    const [feePercent, setFeePercent] = useState(() => String(Math.round(value.platformFeeRate * 100)));
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setFeePercent(String(Math.round(value.platformFeeRate * 100)));
    }, [value.platformFeeRate]);

    const save = async () => {
        const percent = Number(feePercent);
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
            setError('Platform fee must be between 0 and 100.');
            return;
        }

        setSaving(true);
        setStatus(null);
        setError(null);
        try {
            const settings = normalizeSalesSettingsContent({ platformFeeRate: percent / 100 });
            await saveAppContentValue(APP_CONTENT_KEYS.salesSettings, settings, userId);
            onSaved(settings);
            setStatus('Platform fee saved.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save platform fee.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <article className="rdb-panel rdb-panel-wide">
            <div className="rdb-panel-head">
                <div>
                    <h2>Platform Fee</h2>
                    <small>Used for new booking price calculations</small>
                </div>
                <button type="button" className="rdb-inline-link rdb-marketing-save" onClick={() => void save()} disabled={saving}>
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Save fee
                </button>
            </div>
            <label className="rdb-marketing-field rdb-marketing-field-compact">
                <span>Fee percent</span>
                <input type="number" min="0" max="100" step="0.1" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} />
            </label>
            {status && <p className="rdb-marketing-status"><CheckCircle2 size={15} />{status}</p>}
            {error && <p className="rdb-error">{error}</p>}
        </article>
    );
};

export const MarketingContentEditor: React.FC<MarketingContentEditorProps> = ({ userId, mode }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [footerForm, setFooterForm] = useState<FooterForm>(() => footerToForm(DEFAULT_FOOTER_CONTENT));
    const [messageForm, setMessageForm] = useState<Record<HeroMessageMood, string[]>>(() => messagesToForm(DEFAULT_HERO_MESSAGES));
    const [aboutForm, setAboutForm] = useState<AboutPageContent>(() => aboutToForm(DEFAULT_ABOUT_PAGE_CONTENT));

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const content = await getPublicAppContent();
                if (cancelled) return;
                setFooterForm(footerToForm(content.footer));
                setMessageForm(messagesToForm(content.heroMessages));
                setAboutForm(aboutToForm(content.aboutPage));
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load sales content.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const totalGreetingCount = useMemo(() => (
        Object.values(messageForm).reduce((count, values) => count + values.filter((line) => line.trim()).length, 0)
    ), [messageForm]);

    const updateColumnLink = (columnIndex: number, linkIndex: number, patch: Partial<FooterLink>) => {
        setFooterForm((current) => ({
            ...current,
            columns: current.columns.map((column, currentColumnIndex) => (
                currentColumnIndex !== columnIndex
                    ? column
                    : {
                        ...column,
                        links: column.links.map((link, currentLinkIndex) => (
                            currentLinkIndex === linkIndex ? { ...link, ...patch } : link
                        )),
                    }
            )),
        }));
    };

    const addColumnLink = (columnIndex: number) => {
        setFooterForm((current) => ({
            ...current,
            columns: current.columns.map((column, currentColumnIndex) => (
                currentColumnIndex === columnIndex ? { ...column, links: [...column.links, emptyLink()] } : column
            )),
        }));
    };

    const removeColumnLink = (columnIndex: number, linkIndex: number) => {
        setFooterForm((current) => ({
            ...current,
            columns: current.columns.map((column, currentColumnIndex) => (
                currentColumnIndex === columnIndex
                    ? { ...column, links: column.links.filter((_, currentLinkIndex) => currentLinkIndex !== linkIndex) }
                    : column
            )),
        }));
    };

    const updateSocialLink = (linkIndex: number, patch: Partial<FooterLink>) => {
        setFooterForm((current) => ({
            ...current,
            socials: current.socials.map((link, currentIndex) => (
                currentIndex === linkIndex ? { ...link, ...patch } : link
            )),
        }));
    };

    const save = async () => {
        setSaving(true);
        setStatus(null);
        setError(null);
        try {
            if (mode === 'greetings') {
                await saveAppContentValue(APP_CONTENT_KEYS.heroMessages, formToMessages(messageForm), userId);
            } else if (mode === 'about') {
                await saveAppContentValue(APP_CONTENT_KEYS.aboutPage, formToAbout(aboutForm), userId);
            } else {
                await saveAppContentValue(APP_CONTENT_KEYS.footer, formToFooter(footerForm), userId);
            }
            setStatus('Saved successfully.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save sales content.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <section className="rdb-content-grid">
                <article className="rdb-panel rdb-panel-wide">
                    <div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading content...</p></div>
                </article>
            </section>
        );
    }

    return (
        <section className="rdb-content-grid rdb-marketing-content">
            <article className="rdb-panel rdb-panel-wide rdb-editor-toolbar">
                <div className="rdb-panel-head">
                    <div>
                        <h2>{mode === 'greetings' ? 'Edit Greetings' : mode === 'about' ? 'Edit About Page' : 'Edit Contact Info'}</h2>
                        <small>
                            {mode === 'greetings'
                                ? `${totalGreetingCount} greeting texts`
                                : mode === 'about'
                                    ? `${aboutForm.cards.length} bento cards and ${aboutForm.backgroundImages.length} backgrounds`
                                    : 'Footer labels, links, contact, and socials'}
                        </small>
                    </div>
                    <button type="button" className="rdb-inline-link rdb-marketing-save" onClick={() => void save()} disabled={saving}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save changes
                    </button>
                </div>

                {status && <p className="rdb-marketing-status"><CheckCircle2 size={15} />{status}</p>}
                {error && <p className="rdb-error">{error}</p>}
            </article>

            {mode === 'contact' && (
                <>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Brand Footer</h2>
                            <small>Shown at the bottom of the public landing page</small>
                        </div>
                        <div className="rdb-marketing-form-grid">
                            <label className="rdb-marketing-field rdb-marketing-field-wide">
                                <span>Brand text</span>
                                <textarea value={footerForm.description} onChange={(e) => setFooterForm((current) => ({ ...current, description: e.target.value }))} />
                            </label>
                            <label className="rdb-marketing-field rdb-marketing-field-wide">
                                <span>Copyright</span>
                                <input value={footerForm.copyright} onChange={(e) => setFooterForm((current) => ({ ...current, copyright: e.target.value }))} />
                            </label>
                        </div>
                    </article>

                    {footerForm.columns.map((column, columnIndex) => (
                        <article className="rdb-panel rdb-panel-wide rdb-editor-card" key={`footer-col-${columnIndex}`}>
                            <div className="rdb-editor-card-head">
                                <label className="rdb-marketing-field">
                                    <span>Footer section label</span>
                                    <input
                                        value={column.title}
                                        onChange={(e) => setFooterForm((current) => ({
                                            ...current,
                                            columns: current.columns.map((item, index) => index === columnIndex ? { ...item, title: e.target.value } : item),
                                        }))}
                                    />
                                </label>
                                <button type="button" className="rdb-editor-add-btn" onClick={() => addColumnLink(columnIndex)}>
                                    <Plus size={15} />
                                    Add item
                                </button>
                            </div>

                            <div className="rdb-editor-row-list">
                                {column.links.map((link, linkIndex) => (
                                    <div className="rdb-editor-row" key={`footer-${columnIndex}-${linkIndex}`}>
                                        <label className="rdb-marketing-field">
                                            <span>Label</span>
                                            <input value={link.label} onChange={(e) => updateColumnLink(columnIndex, linkIndex, { label: e.target.value })} />
                                        </label>
                                        <label className="rdb-marketing-field">
                                            <span>Link</span>
                                            <input value={link.href || ''} onChange={(e) => updateColumnLink(columnIndex, linkIndex, { href: e.target.value })} placeholder="https://, mailto:, tel:, /page, or #section" />
                                        </label>
                                        <button type="button" className="rdb-editor-icon-btn" onClick={() => removeColumnLink(columnIndex, linkIndex)} aria-label="Remove footer item">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}

                    <article className="rdb-panel rdb-panel-wide rdb-editor-card">
                        <div className="rdb-editor-card-head">
                            <div>
                                <h2>Social Media</h2>
                                <small>Accounts shown as icons in the footer</small>
                            </div>
                            <button type="button" className="rdb-editor-add-btn" onClick={() => setFooterForm((current) => ({ ...current, socials: [...current.socials, emptyLink()] }))}>
                                <Plus size={15} />
                                Add social
                            </button>
                        </div>
                        <div className="rdb-editor-row-list">
                            {footerForm.socials.map((link, linkIndex) => (
                                <div className="rdb-editor-row" key={`social-${linkIndex}`}>
                                    <label className="rdb-marketing-field">
                                        <span>Platform</span>
                                        <input value={link.label} onChange={(e) => updateSocialLink(linkIndex, { label: e.target.value })} />
                                    </label>
                                    <label className="rdb-marketing-field">
                                        <span>Profile link</span>
                                        <input value={link.href || ''} onChange={(e) => updateSocialLink(linkIndex, { href: e.target.value })} />
                                    </label>
                                    <button
                                        type="button"
                                        className="rdb-editor-icon-btn"
                                        onClick={() => setFooterForm((current) => ({ ...current, socials: current.socials.filter((_, index) => index !== linkIndex) }))}
                                        aria-label="Remove social link"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </article>
                </>
            )}

            {mode === 'greetings' && (
                <div className="rdb-greeting-grid">
                    {HERO_MESSAGE_MOODS.map((mood) => (
                        <article className="rdb-panel rdb-editor-card" key={mood}>
                            <div className="rdb-editor-card-head">
                                <div>
                                    <h2>{moodLabel(mood)}</h2>
                                    <small>{messageForm[mood].filter((line) => line.trim()).length} active</small>
                                </div>
                                <button
                                    type="button"
                                    className="rdb-editor-add-btn"
                                    onClick={() => setMessageForm((current) => ({ ...current, [mood]: [...current[mood], ''] }))}
                                >
                                    <Plus size={15} />
                                    Add
                                </button>
                            </div>
                            <div className="rdb-editor-row-list">
                                {messageForm[mood].map((message, index) => (
                                    <div className="rdb-editor-row rdb-editor-row--single" key={`${mood}-${index}`}>
                                        <label className="rdb-marketing-field">
                                            <span>Greeting {index + 1}</span>
                                            <input
                                                value={message}
                                                onChange={(e) => setMessageForm((current) => ({
                                                    ...current,
                                                    [mood]: current[mood].map((item, itemIndex) => itemIndex === index ? e.target.value : item),
                                                }))}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            className="rdb-editor-icon-btn"
                                            onClick={() => setMessageForm((current) => ({
                                                ...current,
                                                [mood]: current[mood].filter((_, itemIndex) => itemIndex !== index),
                                            }))}
                                            aria-label="Remove greeting"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {mode === 'about' && (
                <>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>About Hero</h2>
                            <small>Shown beside the interactive bento grid</small>
                        </div>
                        <div className="rdb-marketing-form-grid">
                            <label className="rdb-marketing-field">
                                <span>Eyebrow</span>
                                <input value={aboutForm.eyebrow} onChange={(e) => setAboutForm((current) => ({ ...current, eyebrow: e.target.value }))} />
                            </label>
                            <label className="rdb-marketing-field">
                                <span>Title</span>
                                <input value={aboutForm.title} onChange={(e) => setAboutForm((current) => ({ ...current, title: e.target.value }))} />
                            </label>
                            <label className="rdb-marketing-field rdb-marketing-field-wide">
                                <span>Subtitle</span>
                                <textarea value={aboutForm.subtitle} onChange={(e) => setAboutForm((current) => ({ ...current, subtitle: e.target.value }))} />
                            </label>
                            <label className="rdb-marketing-field rdb-marketing-field-wide">
                                <span>Random background image URLs, one per line</span>
                                <textarea
                                    value={aboutForm.backgroundImages.join('\n')}
                                    onChange={(e) => setAboutForm((current) => ({
                                        ...current,
                                        backgroundImages: e.target.value.split('\n'),
                                    }))}
                                />
                            </label>
                        </div>
                    </article>

                    {aboutForm.cards.map((card, cardIndex) => (
                        <article className="rdb-panel rdb-panel-wide rdb-editor-card" key={card.id || cardIndex}>
                            <div className="rdb-editor-card-head">
                                <div>
                                    <h2>{card.title || `Card ${cardIndex + 1}`}</h2>
                                    <small>Interactive bento tile {cardIndex + 1}</small>
                                </div>
                            </div>
                            <div className="rdb-marketing-form-grid">
                                <label className="rdb-marketing-field">
                                    <span>ID</span>
                                    <input
                                        value={card.id}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, id: e.target.value } : item),
                                        }))}
                                    />
                                </label>
                                <label className="rdb-marketing-field">
                                    <span>Label</span>
                                    <input
                                        value={card.label}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, label: e.target.value } : item),
                                        }))}
                                    />
                                </label>
                                <label className="rdb-marketing-field">
                                    <span>Title</span>
                                    <input
                                        value={card.title}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, title: e.target.value } : item),
                                        }))}
                                    />
                                </label>
                                <label className="rdb-marketing-field">
                                    <span>Metric, optional</span>
                                    <input
                                        value={card.metric || ''}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, metric: e.target.value } : item),
                                        }))}
                                    />
                                </label>
                                <label className="rdb-marketing-field rdb-marketing-field-wide">
                                    <span>Short text</span>
                                    <textarea
                                        value={card.shortText}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, shortText: e.target.value } : item),
                                        }))}
                                    />
                                </label>
                                <label className="rdb-marketing-field rdb-marketing-field-wide">
                                    <span>Full expanded text, one paragraph per line</span>
                                    <textarea
                                        value={card.fullText.join('\n')}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, fullText: e.target.value.split('\n') } : item),
                                        }))}
                                    />
                                </label>
                                <label className="rdb-marketing-field">
                                    <span>CTA label</span>
                                    <input
                                        value={card.cta?.label || ''}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, cta: { ...(item.cta || {}), label: e.target.value } } as AboutPageCard : item),
                                        }))}
                                    />
                                </label>
                                <label className="rdb-marketing-field">
                                    <span>CTA link</span>
                                    <input
                                        value={card.cta?.href || ''}
                                        onChange={(e) => setAboutForm((current) => ({
                                            ...current,
                                            cards: current.cards.map((item, index) => index === cardIndex ? { ...item, cta: { ...(item.cta || {}), href: e.target.value } } as AboutPageCard : item),
                                        }))}
                                    />
                                </label>
                            </div>
                        </article>
                    ))}
                </>
            )}
        </section>
    );
};
