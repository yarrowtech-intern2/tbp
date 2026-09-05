import { supabase } from './supabase';

export type BlogVoteValue = 1 | -1;
export type BlogCommentSort = 'popular' | 'newest' | 'oldest';

export interface BlogPost {
    id: string;
    author_id: string;
    author_name: string;
    author_avatar_url?: string | null;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    location: string;
    tags: string[];
    cover_image_url: string;
    content_image_urls: string[];
    status: 'published';
    published_at: string;
    created_at: string;
    updated_at: string;
    upvote_count: number;
    downvote_count: number;
    comment_count: number;
    user_vote: BlogVoteValue | null;
}

export interface CreateBlogInput {
    authorId: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    title: string;
    excerpt: string;
    content: string;
    category: string;
    location: string;
    tags: string[];
    coverImageUrl: string;
    contentImageUrls: string[];
}

export interface BlogEngagementSummary {
    upvote_count: number;
    downvote_count: number;
    comment_count: number;
    user_vote: BlogVoteValue | null;
}

export interface BlogComment {
    id: string;
    blog_id: string;
    user_id: string;
    author_name: string;
    author_avatar_url?: string | null;
    content: string;
    created_at: string;
    updated_at: string;
    upvote_count: number;
    downvote_count: number;
    user_vote: BlogVoteValue | null;
}

export interface CreateBlogCommentInput {
    blogId: string;
    content: string;
    authorName: string;
    authorAvatarUrl?: string | null;
}

const BLOG_PAGE_SIZE = 24;
const COMMENT_MAX_LENGTH = 2000;

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
};

const mapBlog = (row: Record<string, unknown>): BlogPost => ({
    id: String(row.id || ''),
    author_id: String(row.author_id || ''),
    author_name: String(row.author_name || 'The Better Pass member'),
    author_avatar_url: typeof row.author_avatar_url === 'string' ? row.author_avatar_url : null,
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    excerpt: String(row.excerpt || ''),
    content: String(row.content || ''),
    category: String(row.category || 'Travel'),
    location: String(row.location || ''),
    tags: normalizeStringArray(row.tags),
    cover_image_url: String(row.cover_image_url || ''),
    content_image_urls: normalizeStringArray(row.content_image_urls),
    status: 'published',
    published_at: String(row.published_at || row.created_at || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || row.created_at || ''),
    upvote_count: Number(row.upvote_count || 0),
    downvote_count: Number(row.downvote_count || 0),
    comment_count: Number(row.comment_count || 0),
    user_vote: row.user_vote === 1 || row.user_vote === -1 ? row.user_vote : null,
});

const mapComment = (row: Record<string, unknown>): BlogComment => ({
    id: String(row.id || ''),
    blog_id: String(row.blog_id || ''),
    user_id: String(row.user_id || ''),
    author_name: String(row.author_name || 'The Better Pass member'),
    author_avatar_url: typeof row.author_avatar_url === 'string' ? row.author_avatar_url : null,
    content: String(row.content || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || row.created_at || ''),
    upvote_count: Number(row.upvote_count || 0),
    downvote_count: Number(row.downvote_count || 0),
    user_vote: row.user_vote === 1 || row.user_vote === -1 ? row.user_vote : null,
});

const createEmptySummary = (): BlogEngagementSummary => ({
    upvote_count: 0,
    downvote_count: 0,
    comment_count: 0,
    user_vote: null,
});

const isMissingEngagementRelationError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const { code, message } = error as { code?: unknown; message?: unknown };
    const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
    return (
        code === '42P01'
        || code === 'PGRST205'
        || normalizedMessage.includes('blog_votes')
        || normalizedMessage.includes('blog_comments')
        || normalizedMessage.includes('blog_comment_votes')
    );
};

const getCurrentUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id || null;
};

const requireCurrentUserId = async (): Promise<string> => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Log in to interact with blogs.');
    return userId;
};

