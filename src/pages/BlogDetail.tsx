import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Home, Loader2, MapPin, MessageCircle, PenLine, Search, Send, Trash2, UserCircle2 } from 'lucide-react';
import { SEOHead } from '../components/SEO';
import { LiquidMobileNav, type LiquidNavItem } from '../components/ui/liquid-mobile-nav';
import { MOBILE_NAV_ICON_SRC } from '../components/ui/mobile-nav-icon-map';
import { useAuth } from '../hooks/useAuth';
import {
    createBlogComment,
    deleteBlog,
    deleteBlogComment,
    getBlogBySlug,
    getBlogComments,
    setBlogCommentVote,
    setBlogVote,
    updateBlogComment,
    type BlogComment,
    type BlogCommentSort,
    type BlogPost,
    type BlogVoteValue,
} from '../lib/blogs';
import { renderBlogContentBlocks } from '../lib/blogContent';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd, getSiteUrl } from '../lib/seo';
import './blogs.css';

type BlogMobileNavKey = 'home' | 'explore' | 'blogs' | 'map' | 'profile';

const BLOG_MOBILE_NAV_ITEMS: Array<{ key: BlogMobileNavKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'explore', label: 'Explore', icon: Search },
    { key: 'blogs', label: 'Blogs', icon: PenLine },
    { key: 'map', label: 'Map', icon: MapPin },
    { key: 'profile', label: 'Profile', icon: UserCircle2 },
];

const BLOG_ACTION_ICONS = {
    like: '/icons/mobile-nav-icons/blogs/like.webp',
    dislike: '/icons/mobile-nav-icons/blogs/dislike.webp',
    comment: '/icons/mobile-nav-icons/blogs/comment.webp',
    share: '/icons/mobile-nav-icons/blogs/share.webp',
};

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

