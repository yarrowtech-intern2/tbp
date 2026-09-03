import { supabase } from './supabase';

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

const BLOG_SELECT = [
    'id',
    'author_id',
    'author_name',
    'author_avatar_url',
    'title',
    'slug',
    'excerpt',
    'content',
    'category',
    'location',
    'tags',
    'cover_image_url',
    'content_image_urls',
    'status',
    'published_at',
    'created_at',
    'updated_at',
].join(',');

const BLOG_PAGE_SIZE = 24;

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
});

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

export const getBlogs = async (): Promise<BlogPost[]> => {
    const { data, error } = await supabase
        .from('blogs')
        .select(BLOG_SELECT)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(BLOG_PAGE_SIZE);

    if (error) throw error;
    return (data || []).map((row) => mapBlog(row as unknown as Record<string, unknown>));
};

export const getBlogBySlug = async (slug: string): Promise<BlogPost | null> => {
    const { data, error } = await supabase
        .from('blogs')
        .select(BLOG_SELECT)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

    if (error) throw error;
    return data ? mapBlog(data as unknown as Record<string, unknown>) : null;
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

export const createBlog = async (input: CreateBlogInput): Promise<BlogPost> => {
    const slug = await createUniqueSlug(input.title);
    const { data, error } = await supabase
        .from('blogs')
        .insert({
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
        })
        .select(BLOG_SELECT)
        .single();

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
