/* global console, process */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcryptjs';

const ADMIN_ID = '00000000-0000-4000-a000-000000000000';
const CHOIR_PROFILE_ID = '00000000-0000-4000-a000-000000000001';
const MAIN_ROOM_ID = '00000000-0000-4000-b000-000000000001';
const ACOUSTIC_ROOM_ID = '00000000-0000-4000-b000-000000000002';
const DEFAULT_POLICY_ID = 'default-policy-uuid-0000-0000-000000000000';

function buildSlotRows() {
  const rows = [];
  let index = 0;
  for (let day = 0; day <= 6; day++) {
    for (let hour = 9; hour <= 19; hour++) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = `${String(hour + 1).padStart(2, '0')}:00`;
      rows.push(
        `('os-slot-${index++}', '${DEFAULT_POLICY_ID}', ${day}, '${start}', '${end}', 1)`,
      );
    }
  }
  return rows.join(',\n');
}

async function main() {
  console.log('Generating seed SQL...');

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('admin123', salt);
  const now = Date.now();

  const sql = `
-- Default booking policy
INSERT OR IGNORE INTO booking_policies (id, name, booking_horizon_days, min_booking_duration_minutes, max_booking_duration_minutes, booking_interval_minutes, active)
VALUES ('${DEFAULT_POLICY_ID}', 'Default Policy', 7, 30, 180, 30, 1);

-- System settings singleton
INSERT OR IGNORE INTO system_settings (id, booking_release_day, booking_release_time, default_policy_id)
VALUES ('system-settings-singleton', 6, '13:30', '${DEFAULT_POLICY_ID}');

-- Discrete bookable slots, applied to every day of the week
INSERT OR IGNORE INTO operating_schedules (id, policy_id, day_of_week, start_time, end_time, enabled)
VALUES
${buildSlotRows()};

-- Seed Rooms
INSERT OR IGNORE INTO rooms (id, name, number, created_at, active, policy_id)
VALUES ('${MAIN_ROOM_ID}', 'Main Room', 1, ${now}, 1, '${DEFAULT_POLICY_ID}');

INSERT OR IGNORE INTO rooms (id, name, number, created_at, active, policy_id)
VALUES ('${ACOUSTIC_ROOM_ID}', 'Acoustic Room', 2, ${now}, 1, '${DEFAULT_POLICY_ID}');

-- Seed Profiles
INSERT OR IGNORE INTO profiles (id, name, color, created_at)
VALUES ('${CHOIR_PROFILE_ID}', 'University Choir', '#4F46E5', ${now});

-- Seed Admin User
INSERT OR IGNORE INTO users (id, username, email, name, password_hash, role, must_change_password, active, created_at, updated_at)
VALUES ('${ADMIN_ID}', 'admin', 'admin@rejoy.local', 'Admin', '${passwordHash}', 'ADMIN', 0, 1, ${now}, ${now});

-- Link Admin to Choir Profile
INSERT OR IGNORE INTO user_profiles (user_id, profile_id)
VALUES ('${ADMIN_ID}', '${CHOIR_PROFILE_ID}');

-- Backfill email for any legacy users that were created before the email column existed
UPDATE users SET email = username, name = CASE WHEN name = '' THEN username ELSE name END WHERE email = '';
`;

  const tempFilePath = path.join(process.cwd(), 'temp_seed.sql');
  fs.writeFileSync(tempFilePath, sql);

  try {
    console.log('Executing seed SQL via wrangler...');
    execSync(`npx wrangler d1 execute DB --local --file=temp_seed.sql`, { stdio: 'inherit' });
    console.log('Seeding completed successfully.');
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
