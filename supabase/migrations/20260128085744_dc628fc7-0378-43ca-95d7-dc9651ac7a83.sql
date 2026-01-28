-- Add local_archive flag to doctors table for exemption from sequential numbering
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS local_archive boolean NOT NULL DEFAULT false;

-- Add archive_number column to archives for sequential numbering
ALTER TABLE public.archives ADD COLUMN IF NOT EXISTS archive_number integer;

-- Create unique index on archive_number (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_archives_archive_number ON public.archives (archive_number) WHERE archive_number IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN public.doctors.local_archive IS 'If true, archives for this doctor are exempted from sequential numbering';
COMMENT ON COLUMN public.archives.archive_number IS 'Sequential archive number, null for locally archived doctors';