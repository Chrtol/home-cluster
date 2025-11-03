-- Cleanup script for duplicate schedule templates
-- Run this in your PostgreSQL database to remove duplicates

-- First, let's see what duplicates exist
SELECT
    name,
    species,
    age_category,
    schedule_type,
    is_default,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as ids
FROM schedule_templates
GROUP BY name, species, age_category, schedule_type, is_default
HAVING COUNT(*) > 1
ORDER BY name;

-- Show templates with suspicious sources (not in approved list)
SELECT
    id,
    name,
    species,
    age_category,
    is_default,
    created_at
FROM schedule_templates
WHERE
    is_default = false
    AND (
        name LIKE 'Juvenile bearded dragon%'
        OR name LIKE 'Juvenile leopard gecko%'
        OR name LIKE 'Adult bearded dragon%'
        OR name LIKE 'Adult leopard gecko%'
        OR (name LIKE 'Tropical Species%' AND species IS NOT NULL)
    )
ORDER BY name;

-- DANGEROUS: Uncomment and run these DELETE statements ONLY after reviewing the SELECT results above

-- Delete non-default templates with problematic source names (juvenile/adult as source)
-- DELETE FROM schedule_templates
-- WHERE
--     is_default = false
--     AND (
--         name LIKE 'Juvenile bearded dragon%'
--         OR name LIKE 'Juvenile leopard gecko%'
--         OR name LIKE 'Adult bearded dragon%'
--         OR name LIKE 'Adult leopard gecko%'
--     );

-- Delete duplicate templates (keep only one, preferring is_default=true)
-- This will delete duplicates based on exact name match, keeping the oldest default one
-- DELETE FROM schedule_templates t1
-- USING schedule_templates t2
-- WHERE
--     t1.id > t2.id
--     AND t1.name = t2.name
--     AND t1.species = t2.species
--     AND t1.age_category = t2.age_category
--     AND t1.is_default = false;

-- After cleanup, verify the results
-- SELECT COUNT(*) as total_templates FROM schedule_templates;
-- SELECT name, COUNT(*) as count
-- FROM schedule_templates
-- GROUP BY name
-- HAVING COUNT(*) > 1;
