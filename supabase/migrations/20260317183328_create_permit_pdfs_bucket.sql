/*
  # Create storage bucket for permit PDFs

  1. New Storage Bucket
    - `permit-pdfs` - Public bucket for storing signed permit PDF documents
  
  2. Security
    - Allow authenticated users to upload PDFs
    - Allow public read access so PDFs can be viewed/downloaded
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('permit-pdfs', 'permit-pdfs', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow authenticated uploads'
  ) THEN
    CREATE POLICY "Allow authenticated uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'permit-pdfs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public downloads'
  ) THEN
    CREATE POLICY "Allow public downloads"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'permit-pdfs');
  END IF;
END $$;