const applyBlogSummary = (blog: BlogPost, summary?: BlogEngagementSummary): BlogPost => ({
    ...blog,
    ...(summary || createEmptySummary()),
});

const normalizeCommentContent = (content: string): string => {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Write a comment before posting.');
    if (trimmed.length > COMMENT_MAX_LENGTH) throw new Error(`Comments can be up to ${COMMENT_MAX_LENGTH} characters.`);
    return trimmed;
};

export const slugifyBlogTitle = (title: string): string => {
    const slug = title
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || `blog-${Date.now()}`;
};

export const parseBlogTags = (value: string): string[] => Array.from(new Set(
    value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12)
));

export const getBlogEngagementSummaries = async (blogIds: string[]): Promise<Record<string, BlogEngagementSummary>> => {
    const uniqueBlogIds = Array.from(new Set(blogIds.map((id) => id.trim()).filter(Boolean)));
    const summaries = Object.fromEntries(uniqueBlogIds.map((id) => [id, createEmptySummary()]));
    if (!uniqueBlogIds.length) return summaries;

    const votesResult = await supabase
        .from('blog_votes')
        .select('blog_id,vote_value')
        .in('blog_id', uniqueBlogIds);

    if (votesResult.error) {
        if (isMissingEngagementRelationError(votesResult.error)) return summaries;
        throw votesResult.error;
    }

    for (const row of votesResult.data || []) {
        const blogId = String((row as { blog_id?: unknown }).blog_id || '');
        const summary = summaries[blogId];
        if (!summary) continue;
        const voteValue = Number((row as { vote_value?: unknown }).vote_value);
        if (voteValue === 1) summary.upvote_count += 1;
        if (voteValue === -1) summary.downvote_count += 1;
    }

    const commentsResult = await supabase
        .from('blog_comments')
        .select('blog_id')
        .in('blog_id', uniqueBlogIds);

    if (commentsResult.error) {
        if (!isMissingEngagementRelationError(commentsResult.error)) throw commentsResult.error;
    } else {
        for (const row of commentsResult.data || []) {
            const blogId = String((row as { blog_id?: unknown }).blog_id || '');
            const summary = summaries[blogId];
            if (summary) summary.comment_count += 1;
        }
    }

    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return summaries;

    const userVotesResult = await supabase
        .from('blog_votes')
        .select('blog_id,vote_value')
        .eq('user_id', currentUserId)
        .in('blog_id', uniqueBlogIds);

    if (userVotesResult.error) {
        if (!isMissingEngagementRelationError(userVotesResult.error)) throw userVotesResult.error;
        return summaries;
    }

    for (const row of userVotesResult.data || []) {
        const blogId = String((row as { blog_id?: unknown }).blog_id || '');
        const summary = summaries[blogId];
        const voteValue = Number((row as { vote_value?: unknown }).vote_value);
        if (summary && (voteValue === 1 || voteValue === -1)) summary.user_vote = voteValue;
    }

    return summaries;
};

export const getBlogs = async (): Promise<BlogPost[]> => {
    const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(BLOG_PAGE_SIZE);

    if (error) throw error;
    const blogs = (data || []).map((row) => mapBlog(row as unknown as Record<string, unknown>));
    const summaries = await getBlogEngagementSummaries(blogs.map((blog) => blog.id));
    return blogs.map((blog) => applyBlogSummary(blog, summaries[blog.id]));
};

export const getBlogBySlug = async (slug: string): Promise<BlogPost | null> => {
    const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const blog = mapBlog(data as unknown as Record<string, unknown>);
    const summaries = await getBlogEngagementSummaries([blog.id]);
    return applyBlogSummary(blog, summaries[blog.id]);
};

const createUniqueSlug = async (title: string) => {
    const baseSlug = slugifyBlogTitle(title);
    const { data, error } = await supabase
        .from('blogs')
        .select('slug')
        .or(`slug.eq.${baseSlug},slug.like.${baseSlug}-%`);

    if (error) throw error;

    const existing = new Set((data || []).map((row) => String((row as { slug?: unknown }).slug || '')));
    if (!existing.has(baseSlug)) return baseSlug;

    for (let index = 2; index < 200; index += 1) {
        const candidate = `${baseSlug}-${index}`;
        if (!existing.has(candidate)) return candidate;
    }

    return `${baseSlug}-${Date.now()}`;
};

