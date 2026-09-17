-- Allow the public catalogue to read only the columns that are intentionally
-- exposed by /api/public/vehicles. RLS still limits anon to published=true.
-- Private editing/source fields remain inaccessible to the anon role.

grant select (
  id,
  slug,
  ref,
  make,
  model,
  full_name,
  body_type,
  colour,
  transmission,
  fuel,
  mileage,
  first_registration_year,
  first_registration_month,
  unregistered,
  horsepower,
  price,
  chapter,
  tags,
  notes,
  notes_en,
  description_bg,
  description_en,
  equipment_bg,
  equipment_en,
  images,
  published,
  sort_order,
  updated_at
) on table public.vehicles to anon;
