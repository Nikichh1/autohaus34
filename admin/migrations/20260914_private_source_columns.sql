-- Apply after deploying the explicit public vehicle field list.
revoke select on public.vehicles from anon;
grant select (id,slug,ref,make,model,full_name,body_type,colour,transmission,fuel,mileage,
 first_registration_year,first_registration_month,unregistered,horsepower,price,chapter,
 tags,notes,description_bg,description_en,equipment_bg,equipment_en,images,source_url,
 published,sort_order,created_at,updated_at) on public.vehicles to anon;
revoke execute on function public.current_admin_role(), public.is_active_admin() from anon;
