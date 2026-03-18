/*
  # Fix storage bucket policies for permit PDFs

  1. Changes
    - Drop existing policies
    - Create new policies that allow public uploads and downloads
    - This allows both authenticated and anonymous users to upload/download PDFs
  
  2. Security
    - Allow anyone to upload PDFs to the bucket
    - Allow anyone to download PDFs from the bucket
*/

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;

CREATE POLICY "Allow all uploads to permit-pdfs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'permit-pdfs');

CREATE POLICY "Allow all downloads from permit-pdfs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'permit-pdfs');

CREATE POLICY "Allow all updates to permit-pdfs"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'permit-pdfs')
WITH CHECK (bucket_id = 'permit-pdfs');

CREATE POLICY "Allow all deletes from permit-pdfs"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'permit-pdfs');