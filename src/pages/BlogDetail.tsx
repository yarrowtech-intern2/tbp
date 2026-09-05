import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Loader2, MessageCircle, PenLine, Send, Share2, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { SEOHead } from '../components/SEO';
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
                        >
                            <ThumbsUp size={16} />
                            <span>{blog.upvote_count}</span>
                        </button>
                        <button
                            type="button"
                            className={blog.user_vote === -1 ? 'is-active' : ''}
                            disabled={votingBlog}
                            onClick={() => void handleBlogVote(-1)}
                        >
                            <ThumbsDown size={16} />
                            <span>{blog.downvote_count}</span>
                        </button>
                        <span className="blog-comment-count">
                            <MessageCircle size={16} />
                            {blog.comment_count} comments
                        </span>
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
                                            <ThumbsUp size={13} />
                                            <span>{comment.upvote_count}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={comment.user_vote === -1 ? 'is-active' : ''}
                                            disabled={busyCommentId === comment.id}
                                            onClick={() => void handleCommentVote(comment, -1)}
                                        >
                                            <ThumbsDown size={13} />
                                            <span>{comment.downvote_count}</span>
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
};
