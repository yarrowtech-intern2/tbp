import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Loader2, PenLine, Trash2 } from 'lucide-react';
import { SEOHead } from '../components/SEO';
import { useAuth } from '../hooks/useAuth';
import { deleteBlog, getBlogs, type BlogPost } from '../lib/blogs';
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '../lib/seo';
import './blogs.css';

const formatDate = (value: string) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
};

const formatBlogMeta = (blog: BlogPost) => (
    [blog.category, blog.location, formatDate(blog.published_at)].filter(Boolean).join(' / ')
);

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

    const featuredBlog = blogs[0] || null;
    const remainingBlogs = useMemo(() => blogs.slice(1), [blogs]);

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
                <>
                    {featuredBlog && (
                        <article className="blogs-featured">
                            <Link to={`/blogs/${featuredBlog.slug}`} className="blogs-featured-image">
                                <img src={featuredBlog.cover_image_url} alt={featuredBlog.title} />
                            </Link>
                            <div className="blogs-featured-copy">
                                <p className="blogs-meta">{formatBlogMeta(featuredBlog)}</p>
                                <h2>
                                    <Link to={`/blogs/${featuredBlog.slug}`}>{featuredBlog.title}</Link>
                                </h2>
                                <p>{featuredBlog.excerpt}</p>
                                <div className="blogs-card-footer">
                                    <span>By {featuredBlog.author_name}</span>
                                    <Link to={`/blogs/${featuredBlog.slug}`} className="blogs-read-link">
                                        Read
                                        <ArrowUpRight size={16} />
                                    </Link>
                                </div>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        className="blogs-delete-btn"
                                        disabled={deletingId === featuredBlog.id}
                                        onClick={() => void handleDelete(featuredBlog)}
                                    >
                                        <Trash2 size={16} />
                                        <span>{deletingId === featuredBlog.id ? 'Deleting' : 'Delete'}</span>
                                    </button>
                                )}
                            </div>
                        </article>
                    )}

                    <section className="blogs-grid" aria-label="More blogs">
                        {remainingBlogs.map((blog) => (
                            <article className="blogs-card" key={blog.id}>
                                <Link to={`/blogs/${blog.slug}`} className="blogs-card-image">
                                    <img src={blog.cover_image_url} alt={blog.title} loading="lazy" />
                                </Link>
                                <div className="blogs-card-copy">
                                    <p className="blogs-meta">{formatBlogMeta(blog)}</p>
                                    <h2>
                                        <Link to={`/blogs/${blog.slug}`}>{blog.title}</Link>
                                    </h2>
                                    <p>{blog.excerpt}</p>
                                    <div className="blogs-card-footer">
                                        <span>By {blog.author_name}</span>
                                        <Link to={`/blogs/${blog.slug}`} className="blogs-read-link">
                                            Read
                                            <ArrowUpRight size={16} />
                                        </Link>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            type="button"
                                            className="blogs-delete-btn"
                                            disabled={deletingId === blog.id}
                                            onClick={() => void handleDelete(blog)}
                                        >
                                            <Trash2 size={16} />
                                            <span>{deletingId === blog.id ? 'Deleting' : 'Delete'}</span>
                                        </button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </section>
                </>
            )}
        </main>
    );
};
