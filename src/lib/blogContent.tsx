import React from 'react';

export type BlogContentBlock =
    | { kind: 'heading'; text: string }
    | { kind: 'subheading'; text: string }
    | { kind: 'paragraph'; text: string };

export const parseBlogContent = (content: string): BlogContentBlock[] => (
    content
        .split(/\n\s*\n/g)
        .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean)
        .map((block) => {
            if (block.startsWith('### ')) {
                return { kind: 'subheading', text: block.slice(4).trim() } satisfies BlogContentBlock;
            }
            if (block.startsWith('## ')) {
                return { kind: 'heading', text: block.slice(3).trim() } satisfies BlogContentBlock;
            }
            if (block.startsWith('# ')) {
                return { kind: 'heading', text: block.slice(2).trim() } satisfies BlogContentBlock;
            }
            return { kind: 'paragraph', text: block } satisfies BlogContentBlock;
        })
);

export const renderBlogContentBlocks = (content: string, contentImageUrls: string[] = []) => {
    const blocks = parseBlogContent(content);
    let nextImageIndex = 0;
    const gapCount = Math.max(0, blocks.length - 1);
    const usableImages = contentImageUrls.slice(0, gapCount || contentImageUrls.length);
    const interval = usableImages.length > 0 && gapCount > 0
        ? Math.max(1, Math.floor(gapCount / usableImages.length))
        : 0;

    const nodes = blocks.flatMap((block, index) => {
        const key = `${block.kind}-${index}-${block.text.slice(0, 24)}`;
        const node = block.kind === 'heading'
            ? <h2 key={key}>{block.text}</h2>
            : block.kind === 'subheading'
                ? <h3 key={key}>{block.text}</h3>
                : <p key={key}>{block.text}</p>;

        if (index >= blocks.length - 1 || nextImageIndex >= usableImages.length || interval === 0) {
            return [node];
        }

        const remainingGaps = gapCount - index;
        const remainingImages = usableImages.length - nextImageIndex;
        const dueByInterval = (index + 1) % interval === 0;
        const mustPlaceToAvoidStack = remainingImages >= remainingGaps;
        if (!dueByInterval && !mustPlaceToAvoidStack) return [node];

        const imageUrl = usableImages[nextImageIndex++];

        return [node, (
            <React.Fragment key={`fragment-${key}`}>
                <figure className="blog-content-image">
                    <img src={imageUrl} alt="" loading="lazy" />
                </figure>
            </React.Fragment>
        )];
    });

    return nodes.concat(
        contentImageUrls.slice(nextImageIndex).map((imageUrl, index) => (
            <figure className="blog-content-image" key={`remaining-image-${imageUrl}-${index}`}>
                <img src={imageUrl} alt="" loading="lazy" />
            </figure>
        ))
    );
};