const isMissingLocationColumnError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const { code, message } = error as { code?: unknown; message?: unknown };
    const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
    return (
        code === '42703'
        || (
            code === 'PGRST204'
            && normalizedMessage.includes('location')
            && normalizedMessage.includes('blogs')
        )
        || (
            normalizedMessage.includes('location')
            && normalizedMessage.includes('blogs')
            && normalizedMessage.includes('column')
        )
    );
};

export const createBlog = async (input: CreateBlogInput): Promise<BlogPost> => {
    const slug = await createUniqueSlug(input.title);
    const blogPayload = {
        author_id: input.authorId,
        author_name: input.authorName,
        author_avatar_url: input.authorAvatarUrl || null,
        title: input.title.trim(),
        slug,
        excerpt: input.excerpt.trim(),
        content: input.content.trim(),
        category: input.category.trim() || 'Travel',
        location: input.location.trim(),
        tags: input.tags,
        cover_image_url: input.coverImageUrl,
        content_image_urls: input.contentImageUrls,
        status: 'published',
    };

    const { data, error } = await supabase
        .from('blogs')
        .insert(blogPayload)
        .select('*')
        .single();

    if (error && isMissingLocationColumnError(error)) {
        const fallbackPayload: Partial<typeof blogPayload> = { ...blogPayload };
        delete fallbackPayload.location;
        const { data: fallbackData, error: fallbackError } = await supabase
            .from('blogs')
            .insert(fallbackPayload)
            .select('*')
            .single();

        if (fallbackError) throw fallbackError;
        return mapBlog(fallbackData as unknown as Record<string, unknown>);
    }

    if (error) throw error;
    return mapBlog(data as unknown as Record<string, unknown>);
};

export const deleteBlog = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('blogs')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const setBlogVote = async (blogId: string, voteValue: BlogVoteValue | null): Promise<BlogEngagementSummary> => {
    const userId = await requireCurrentUserId();

    if (voteValue === null) {
        const { error } = await supabase
            .from('blog_votes')
            .delete()
            .eq('blog_id', blogId)
            .eq('user_id', userId);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('blog_votes')
            .upsert({ blog_id: blogId, user_id: userId, vote_value: voteValue }, { onConflict: 'blog_id,user_id' });
        if (error) throw error;
    }

    const summaries = await getBlogEngagementSummaries([blogId]);
    return summaries[blogId] || createEmptySummary();
};

const getCommentEngagementSummaries = async (commentIds: string[]): Promise<Record<string, BlogEngagementSummary>> => {
    const uniqueCommentIds = Array.from(new Set(commentIds.map((id) => id.trim()).filter(Boolean)));
    const summaries = Object.fromEntries(uniqueCommentIds.map((id) => [id, createEmptySummary()]));
    if (!uniqueCommentIds.length) return summaries;

    const votesResult = await supabase
        .from('blog_comment_votes')
        .select('comment_id,vote_value')
        .in('comment_id', uniqueCommentIds);

    if (votesResult.error) {
        if (isMissingEngagementRelationError(votesResult.error)) return summaries;
        throw votesResult.error;
    }

    for (const row of votesResult.data || []) {
        const commentId = String((row as { comment_id?: unknown }).comment_id || '');
        const summary = summaries[commentId];
        if (!summary) continue;
        const voteValue = Number((row as { vote_value?: unknown }).vote_value);
        if (voteValue === 1) summary.upvote_count += 1;
        if (voteValue === -1) summary.downvote_count += 1;
    }

    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return summaries;

    const userVotesResult = await supabase
        .from('blog_comment_votes')
        .select('comment_id,vote_value')
        .eq('user_id', currentUserId)
        .in('comment_id', uniqueCommentIds);

    if (userVotesResult.error) {
        if (!isMissingEngagementRelationError(userVotesResult.error)) throw userVotesResult.error;
        return summaries;
    }

    for (const row of userVotesResult.data || []) {
        const commentId = String((row as { comment_id?: unknown }).comment_id || '');
        const summary = summaries[commentId];
        const voteValue = Number((row as { vote_value?: unknown }).vote_value);
        if (summary && (voteValue === 1 || voteValue === -1)) summary.user_vote = voteValue;
    }

    return summaries;
};

