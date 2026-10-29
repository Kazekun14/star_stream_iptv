START TRANSACTION;

-- Create initial super admin
-- username: admin
-- password: admin
CALL sp_admin_create(
    'admin',                                                -- username
    '$2y$12$OBw9/qUMeB6EUad/MzgbNeJTh6esoBJOWjb9ssB/mUz501ex8zmw6',                  -- password_hash
    'System Administrator',                                 -- full_name
    'admin@starstream.local',                                -- email
    'active',                                               -- status
    1                                                       -- must_change_password
);

COMMIT;