const sortCommentList = (items: BlogComment[], sort: BlogCommentSort): BlogComment[] => {
    const next = [...items];
    if (sort === 'oldest') {
        return next.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    }
    if (sort === 'popular') {
        return next.sort((a, b) => {
            const scoreA = a.upvote_count - a.downvote_count;
            const scoreB = b.upvote_count - b.downvote_count;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
    }
    return next.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
};

export const BlogDetail: React.FC = () => {
    const { slug } = useParams();
    const { user, profile, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [blog, setBlog] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shareUrl, setShareUrl] = useState('');
    const [shareStatus, setShareStatus] = useState('');
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [comments, setComments] = useState<BlogComment[]>([]);
    const [commentSort, setCommentSort] = useState<BlogCommentSort>('popular');
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [commentError, setCommentError] = useState<string | null>(null);
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
    const [votingBlog, setVotingBlog] = useState(false);

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

    useEffect(() => {
        if (!shareModalOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShareModalOpen(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shareModalOpen]);

    useEffect(() => {
        if (!blog?.id) return;
        let cancelled = false;
        setCommentsLoading(true);
        setCommentError(null);

        void getBlogComments(blog.id, commentSort)
            .then((items) => {
                if (!cancelled) setComments(items);
            })
            .catch((err) => {
                if (!cancelled) setCommentError(err instanceof Error ? err.message : 'Could not load comments.');
            })
            .finally(() => {
                if (!cancelled) setCommentsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [blog?.id, commentSort]);

    const blogShareUrl = blog ? shareUrl || `${getSiteUrl()}/blogs/${blog.slug}` : '';
    const blogShareText = blog ? `${blog.title} ${blogShareUrl}` : '';

    const copyShareLink = async () => {
        if (!blog) return;
        try {
            await navigator.clipboard.writeText(blogShareUrl);
            setShareStatus('Link copied');
        } catch {
            setShareStatus('Copy failed');
        }
    };

    const handleNativeShare = async () => {
        if (!blog) return;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: blog.title,
                    text: blog.excerpt,
                    url: blogShareUrl,
                });
                setShareModalOpen(false);
                setShareStatus('');
                return;
            }
            await copyShareLink();
            setShareModalOpen(false);
        } catch {
            setShareStatus('');
        }
    };

    const openShareUrl = (url: string) => {
        if (typeof window === 'undefined') return;
        window.open(url, '_blank', 'noopener,noreferrer');
        setShareModalOpen(false);
    };

    const handleCopyShare = async () => {
        await copyShareLink();
        setShareModalOpen(false);
    };

    const scrollToComments = () => {
        document.getElementById('blog-comments-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleMobileNav = (key: BlogMobileNavKey) => {
        if (key === 'home') {
            navigate('/');
            return;
        }
        if (key === 'explore') {
            navigate(user ? '/explore' : '/login');
            return;
        }
        if (key === 'blogs') {
            navigate('/blogs');
            return;
        }
        if (key === 'map') {
            navigate('/map');
            return;
        }
        navigate(user ? '/profile' : '/login');
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

    const handleBlogVote = async (voteValue: BlogVoteValue) => {
        if (!blog) return;
        if (!user) {
            navigate('/login');
            return;
        }
        if (votingBlog) return;

        setVotingBlog(true);
        setError(null);
        try {
            const nextVote = blog.user_vote === voteValue ? null : voteValue;
            const summary = await setBlogVote(blog.id, nextVote);
            setBlog((current) => current ? { ...current, ...summary } : current);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save your vote.');
        } finally {
            setVotingBlog(false);
        }
    };

    const handleCreateComment = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!blog || commentSubmitting) return;
        if (!user) {
            navigate('/login');
            return;
        }

        const authorName = profile?.full_name?.trim()
            || user.email?.split('@')[0]
            || 'The Better Pass member';

        setCommentSubmitting(true);
        setCommentError(null);
        try {
            const comment = await createBlogComment({
                blogId: blog.id,
                content: commentText,
                authorName,
                authorAvatarUrl: profile?.profile_image_url || null,
            });
            setCommentText('');
            setComments((current) => sortCommentList([comment, ...current], commentSort));
            setBlog((current) => current ? { ...current, comment_count: current.comment_count + 1 } : current);
        } catch (err) {
            setCommentError(err instanceof Error ? err.message : 'Could not post your comment.');
        } finally {
            setCommentSubmitting(false);
        }
    };

    const startEditingComment = (comment: BlogComment) => {
        setEditingCommentId(comment.id);
        setEditingText(comment.content);
        setCommentError(null);
    };

    const handleUpdateComment = async (commentId: string) => {
        if (busyCommentId) return;
        setBusyCommentId(commentId);
        setCommentError(null);
        try {
            const updated = await updateBlogComment(commentId, editingText);
            setComments((current) => sortCommentList(current.map((comment) => (
                comment.id === commentId ? { ...comment, ...updated } : comment
            )), commentSort));
            setEditingCommentId(null);
            setEditingText('');
        } catch (err) {
            setCommentError(err instanceof Error ? err.message : 'Could not update comment.');
        } finally {
            setBusyCommentId(null);
        }
    };

    const handleDeleteComment = async (comment: BlogComment) => {
        if (busyCommentId) return;
        const confirmed = window.confirm('Delete this comment?');
        if (!confirmed) return;

        setBusyCommentId(comment.id);
        setCommentError(null);
        try {
            await deleteBlogComment(comment.id);
            setComments((current) => current.filter((item) => item.id !== comment.id));
            setBlog((current) => current ? { ...current, comment_count: Math.max(0, current.comment_count - 1) } : current);
        } catch (err) {
            setCommentError(err instanceof Error ? err.message : 'Could not delete comment.');
        } finally {
            setBusyCommentId(null);
        }
    };

    const handleCommentVote = async (comment: BlogComment, voteValue: BlogVoteValue) => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (busyCommentId) return;

        setBusyCommentId(comment.id);
        setCommentError(null);
        try {
            const nextVote = comment.user_vote === voteValue ? null : voteValue;
            const summary = await setBlogCommentVote(comment.id, nextVote);
            setComments((current) => sortCommentList(current.map((item) => (
                item.id === comment.id ? { ...item, ...summary } : item
            )), commentSort));
        } catch (err) {
            setCommentError(err instanceof Error ? err.message : 'Could not save your vote.');
        } finally {
            setBusyCommentId(null);
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
                    <div className="blog-vote-row" aria-label="Blog votes and comments">
                        <button
                            type="button"
                            className={blog.user_vote === 1 ? 'is-active' : ''}
                            disabled={votingBlog}
                            onClick={() => void handleBlogVote(1)}
                            aria-label="Upvote blog"
                        >
                            <img src={BLOG_ACTION_ICONS.like} alt="" aria-hidden="true" />
                            <span>{blog.upvote_count}</span>
                        </button>
                        <button
                            type="button"
                            className={blog.user_vote === -1 ? 'is-active' : ''}
                            disabled={votingBlog}
                            onClick={() => void handleBlogVote(-1)}
                            aria-label="Downvote blog"
                        >
                            <img src={BLOG_ACTION_ICONS.dislike} alt="" aria-hidden="true" />
                            <span>{blog.downvote_count}</span>
                        </button>
                        <button
                            type="button"
                            className="blog-comment-count"
                            onClick={scrollToComments}
                            aria-label={`${blog.comment_count} comments`}
                        >
                            <img src={BLOG_ACTION_ICONS.comment} alt="" aria-hidden="true" />
                            <span>{blog.comment_count}</span>
                        </button>
                        <button
                            type="button"
                            className="blog-share-trigger"
                            onClick={() => {
                                setShareStatus('');
                                setShareModalOpen(true);
                            }}
                            aria-label="Share blog"
                        >
                            <img src={BLOG_ACTION_ICONS.share} alt="" aria-hidden="true" />
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

            <section className="blog-comments-section" aria-labelledby="blog-comments-title">
                <div className="blog-comments-head">
                    <div>
                        <p className="blogs-eyebrow">Discussion</p>
                        <h2 id="blog-comments-title">Comments</h2>
                    </div>
                    <div className="blog-comment-sort" aria-label="Sort comments">
                        {(['popular', 'newest', 'oldest'] as const).map((sortOption) => (
                            <button
                                key={sortOption}
                                type="button"
                                className={commentSort === sortOption ? 'is-active' : ''}
                                onClick={() => setCommentSort(sortOption)}
                            >
                                {sortOption}
                            </button>
                        ))}
                    </div>
                </div>

                {user ? (
                    <form className="blog-comment-form" onSubmit={(event) => void handleCreateComment(event)}>
                        <textarea
                            value={commentText}
                            onChange={(event) => setCommentText(event.target.value)}
                            placeholder="Add your comment"
                            maxLength={2000}
                            rows={3}
                        />
                        <button type="submit" disabled={commentSubmitting || !commentText.trim()}>
                            {commentSubmitting ? <Loader2 className="animate-spin" size={16} /> : <PenLine size={16} />}
                            <span>{commentSubmitting ? 'Posting' : 'Post'}</span>
                        </button>
                    </form>
                ) : (
                    <div className="blog-comment-login">
                        <span>Log in to comment or vote.</span>
                        <button type="button" onClick={() => navigate('/login')}>Log in</button>
                    </div>
                )}

                {commentError && <p className="blogs-alert">{commentError}</p>}

                {commentsLoading ? (
                    <div className="blogs-loading blog-comments-loading">
                        <Loader2 className="animate-spin" size={20} />
                        <span>Loading comments</span>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="blogs-empty blog-comments-empty">
                        <h2>No comments yet.</h2>
                        <p>Start the conversation with a useful thought.</p>
                    </div>
                ) : (
                    <div className="blog-comments-list">
                        {comments.map((comment) => {
                            const canManageComment = isAdmin || comment.user_id === user?.id;
                            const isEditing = editingCommentId === comment.id;
                            return (
                                <article className="blog-comment-card" key={comment.id}>
                                    <div className="blog-comment-top">
                                        <div className="blog-comment-author">
                                            {comment.author_avatar_url ? <img src={comment.author_avatar_url} alt="" /> : <span aria-hidden="true" />}
                                            <div>
                                                <strong>{comment.author_name}</strong>
                                                <small>{formatDate(comment.created_at)}</small>
                                            </div>
                                        </div>
                                        {canManageComment && (
                                            <div className="blog-comment-tools">
                                                <button type="button" onClick={() => startEditingComment(comment)}>Edit</button>
                                                <button type="button" onClick={() => void handleDeleteComment(comment)}>Delete</button>
                                            </div>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <div className="blog-comment-edit">
                                            <textarea
                                                value={editingText}
                                                onChange={(event) => setEditingText(event.target.value)}
                                                maxLength={2000}
                                                rows={3}
                                            />
                                            <div>
                                                <button type="button" onClick={() => {
                                                    setEditingCommentId(null);
                                                    setEditingText('');
                                                }}>
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busyCommentId === comment.id || !editingText.trim()}
                                                    onClick={() => void handleUpdateComment(comment.id)}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p>{comment.content}</p>
                                    )}

                                    <div className="blog-comment-votes" aria-label="Comment votes">
                                        <button
                                            type="button"
                                            className={comment.user_vote === 1 ? 'is-active' : ''}
                                            disabled={busyCommentId === comment.id}
                                            onClick={() => void handleCommentVote(comment, 1)}
                                        >
                                            <img src={BLOG_ACTION_ICONS.like} alt="" aria-hidden="true" />
                                            <span>{comment.upvote_count}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={comment.user_vote === -1 ? 'is-active' : ''}
                                            disabled={busyCommentId === comment.id}
                                            onClick={() => void handleCommentVote(comment, -1)}
                                        >
                                            <img src={BLOG_ACTION_ICONS.dislike} alt="" aria-hidden="true" />
                                            <span>{comment.downvote_count}</span>
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {shareModalOpen && blog && (
                <div className="blog-share-modal" role="presentation" onMouseDown={() => setShareModalOpen(false)}>
                    <section
                        className="blog-share-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="blog-share-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="blog-share-dialog-head">
                            <div>
                                <p className="blogs-eyebrow">Share</p>
                                <h2 id="blog-share-title">{blog.title}</h2>
                            </div>
                            <button type="button" onClick={() => setShareModalOpen(false)} aria-label="Close share options">
                                X
                            </button>
                        </div>
                        <div className="blog-share-options">
                            <button type="button" onClick={() => void handleNativeShare()}>
                                <Send size={16} />
                                <span>Apps</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => openShareUrl(`https://wa.me/?text=${encodeURIComponent(blogShareText)}`)}
                            >
                                <MessageCircle size={16} />
                                <span>WhatsApp</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(blogShareUrl)}`)}
                            >
                                <Send size={16} />
                                <span>Facebook</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => openShareUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(blog.title)}&url=${encodeURIComponent(blogShareUrl)}`)}
                            >
                                <Send size={16} />
                                <span>X</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => openShareUrl(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(blogShareUrl)}`)}
                            >
                                <Send size={16} />
                                <span>LinkedIn</span>
                            </button>
                            <button type="button" onClick={() => void handleCopyShare()}>
                                <Copy size={16} />
                                <span>Copy</span>
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <LiquidMobileNav
                ariaLabel="Blog article mobile navigation"
                className="blogs-bottom-nav"
                items={BLOG_MOBILE_NAV_ITEMS.map((item): LiquidNavItem => ({
                    id: item.key,
                    label: item.key === 'profile' && !user ? 'Log in' : item.label,
                    isActive: item.key === 'blogs',
                    iconSrc: item.key === 'profile' && !user ? MOBILE_NAV_ICON_SRC.login : MOBILE_NAV_ICON_SRC[item.key],
                    icon: item.icon,
                    onClick: () => handleMobileNav(item.key),
                }))}
            />
        </main>
    );
};
