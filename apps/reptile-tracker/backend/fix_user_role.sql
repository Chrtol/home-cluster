-- Check current state
SELECT u.email, hm.access_level, hm.joined_at
FROM household_members hm
JOIN users u ON u.id = hm.user_id
ORDER BY hm.joined_at;

-- Update the first member of each household to admin
WITH first_members AS (
    SELECT DISTINCT ON (household_id)
        household_id,
        user_id
    FROM household_members
    ORDER BY household_id, joined_at ASC
)
UPDATE household_members hm
SET access_level = 'admin'::accesslevel
FROM first_members fm
WHERE hm.household_id = fm.household_id
AND hm.user_id = fm.user_id;

-- Verify the change
SELECT u.email, hm.access_level, hm.joined_at
FROM household_members hm
JOIN users u ON u.id = hm.user_id
ORDER BY hm.joined_at;
