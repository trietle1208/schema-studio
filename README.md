# Schema Studio — starter kit

Thư mục này chưa có code ứng dụng. Nó chứa đủ "đầu vào" để Claude Code dựng dự án:

| Đường dẫn | Nội dung |
|---|---|
| `CLAUDE.md` | Hướng dẫn Claude Code tự đọc mỗi phiên: stack, cấu trúc, quy tắc |
| `docs/ROADMAP.md` | Lộ trình chia nhỏ theo từng bước, mỗi bước ~1 phiên làm việc |
| `docs/screens/` | Ảnh chụp 9 màn hình thiết kế để đối chiếu |
| `design-system/` | Tokens, CSS, font, component prototype (React), hướng dẫn thiết kế |

Bắt đầu: mở thư mục này trong VS Code, mở panel Claude Code và gõ prompt đầu tiên trong hướng dẫn.
# schema-studio

## Kết nối database thật (chỉ đọc)

Trình duyệt không tự mở được kết nối tới PostgreSQL/MySQL, nên ứng dụng đọc cấu trúc bảng qua một "bridge" nhỏ chạy trên máy:

```
npm run dev      # ứng dụng
npm run bridge   # bridge, lắng nghe ở http://127.0.0.1:4577
```

Sau đó mở **Import Schema → Connect to database**, nhập host, database, user, mật khẩu rồi bấm **Read tables**.

- Bridge chỉ đọc catalog trong một transaction read-only, bằng các câu truy vấn cố định trong `bridge/`; nó không ghi gì và không chạy SQL do trang web gửi lên.
- Bridge chỉ nghe trên `127.0.0.1` và chỉ trả lời trang được mở từ chính máy này (`localhost`, `127.0.0.1`). Nếu ứng dụng được phục vụ từ địa chỉ khác, chạy `npm run bridge -- --allow-origin https://dia-chi-cua-ban`.
- Đổi cổng: `npm run bridge -- --port 5000`, và đặt `VITE_BRIDGE_URL=http://127.0.0.1:5000` khi chạy/build ứng dụng.
- Mật khẩu không được lưu ở đâu cả.
