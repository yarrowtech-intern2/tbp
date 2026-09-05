import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Loader2, MapPin, MessageCircle, PenLine, Search, ThumbsDown, ThumbsUp, Trash2, UserCircle2 } from 'lucide-react';
import { SEOHead } from '../components/SEO';
import { LiquidMobileNav, type LiquidNavItem } from '../components/ui/liquid-mobile-nav';
import { MOBILE_NAV_ICON_SRC } from '../components/ui/mobile-nav-icon-map';
import { useAuth } from '../hooks/useAuth';
import { deleteBlog, getBlogs, setBlogVote, type BlogPost, type BlogVoteValue } from '../lib/blogs';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '../lib/seo';
import './blogs.css';

type BlogMobileNavKey = 'home' | 'explore' | 'blogs' | 'map' | 'profile';

const BLOG_MOBILE_NAV_ITEMS: Array<{ key: BlogMobileNavKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'explore', label: 'Explore', icon: Search },
    { key: 'blogs', label: 'Blogs', icon: PenLine },
    { key: 'map', label: 'Map', icon: MapPin },
    { key: 'profile', label: 'Profile', icon: UserCircle2 },
];

const featuredImage = (blog: BlogPost | null) => (
    blog?.cover_image_url || '/images/home4/tbp-map-1920.png'
);

export const Blogs: React.FC = () => {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [votingBlogId, setVotingBlogId] = useState<string | null>(null);

    const featuredBlog = blogs[0] || null;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        void getBlogs()
            .then((items) => {
                if (!cancelled) setBlogs(items);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load blogs.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const handleWrite = () => {
        navigate(user ? '/blogs/new' : '/login');
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

    const handleDelete = async (blog: BlogPost) => {
        if (!isAdmin || deletingId) return;
        const confirmed = window.confirm(`Delete "${blog.title}"? This cannot be undone.`);
        if (!confirmed) return;

        setDeletingId(blog.id);
        setError(null);
        try {
            await deleteBlog(blog.id);
            setBlogs((current) => current.filter((item) => item.id !== blog.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete blog.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleVote = async (blog: BlogPost, voteValue: BlogVoteValue) => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (votingBlogId) return;

        setVotingBlogId(blog.id);
        setError(null);
        try {
            const nextVote = blog.user_vote === voteValue ? null : voteValue;
            const summary = await setBlogVote(blog.id, nextVote);
            setBlogs((current) => current.map((item) => (
                item.id === blog.id ? { ...item, ...summary } : item
            )));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save your vote.');
        } finally {
            setVotingBlogId(null);
        }
    };

    return (
        <main className="blogs-page">
            <SEOHead
                title="Travel Blogs | Stories and Guides | The Better Pass"
                description="Read travel stories, destination guides, activity ideas and local insights from registered members of The Better Pass."
                path="/blogs"
                type="article"
                image={featuredImage(featuredBlog)}
                jsonLd={[
                    buildOrganizationJsonLd(),
                    buildBreadcrumbJsonLd('/blogs', 'Travel Blogs'),
                ]}
            />

            <section className="blogs-hero" aria-labelledby="blogs-title">
                <div>
                    <p className="blogs-eyebrow">The Better Pass Journal</p>
                    <h1 id="blogs-title">Travel ideas from people who move through places.</h1>
                </div>
                <button type="button" className="blogs-write-btn" onClick={handleWrite}>
                    <PenLine size={18} />
                    <span>Write Blog</span>
                </button>
            </section>

            {error && <p className="blogs-alert">{error}</p>}

            {loading ? (
                <div className="blogs-loading">
                    <Loader2 className="animate-spin" size={22} />
                    <span>Loading blogs</span>
                </div>
            ) : blogs.length === 0 ? (
                <section className="blogs-empty">
                    <h2>No blogs yet.</h2>
                    <p>Registered members can publish the first story.</p>
                    <button type="button" className="blogs-write-btn" onClick={handleWrite}>
                        <PenLine size={18} />
                        <span>Write Blog</span>
                    </button>
                </section>
            ) : (
                <section className="blogs-grid" aria-label="Blogs">
                    {blogs.map((blog) => (
                        <article className="blogs-card" key={blog.id}>
                            <Link to={`/blogs/${blog.slug}`} className="blogs-card-image">
                                <img src={blog.cover_image_url} alt="" loading="lazy" />
                            </Link>
                            <div className="blogs-card-copy">
                                <h2>
                                    <Link to={`/blogs/${blog.slug}`}>{blog.title}</Link>
                                </h2>
                                {blog.tags.length > 0 && (
                                    <div className="blogs-card-tags" aria-label="Blog tags">
                                        {blog.tags.slice(0, 3).map((tag) => (
                                            <span key={tag}>{tag}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="blogs-card-stats" aria-label="Blog engagement">
                                    <button
                                        type="button"
                                        className={blog.user_vote === 1 ? 'is-active' : ''}
                                        disabled={votingBlogId === blog.id}
                                        onClick={() => void handleVote(blog, 1)}
                                        aria-label={`Upvote ${blog.title}`}
                                    >
                                        <ThumbsUp size={13} />
                                        <span>{blog.upvote_count}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={blog.user_vote === -1 ? 'is-active' : ''}
                                        disabled={votingBlogId === blog.id}
                                        onClick={() => void handleVote(blog, -1)}
                                        aria-label={`Downvote ${blog.title}`}
                                    >
                                        <ThumbsDown size={13} />
                                        <span>{blog.downvote_count}</span>
                                    </button>
                                    <Link to={`/blogs/${blog.slug}`} aria-label={`${blog.comment_count} comments on ${blog.title}`}>
                                        <MessageCircle size={13} />
                                        <span>{blog.comment_count}</span>
                                    </Link>
                                </div>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        className="blogs-delete-btn"
                                        disabled={deletingId === blog.id}
                                        onClick={() => void handleDelete(blog)}
                                        aria-label={`Delete ${blog.title}`}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </section>
            )}

            <LiquidMobileNav
                ariaLabel="Blogs mobile navigation"
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
