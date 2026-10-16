import type { Row } from '../records';
import usersImportCsv from './users_import.csv?raw';

// `users_import.csv`: 1,000 rows for the `users` of the ecommerce sample, made once and kept, so
// that the import is tested on a file of the size people import. Row `i` is on line `i + 2`; line 1
// is the header `email,full_name,country_code,signup_date`.
//
// Against `existingUsers()` it holds:
//  - 2 empty emails (lines 5 and 418), a date that does not exist (line 9, `2026-02-30`), another
//    (line 903, `31/04/2026`) and a name of 300 characters (line 791): 5 errors;
//  - 10 emails that already belong to a user (`USERS_IMPORT_CLASHES`): 10 duplicates;
//  - dates in the four ways a file writes them: `2024-01-01`, `2024-01-03 09:14:26`, `17/01/2024`,
//    `28-01-2024 18:05` and `05.02.2024`;
//  - a name with a comma and quotes, and with accents (line 102), as a quoted cell.
export { usersImportCsv };

/** The lines of the file that clash with `existingUsers()`, by email. */
export const USERS_IMPORT_CLASHES: Record<number, string> = {
  13: 'member1@shop.example',
  58: 'member3@shop.example',
  132: 'member4@shop.example',
  246: 'member6@shop.example',
  361: 'member8@shop.example',
  473: 'member10@shop.example',
  582: 'member12@shop.example',
  704: 'member14@shop.example',
  857: 'member15@shop.example',
  933: 'member17@shop.example',
};

/** The users the file is imported into: `member1@shop.example` to `member17@shop.example`. */
export function existingUsers(): Row[] {
  return Array.from({ length: 17 }, (_, i) => ({
    id: i + 1,
    email: `member${i + 1}@shop.example`,
    name: `Member ${i + 1}`,
    avatar_url: null,
    created_at: `2025-01-${String(i + 1).padStart(2, '0')} 09:00:00`,
  }));
}
