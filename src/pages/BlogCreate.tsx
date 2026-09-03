import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { SEOHead } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { createBlog, parseBlogTags } from '../lib/blogs';
import { uploadCloudinaryImage } from '../lib/cloudinaryUpload';
import { renderBlogContentBlocks } from '../lib/blogContent';
import './blogs.css';

const BLOG_CATEGORIES = [
    'Travel Guide',
    'Destination',
    'Food',
    'Culture',
    'Adventure',
    'Planning',
];

const BLOG_DRAFT_STORAGE_KEY = 'tbp:blog-draft:v1';

type BlogCreateDraft = {
    title: string;
    excerpt: string;
    content: string;
    category: string;
    tags: string;
    coverImageUrl: string;
    coverImageName: string;
    contentImageUrls: string[];
    contentImageNames: string[];
};

const DEFAULT_BLOG_DRAFT: BlogCreateDraft = {
    title: '',
    excerpt: '',
    content: '',
    category: BLOG_CATEGORIES[0],
    tags: '',
    coverImageUrl: '',
    coverImageName: '',
    contentImageUrls: [],
    contentImageNames: [],
};

const readBlogDraft = (): BlogCreateDraft => {
    if (typeof window === 'undefined') return DEFAULT_BLOG_DRAFT;
    try {
        const raw = window.localStorage.getItem(BLOG_DRAFT_STORAGE_KEY);
        if (!raw) return DEFAULT_BLOG_DRAFT;
        const parsed = JSON.parse(raw) as Partial<BlogCreateDraft>;
        return {
            ...DEFAULT_BLOG_DRAFT,
            ...parsed,
            category: parsed.category && BLOG_CATEGORIES.includes(parsed.category)
                ? parsed.category
                : DEFAULT_BLOG_DRAFT.category,
            contentImageUrls: Array.isArray(parsed.contentImageUrls) ? parsed.contentImageUrls.filter(Boolean) : [],
            contentImageNames: Array.isArray(parsed.contentImageNames) ? parsed.contentImageNames.filter(Boolean) : [],
        };
    } catch {
        return DEFAULT_BLOG_DRAFT;
    }
};

const writeBlogDraft = (draft: BlogCreateDraft) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BLOG_DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

const clearBlogDraft = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(BLOG_DRAFT_STORAGE_KEY);
};

