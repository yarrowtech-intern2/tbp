import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Loader2, MessageCircle, Send, Share2, Trash2 } from 'lucide-react';
import { SEOHead } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { deleteBlog, getBlogBySlug, type BlogPost } from '../lib/blogs';
import { renderBlogContentBlocks } from '../lib/blogContent';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd, getSiteUrl } from '../lib/seo';
import './blogs.css';

const formatDate = (value: string) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
};

const buildArticleJsonLd = (blog: BlogPost) => {
    const siteUrl = getSiteUrl();
    const path = `/blogs/${blog.slug}`;
    const articleJsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: blog.title,
        description: blog.excerpt,
        image: blog.cover_image_url,
        datePublished: blog.published_at,
        dateModified: blog.updated_at,
        author: {
            '@type': 'Person',
            name: blog.author_name,
        },
        publisher: { '@id': `${siteUrl}/#organization` },
        mainEntityOfPage: `${siteUrl}${path}`,
    };

    if (blog.location) {
        articleJsonLd.contentLocation = {
            '@type': 'Place',
            name: blog.location,
        };
    }

    return [
        buildOrganizationJsonLd(siteUrl),
        articleJsonLd,
        buildBreadcrumbJsonLd(path, blog.title, siteUrl),
    ];
};

const formatBlogMeta = (blog: BlogPost) => (
    [blog.category, blog.location, formatDate(blog.published_at)].filter(Boolean).join(' / ')
);

export const BlogDetail: React.FC = () => {
    const { slug } = useParams();
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    const [blog, setBlog] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shareUrl, setShareUrl] = useState('');
    const [shareStatus, setShareStatus] = useState('');
    const [deleting, setDeleting] = useState(false);

    const content = useMemo(
        () => blog ? renderBlogContentBlocks(blog.content, blog.content_image_urls) : null,
        [blog]
    );

    useEffect(() => {
        if (!slug) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        void getBlogBySlug(slug)
            .then((item) => {
                if (!cancelled) setBlog(item);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load blog.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [slug]);

    useEffect(() => {
        if (typeof window !== 'undefined') setShareUrl(window.location.href);
    }, [slug]);

    const copyShareLink = async () => {
        if (!blog) return;
        const url = shareUrl || `${getSiteUrl()}/blogs/${blog.slug}`;
        try {
            await navigator.clipboard.writeText(url);
            setShareStatus('Link copied');
        } catch {
            setShareStatus('Copy failed');
        }
    };

    const handleNativeShare = async () => {
        if (!blog) return;
        const url = shareUrl || `${getSiteUrl()}/blogs/${blog.slug}`;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: blog.title,
                    text: blog.excerpt,
                    url,
                });
                setShareStatus('');
                return;
            }
            await copyShareLink();
        } catch {
            setShareStatus('');
        }
    };

    const handleDelete = async () => {
        if (!blog || deleting || !isAdmin) return;
        const confirmed = window.confirm(`Delete "${blog.title}"? This cannot be undone.`);
        if (!confirmed) return;

        setDeleting(true);
        setError(null);
        try {
            await deleteBlog(blog.id);
            navigate('/blogs', { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete blog.');
        } finally {
            setDeleting(false);
        }
    };

    if (!slug) return <Navigate to="/blogs" replace />;

    if (loading) {
        return (
            <main className="blogs-page blogs-page--detail">
                <div className="blogs-loading">
                    <Loader2 className="animate-spin" size={22} />
                    <span>Loading blog</span>
                </div>
            </main>
        );
    }

    if (!blog) {
        return (
            <main className="blogs-page blogs-page--detail">
                <section className="blogs-empty">
                    <h1>Blog not found.</h1>
                    <Link to="/blogs" className="blogs-write-btn">
                        <ArrowLeft size={18} />
                        <span>All Blogs</span>
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main className="blogs-page blogs-page--detail">
            <SEOHead
                title={`${blog.title} | The Better Pass Blog`}
                description={blog.excerpt}
                path={`/blogs/${blog.slug}`}
                type="article"
                image={blog.cover_image_url}
                jsonLd={buildArticleJsonLd(blog)}
            />

            <article className="blog-article">
                <header className="blog-article-header">
                    <Link to="/blogs" className="blog-back-link">
                        <ArrowLeft size={18} />
                        <span>Blogs</span>
                    </Link>
                    <p className="blogs-meta">{formatBlogMeta(blog)}</p>
                    <h1>{blog.title}</h1>
                    <p>{blog.excerpt}</p>
                    <div className="blog-author-row">
                        {blog.author_avatar_url ? <img src={blog.author_avatar_url} alt="" /> : null}
                        <span>By {blog.author_name}</span>
                    </div>
                    <div className="blog-share-row" aria-label="Share blog">
                        <button type="button" className="blog-share-btn" onClick={() => void handleNativeShare()}>
                            <Share2 size={16} />
                            <span>Apps</span>
                        </button>
                        <a
                            className="blog-share-btn"
                            href={`https://wa.me/?text=${encodeURIComponent(`${blog.title} ${shareUrl || `${getSiteUrl()}/blogs/${blog.slug}`}`)}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <MessageCircle size={16} />
                            <span>WhatsApp</span>
                        </a>
                        <a
                            className="blog-share-btn"
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl || `${getSiteUrl()}/blogs/${blog.slug}`)}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Send size={16} />
                            <span>Facebook</span>
                        </a>
                        <a
                            className="blog-share-btn"
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(blog.title)}&url=${encodeURIComponent(shareUrl || `${getSiteUrl()}/blogs/${blog.slug}`)}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Send size={16} />
                            <span>X</span>
                        </a>
                        <a
                            className="blog-share-btn"
                            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl || `${getSiteUrl()}/blogs/${blog.slug}`)}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Send size={16} />
                            <span>LinkedIn</span>
                        </a>
                        <button type="button" className="blog-share-btn" onClick={() => void copyShareLink()}>
                            <Copy size={16} />
                            <span>Copy</span>
                        </button>
                    </div>
                    {shareStatus && <p className="blog-share-status">{shareStatus}</p>}
                    {isAdmin && (
                        <button
                            type="button"
                            className="blogs-delete-btn blogs-delete-btn--article"
                            disabled={deleting}
                            onClick={() => void handleDelete()}
                        >
                            <Trash2 size={16} />
                            <span>{deleting ? 'Deleting' : 'Delete Blog'}</span>
                        </button>
                    )}
                    {error && <p className="blogs-alert">{error}</p>}
                </header>

                <figure className="blog-cover">
                    <img src={blog.cover_image_url} alt={blog.title} />
                </figure>

                <div className="blog-content">
                    {content}
                </div>

                {blog.tags.length > 0 && (
                    <footer className="blog-tags" aria-label="Blog tags">
                        {blog.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                        ))}
                    </footer>
                )}
            </article>
        </main>
    );
};
