INSERT INTO courts (id, name, location, court_type, is_available, status)
VALUES
    ('crt_51Fa93cD', 'Court 1', 'UGM Sports Hall', 'indoor', true, 'active'),
    ('crt_72Kb14xP', 'Court 2', 'UGM Sports Hall', 'indoor', true, 'active'),
    ('crt_93Lm27qR', 'Court 3', 'UGM Sports Hall', 'indoor', false, 'active');

-- Two bookings owned by two different students, so the object check has
-- something to refuse without a test having to create it first. These are
-- what the Step 12d demonstration reads: a student-a token asking for
-- bkg_ownedByB must be answered exactly as it would answer for an id that
-- was never issued.
--
-- booked_by holds the `sub` claim. Against a real Keycloak realm that is a
-- UUID; these readable values match the subjects the test tokens carry, so
-- the same commands work against a locally seeded database.
INSERT INTO bookings (id, court_id, start_time, end_time, status, booked_by)
VALUES
    ('bkg_ownedByA', 'crt_51Fa93cD',
     '2026-09-01T10:00:00+07:00', '2026-09-01T11:00:00+07:00',
     'confirmed', 'student-a'),
    ('bkg_ownedByB', 'crt_72Kb14xP',
     '2026-09-01T10:00:00+07:00', '2026-09-01T11:00:00+07:00',
     'confirmed', 'student-b')
ON CONFLICT (id) DO NOTHING;