export const BlogCreate: React.FC = () => {
    const initialDraft = useMemo(() => readBlogDraft(), []);
    const { user, profile, loading } = useAuth();
    const navigate = useNavigate();
    const [title, setTitle] = useState(initialDraft.title);
    const [excerpt, setExcerpt] = useState(initialDraft.excerpt);
    const [content, setContent] = useState(initialDraft.content);
    const [category, setCategory] = useState(initialDraft.category);
    const [tags, setTags] = useState(initialDraft.tags);
    const [coverImageUrl, setCoverImageUrl] = useState(initialDraft.coverImageUrl);
    const [coverImageName, setCoverImageName] = useState(initialDraft.coverImageName);
    const [contentImageUrls, setContentImageUrls] = useState<string[]>(initialDraft.contentImageUrls);
    const [contentImageNames, setContentImageNames] = useState<string[]>(initialDraft.contentImageNames);
    const [coverUploading, setCoverUploading] = useState(false);
    const [contentUploading, setContentUploading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState<string | null>(null);

    const previewBlocks = useMemo(
        () => renderBlogContentBlocks(content, contentImageUrls),
        [content, contentImageUrls]
    );
    const imageUploading = coverUploading || contentUploading;

    useEffect(() => {
        writeBlogDraft({
            title,
            excerpt,
            content,
            category,
            tags,
            coverImageUrl,
            coverImageName,
            contentImageUrls,
            contentImageNames,
        });
    }, [category, content, contentImageNames, contentImageUrls, coverImageName, coverImageUrl, excerpt, tags, title]);

    if (!loading && !user) return <Navigate to="/login" replace />;

    const authorName = profile?.full_name?.trim()
        || user?.email?.split('@')[0]
        || 'The Better Pass member';

    const uploadCoverImage = async (file: File | undefined) => {
        if (!file || coverUploading) return;
        setCoverUploading(true);
        setError(null);
        setStatus('Uploading cover image');
        try {
            const url = await uploadCloudinaryImage(file, {
                folder: 'blogs/covers',
                fileNamePrefix: 'blog-cover',
                tags: ['blog', 'cover'],
            });
            setCoverImageUrl(url);
            setCoverImageName(file.name);
            setStatus('Cover image uploaded');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not upload cover image.');
            setStatus('');
        } finally {
            setCoverUploading(false);
        }
    };

    const uploadContentImages = async (files: File[]) => {
        if (!files.length || contentUploading) return;
        const remainingSlots = Math.max(0, 8 - contentImageUrls.length);
        const nextFiles = files.slice(0, remainingSlots);
        if (!nextFiles.length) {
            setError('You can add up to 8 content images.');
            return;
        }

        setContentUploading(true);
        setError(null);
        try {
            const uploadedUrls: string[] = [];
            const uploadedNames: string[] = [];
            for (const [index, file] of nextFiles.entries()) {
                setStatus(`Uploading content image ${index + 1} of ${nextFiles.length}`);
                const url = await uploadCloudinaryImage(file, {
                    folder: 'blogs/content',
                    fileNamePrefix: 'blog-content',
                    tags: ['blog', 'content'],
                });
                uploadedUrls.push(url);
                uploadedNames.push(file.name);
            }
            setContentImageUrls((current) => [...current, ...uploadedUrls]);
            setContentImageNames((current) => [...current, ...uploadedNames]);
            setStatus('Content images uploaded');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not upload content images.');
            setStatus('');
        } finally {
            setContentUploading(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user || publishing || imageUploading) return;
        if (!coverImageUrl) {
            setError('Add a cover image before publishing.');
            return;
        }

        setPublishing(true);
        setError(null);
        setStatus('Publishing blog');

        try {
            const blog = await createBlog({
                authorId: user.id,
                authorName,
                authorAvatarUrl: profile?.profile_image_url || null,
                title,
                excerpt,
                content,
                category,
                tags: parseBlogTags(tags),
                coverImageUrl,
                contentImageUrls,
            });

            clearBlogDraft();
            navigate(`/blogs/${blog.slug}`, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not publish blog.');
            setStatus('');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <main className="blogs-page blog-create-page">
            <SEOHead
                title="Write Blog | The Better Pass"
                description="Create a travel blog post for The Better Pass."
                path="/blogs/new"
                noindex
            />

            <section className="blog-create-shell">
                <form className="blog-create-form" onSubmit={(event) => void handleSubmit(event)}>
                    <div className="blog-create-heading">
                        <p className="blogs-eyebrow">Write Blog</p>
                        <h1>Publish a travel story.</h1>
                    </div>

                    <label className="blog-field">
                        <span>Title</span>
                        <input
                            type="text"
                            required
                            maxLength={110}
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="A slow morning through Old Srinagar"
                        />
                    </label>

                    <label className="blog-field">
                        <span>Excerpt</span>
                        <textarea
                            required
                            maxLength={220}
                            value={excerpt}
                            onChange={(event) => setExcerpt(event.target.value)}
                            placeholder="A short summary for readers and search results."
                            rows={3}
                        />
                    </label>

                    <div className="blog-form-grid">
                        <label className="blog-field">
                            <span>Category</span>
                            <select value={category} onChange={(event) => setCategory(event.target.value)}>
                                {BLOG_CATEGORIES.map((item) => (
                                    <option value={item} key={item}>{item}</option>
                                ))}
                            </select>
                        </label>

                        <label className="blog-field">
                            <span>Tags</span>
                            <input
                                type="text"
                                value={tags}
                                onChange={(event) => setTags(event.target.value)}
                                placeholder="Kashmir, food walk, heritage"
                            />
                        </label>
                    </div>

                    <div className="blog-upload-row">
                        <label className="blog-upload">
                            <input
                                type="file"
                                accept="image/*"
                                disabled={coverUploading}
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.currentTarget.value = '';
                                    void uploadCoverImage(file);
                                }}
                            />
                            {coverUploading ? <Loader2 className="animate-spin" size={19} /> : <ImagePlus size={19} />}
                            <span>{coverImageName || 'Cover image'}</span>
                        </label>
                        {coverImageUrl && (
                            <button
                                type="button"
                                className="blog-clear-image-btn"
                                onClick={() => {
                                    setCoverImageUrl('');
                                    setCoverImageName('');
                                }}
                                aria-label="Remove cover image"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="blog-upload-row">
                        <label className="blog-upload">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={contentUploading}
                                onChange={(event) => {
                                    const files = Array.from(event.target.files || []);
                                    event.currentTarget.value = '';
                                    void uploadContentImages(files);
                                }}
                            />
                            {contentUploading ? <Loader2 className="animate-spin" size={19} /> : <ImagePlus size={19} />}
                            <span>{contentImageUrls.length ? `${contentImageUrls.length} content image${contentImageUrls.length === 1 ? '' : 's'} uploaded` : 'Content images'}</span>
                        </label>
                        {contentImageUrls.length > 0 && (
                            <button
                                type="button"
                                className="blog-clear-image-btn"
                                onClick={() => {
                                    setContentImageUrls([]);
                                    setContentImageNames([]);
                                }}
                                aria-label="Clear content images"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <label className="blog-field">
                        <span>Content</span>
                        <textarea
                            required
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder={'## First light\nWrite the story in short paragraphs.\n\n### Local detail\nAdd another section.'}
                            rows={13}
                        />
                    </label>

                    {error && <p className="blogs-alert">{error}</p>}
                    {status && <p className="blog-status">{status}</p>}

                    <button type="submit" className="blog-publish-btn" disabled={publishing || imageUploading}>
                        {publishing ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                        <span>{publishing ? 'Publishing' : 'Publish Blog'}</span>
                    </button>
                </form>

                <aside className="blog-create-preview" aria-label="Blog preview">
                    {coverImageUrl ? (
                        <img className="blog-preview-cover" src={coverImageUrl} alt="" />
                    ) : (
                        <div className="blog-preview-cover blog-preview-cover--empty" />
                    )}
                    <h2>{title || 'Blog title'}</h2>
                    <p>{excerpt || 'Your excerpt will appear here.'}</p>
                    <div className="blog-preview-content">
                        {content ? previewBlocks : <p>Start writing to see the article rhythm.</p>}
                    </div>
                </aside>
            </section>
        </main>
    );
};
