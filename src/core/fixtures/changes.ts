import type { Change, Run, ServerId } from '../changes/model';

// The nine changes of the change log mock (docs/screens/changelog-v2.html), as a fixture for the
// tests of the change log. The app does not ship them: an empty log stays empty. Their titles and
// SQL are data and stay in the words they were written in.

/** The moment the mock was drawn: Saturday 24 October 2026, noon, local time. Its groups are Today, This week and Last week for this `now`. */
export const SAMPLE_NOW = new Date(2026, 9, 24, 12, 0).getTime();

/** A moment of 2026, in local time. */
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

const ran = (month: number, day: number, hour = 9, minute = 0): Run => ({ status: 'ran', at: at(month, day, hour, minute) });
const pending: Run = { status: 'pending' };

function runs(local: Run, demo: Run, staging: Run, production: Run): Record<ServerId, Run> {
  return { local, demo, staging, production };
}

/** A fresh copy of the nine changes, the newest first. */
export function sampleChanges(): Change[] {
  return [
    {
      seq: 47,
      key: 'ATA-318',
      title: 'Thêm cột mã số thuế cho nhà cung cấp',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'feature/ATA-318-ma-so-thue',
      pr: { repo: 'atad-erp', number: 512, state: 'open' },
      createdAt: at(10, 24, 9, 40),
      sql: 'ALTER TABLE da_nha_cung_cap\n  ADD COLUMN ma_so_thue VARCHAR(14) NULL AFTER ten;',
      rollback: 'ALTER TABLE da_nha_cung_cap\n  DROP COLUMN ma_so_thue;',
      notes: 'Chưa bắt buộc nhập. Bắt buộc sau khi nhà cung cấp cũ được cập nhật.',
      runs: runs(ran(10, 24, 9, 55), pending, pending, pending),
    },
    {
      seq: 46,
      key: 'ATA-312',
      title: 'Đổi kiểu so_tien sang DECIMAL(18,2)',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'feature/ATA-312-thanh-toan',
      pr: { repo: 'atad-erp', number: 506, state: 'merged' },
      createdAt: at(10, 21, 16, 20),
      sql:
        '-- số tiền vượt 13 chữ số với hoá đơn tổng\n' +
        'ALTER TABLE da_thanh_toan\n  MODIFY so_tien DECIMAL(18,2) NOT NULL DEFAULT 0;\n\n' +
        'ALTER TABLE da_thanh_toan_chi_tien\n  MODIFY so_tien DECIMAL(18,2) NOT NULL DEFAULT 0;',
      rollback:
        'ALTER TABLE da_thanh_toan_chi_tien\n  MODIFY so_tien DECIMAL(13,2) NOT NULL DEFAULT 0;\n\n' +
        'ALTER TABLE da_thanh_toan\n  MODIFY so_tien DECIMAL(13,2) NOT NULL DEFAULT 0;',
      notes: 'Chạy cùng lúc với #0045: cùng một pull request.',
      runs: runs(ran(10, 21, 16, 35), ran(10, 22, 9, 10), pending, pending),
    },
    {
      seq: 45,
      key: 'ATA-312',
      title: 'Bảng duyệt chi nhiều cấp',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'feature/ATA-312-thanh-toan',
      pr: { repo: 'atad-erp', number: 506, state: 'merged' },
      createdAt: at(10, 21, 11, 5),
      sql:
        'CREATE TABLE da_duyet_chi (\n' +
        '  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,\n' +
        '  thanh_toan_id BIGINT UNSIGNED NOT NULL,\n' +
        '  cap_duyet TINYINT NOT NULL,\n' +
        '  nguoi_duyet_id BIGINT UNSIGNED NULL,\n' +
        '  duyet_luc DATETIME NULL,\n' +
        '  CONSTRAINT fk_duyet_chi_thanh_toan FOREIGN KEY (thanh_toan_id) REFERENCES da_thanh_toan (id)\n' +
        ');',
      rollback: 'DROP TABLE da_duyet_chi;',
      notes: '',
      runs: runs(ran(10, 21, 11, 20), ran(10, 22, 9, 10), ran(10, 22, 15, 30), pending),
    },
    {
      seq: 44,
      key: 'ATA-309',
      title: 'Xoá bảng legacy_cham_cong_tmp',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'chore/ATA-309-don-bang-tam',
      pr: { repo: 'atad-erp', number: 498, state: 'merged' },
      createdAt: at(10, 20, 10, 15),
      sql: '-- bảng tạm của đợt nhập chấm công cũ, không còn bảng nào tham chiếu\nDROP TABLE legacy_cham_cong_tmp;',
      rollback: '-- Không có bản khôi phục: dùng bản sao lưu lấy trước khi xoá.',
      notes: 'Sao lưu bảng trước khi chạy trên Production.',
      runs: runs(ran(10, 20, 10, 30), ran(10, 21, 9, 0), ran(10, 22, 15, 0), pending),
    },
    {
      seq: 43,
      key: 'ACM-77',
      title: 'Seed loại chi phí mặc định',
      database: 'acm',
      engine: 'PostgreSQL',
      branch: 'feature/ACM-77-seed-chi-phi',
      pr: { repo: 'acm-api', number: 131, state: 'merged' },
      createdAt: at(10, 19, 14, 0),
      sql: "INSERT INTO loai_chi_phi (ma, ten)\nVALUES\n  ('DI_LAI', 'Đi lại'),\n  ('AN_UONG', 'Ăn uống'),\n  ('LUU_TRU', 'Lưu trú');",
      rollback: "DELETE FROM loai_chi_phi\nWHERE ma IN ('DI_LAI', 'AN_UONG', 'LUU_TRU');",
      notes: 'Không có Staging cho acm.',
      runs: runs(ran(10, 19, 14, 10), ran(10, 20, 9, 30), { status: 'na' }, ran(10, 21, 10, 0)),
    },
    {
      seq: 42,
      key: 'ATA-301',
      title: 'Index tìm kiếm chấm công theo ngày',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'fix/ATA-301-index-cham-cong',
      pr: { repo: 'atad-erp', number: 489, state: 'merged' },
      createdAt: at(10, 16, 15, 45),
      sql: 'CREATE INDEX idx_cham_cong_ngay\n  ON da_cham_cong (ngay_cong, nhan_vien_id);',
      rollback: 'DROP INDEX idx_cham_cong_ngay ON da_cham_cong;',
      notes: 'Lỗi trên Staging: hết thời gian chờ khi tạo index. Chạy lại ngoài giờ làm việc.',
      runs: runs(ran(10, 16, 16, 0), ran(10, 17, 9, 0), { status: 'failed' }, pending),
    },
    {
      seq: 41,
      key: 'ATA-298',
      title: 'Thêm trạng thái phiếu kho',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'feature/ATA-298-trang-thai-kho',
      pr: { repo: 'atad-erp', number: 480, state: 'merged' },
      createdAt: at(10, 15, 11, 30),
      sql: "ALTER TABLE da_phieu_kho\n  ADD COLUMN trang_thai VARCHAR(16) NOT NULL DEFAULT 'moi';",
      rollback: 'ALTER TABLE da_phieu_kho\n  DROP COLUMN trang_thai;',
      notes: '',
      runs: runs(ran(10, 15, 11, 45), ran(10, 16, 9, 0), ran(10, 17, 14, 0), ran(10, 19, 10, 0)),
    },
    {
      seq: 40,
      key: 'ATA-295',
      title: 'Bảng audit văn bản',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'feature/ATA-295-audit-van-ban',
      pr: { repo: 'atad-erp', number: 476, state: 'merged' },
      createdAt: at(10, 14, 9, 20),
      sql:
        'CREATE TABLE da_audit_van_ban (\n' +
        '  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,\n' +
        '  van_ban_id BIGINT UNSIGNED NOT NULL,\n' +
        '  hanh_dong VARCHAR(32) NOT NULL,\n' +
        '  nguoi_dung_id BIGINT UNSIGNED NULL,\n' +
        '  tao_luc DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP\n' +
        ');',
      rollback: 'DROP TABLE da_audit_van_ban;',
      notes: '',
      runs: runs(ran(10, 14, 9, 40), ran(10, 15, 9, 0), ran(10, 16, 14, 0), ran(10, 19, 10, 0)),
    },
    {
      seq: 39,
      key: 'ATA-290',
      title: 'Bỏ cột ghi_chu_cu ở da_van_ban',
      database: 'atad5s',
      engine: 'MySQL',
      branch: 'chore/ATA-290-bo-cot-cu',
      pr: { repo: 'atad-erp', number: 471, state: 'merged' },
      createdAt: at(10, 13, 16, 10),
      sql: 'ALTER TABLE da_van_ban\n  DROP COLUMN ghi_chu_cu;',
      rollback: 'ALTER TABLE da_van_ban\n  ADD COLUMN ghi_chu_cu TEXT NULL;',
      notes: 'Cột không còn được đọc ở đâu từ phiên bản 2.4.',
      runs: runs(ran(10, 13, 16, 30), ran(10, 14, 9, 0), ran(10, 15, 14, 0), ran(10, 19, 10, 0)),
    },
  ];
}
