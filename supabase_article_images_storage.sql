-- ====================================================================
-- SUPABASE STORAGE CONFIGURATION FOR ARTICLE CONTENT IMAGES
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard -> SQL Editor)
-- ====================================================================

-- 1. Create the public bucket 'article-images' if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-images',
  'article-images',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Allow public read access to all objects in 'article-images'
DROP POLICY IF EXISTS "Public Read Access for Article Images" ON storage.objects;
CREATE POLICY "Public Read Access for Article Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'article-images');

-- 3. Allow anonymous and authenticated users to upload images into 'article-images'
DROP POLICY IF EXISTS "Allow Upload to Article Images" ON storage.objects;
CREATE POLICY "Allow Upload to Article Images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'article-images');

-- 4. Allow updates to existing objects in 'article-images'
DROP POLICY IF EXISTS "Allow Update Article Images" ON storage.objects;
CREATE POLICY "Allow Update Article Images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'article-images')
WITH CHECK (bucket_id = 'article-images');

-- 5. Allow deletion of objects in 'article-images'
DROP POLICY IF EXISTS "Allow Delete Article Images" ON storage.objects;
CREATE POLICY "Allow Delete Article Images"
ON storage.objects FOR DELETE
USING (bucket_id = 'article-images');