const applyCommentSummary = (comment: BlogComment, summary?: BlogEngagementSummary): BlogComment => ({
    ...comment,
    upvote_count: summary?.upvote_count || 0,
    downvote_count: summary?.downvote_count || 0,
    user_vote: summary?.user_vote || null,
});

const sortComments = (comments: BlogComment[], sort: BlogCommentSort): BlogComment[] => {
    const sorted = [...comments];
    if (sort === 'oldest') {
        return sorted.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    }
    if (sort === 'popular') {
        return sorted.sort((a, b) => {
            const scoreA = a.upvote_count - a.downvote_count;
            const scoreB = b.upvote_count - b.downvote_count;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
    }
    return sorted.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
};

export const getBlogComments = async (blogId: string, sort: BlogCommentSort): Promise<BlogComment[]> => {
    const { data, error } = await supabase
        .from('blog_comments')
        .select('*')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: sort === 'oldest' });

    if (error) {
        if (isMissingEngagementRelationError(error)) return [];
        throw error;
    }

    const comments = (data || []).map((row) => mapComment(row as unknown as Record<string, unknown>));
    const summaries = await getCommentEngagementSummaries(comments.map((comment) => comment.id));
    return sortComments(comments.map((comment) => applyCommentSummary(comment, summaries[comment.id])), sort);
};

export const createBlogComment = async (input: CreateBlogCommentInput): Promise<BlogComment> => {
    const userId = await requireCurrentUserId();
    const content = normalizeCommentContent(input.content);
    const { data, error } = await supabase
        .from('blog_comments')
        .insert({
            blog_id: input.blogId,
            user_id: userId,
            author_name: input.authorName.trim() || 'The Better Pass member',
            author_avatar_url: input.authorAvatarUrl || null,
            content,
        })
        .select('*')
        .single();

    if (error) throw error;
    const comment = mapComment(data as unknown as Record<string, unknown>);
    const summaries = await getCommentEngagementSummaries([comment.id]);
    return applyCommentSummary(comment, summaries[comment.id]);
};

export const updateBlogComment = async (commentId: string, content: string): Promise<BlogComment> => {
    const nextContent = normalizeCommentContent(content);
    const { data, error } = await supabase
        .from('blog_comments')
        .update({ content: nextContent })
        .eq('id', commentId)
        .select('*')
        .single();

    if (error) throw error;
    const comment = mapComment(data as unknown as Record<string, unknown>);
    const summaries = await getCommentEngagementSummaries([comment.id]);
    return applyCommentSummary(comment, summaries[comment.id]);
};

export const deleteBlogComment = async (commentId: string): Promise<void> => {
    const { error } = await supabase
        .from('blog_comments')
        .delete()
        .eq('id', commentId);

    if (error) throw error;
};

export const setBlogCommentVote = async (commentId: string, voteValue: BlogVoteValue | null): Promise<BlogEngagementSummary> => {
    const userId = await requireCurrentUserId();

    if (voteValue === null) {
        const { error } = await supabase
            .from('blog_comment_votes')
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', userId);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('blog_comment_votes')
            .upsert({ comment_id: commentId, user_id: userId, vote_value: voteValue }, { onConflict: 'comment_id,user_id' });
        if (error) throw error;
    }

    const summaries = await getCommentEngagementSummaries([commentId]);
    return summaries[commentId] || createEmptySummary();
};
