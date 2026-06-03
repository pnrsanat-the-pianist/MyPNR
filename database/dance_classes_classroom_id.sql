-- Link Bale / Dans classes to managed classrooms.
-- Run this after database/classrooms_setup.sql.

ALTER TABLE public.dance_classes
ADD COLUMN IF NOT EXISTS classroom_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dance_classes_classroom_id_fkey'
  ) THEN
    ALTER TABLE public.dance_classes
    ADD CONSTRAINT dance_classes_classroom_id_fkey
    FOREIGN KEY (classroom_id)
    REFERENCES public.classrooms(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dance_classes_classroom_id
ON public.dance_classes(classroom_id);
