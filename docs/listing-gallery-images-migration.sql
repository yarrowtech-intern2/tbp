-- Adds storage for all provider-uploaded listing images.
-- Run this once in the Supabase SQL editor if package detail pages only show
-- the primary and cover images.

alter table public.posts
    add column if not exists gallery_images text[] not null default '{}';

update public.posts
set gallery_images = array_remove(array[
    nullif(image_url, ''),
    nullif(cover_image_url, ''),
    nullif(thumbnail_url, '')
], null)
where gallery_images is null
   or cardinality(gallery_images) = 0;

