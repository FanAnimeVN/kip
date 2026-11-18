# kip

**Giúp cả nhóm, và agent AI của từng người, luôn đi cùng một hướng.**

[English](README.md) · MIT · Không phụ thuộc thư viện nào · Chạy với Claude Code, Codex, Cursor, Copilot, Gemini CLI và mọi agent đọc `AGENTS.md`

> Tên **kip** lấy từ chữ *kịp*: *theo kịp nhóm*, *biết kịp thời*.

---

## Câu chuyện

Năm sinh viên, một đồ án nhóm, mỗi người code với một agent AI riêng.
Mình làm phần login suốt bốn ngày. Đến lúc mở repo của nhóm ra thì **khác hoàn toàn bản của mình**: nhóm đã chọn Prisma + Postgres, làm login ở một thư mục khác và chuyển sang pnpm. Bốn ngày công đổ sông đổ biển, và cảm giác bị bỏ lại thật sự rất cay đắng.

Không ai làm sai cả. Hướng đi của nhóm đã có từ trước, chỉ là nó **không đến được với mình**, và cũng không đến được với agent của mình.

Agent AI còn làm chuyện này tệ hơn. Trước đây phải gõ vài ngày mới lệch hướng; giờ agent viết 2.000 dòng theo hướng riêng chỉ trong một giờ. Nghiên cứu cũng cho thấy điều đó:

- Nhóm mà các thành viên đoán sai về cách nhau dùng AI thì điểm đồ án thấp hơn, và nhóm yếu chịu thiệt nhiều nhất ([Graf và cộng sự, 2026](https://arxiv.org/pdf/2606.23237)).
- Patch của nhiều agent làm song song, dù từng cái đều qua test riêng, vẫn vỡ khi ghép lại ở 97% lần chạy trên các bài toán dựng có kiểm soát ([Xia, Wu & Park, 2026](https://arxiv.org/abs/2609.25396v1)).

**kip rút ngắn khoảng thời gian từ lúc "bắt đầu lệch hướng" đến lúc "có người nhận ra", từ vài tuần xuống còn vài phút.**

## Trông như thế nào

Mỗi lần bạn mở agent, nó tự chạy `kip brief` và báo cho bạn **trước khi viết dòng code nào**:

```text
kip · Tin từ nhóm (origin/main)

2 commit trên nhánh chung mà bạn chưa có:

  Alice · 2 commit · 3 ngày trước
    • feat(auth): login API with sessions in Postgres
    • feat(db): Prisma + Postgres, User model
    vùng: src/features, src, prisma

  Thư viện: + @prisma/client  + pg  + prisma
  Data model: prisma/schema.prisma
  Quyết định:
    + Dùng Prisma + PostgreSQL cho database

Bạn so với nhóm:
  ⚠ Bạn thêm mongoose, nhưng quyết định "Dùng Prisma + PostgreSQL cho database" nói tránh nó.
  ⚠ Cả bạn và Alice đều đang làm "auth" — ở hai chỗ khác nhau:
      bạn: src/auth/login.js
      Alice: src/features/auth/loginRoute.js
  ⚠ Bạn đang cài thư viện bằng yarn, còn nhóm dùng pnpm.
  ⚠ Bạn và nhóm cùng sửa 1 file:
      src/index.js (Alice)
  ⚠ Bạn đang chậm 2 commit (4 ngày) so với nhánh chung.

  Nên làm gì:
  → Hỏi nhóm trước khi dùng thư viện khác — hoặc đề xuất đổi quyết định: kip decide "..."
  → Nhắn Alice: hai bạn có đang làm trùng một việc không? Chốt ai làm phần nào.
  → Xoá lockfile của bạn và cài lại bằng pnpm.
  → Cập nhật code của nhóm trước khi làm tiếp: git pull --rebase (hoặc git merge origin/main).
```

Xem thử trong 30 giây, không đụng gì tới repo của bạn:

```bash
npx -y @tiou/kip demo --lang vi
```

## Bắt đầu

Trong thư mục dự án (bất kỳ git repo nào có nhánh `main` chung):

```bash
npx -y @tiou/kip init --lang vi
```

Commit những gì kip vừa tạo rồi push. Xong: agent của mọi người trong nhóm sẽ tự đọc.

| `init` tạo ra | Ai đọc |
|---|---|
| `.kip/decisions.md` | Con người. Các quyết định của nhóm, viết bằng lời thường, tự gợi ý từ thư viện đang dùng |
| `AGENTS.md` | Codex, Cursor, Copilot coding agent, Zed, Amp, Jules… |
| `CLAUDE.md` + hook trong `.claude/settings.json` | Claude Code. Tự báo cáo khi mở phiên mới |
| `GEMINI.md` | Gemini CLI |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.cursor/rules/kip.mdc` | Cursor |

kip chỉ sửa phần của riêng nó (giữa `<!-- kip:start -->` và `<!-- kip:end -->`); phần còn lại của file vẫn là của bạn.

## Cách hoạt động

Thứ cần đồng bộ là **quyết định**, không phải code. Code thì git đã lo.

1. **Một nguồn sự thật nằm ngay trong repo**: `.kip/decisions.md`. Markdown thường, có lịch sử git, viết tiếng Việt hay tiếng Anh đều được.
2. **Biên dịch vào hướng dẫn của mọi agent**, nên Cursor của bạn cùng nhóm và Claude Code của bạn tuân theo cùng một bộ quyết định.
3. **Báo cáo đầu mỗi phiên agent**: đồng đội đã đổi gì từ lần cuối bạn xem, và phần bạn đang làm có lệch không.
4. **Kiểm tra tất định, ít mà chắc.** Không gọi AI, không cần API key, không cần server, không cần tài khoản. Chỉ cảnh báo khi có tín hiệu cụ thể:

| Tín hiệu | Ví dụ |
|---|---|
| Vi phạm quyết định | Bạn thêm `mongoose`; nhóm đã quyết "tránh mongoose" |
| Cùng việc, khác thư viện | Bạn thêm `axios`; nhóm dùng `ky` (khoảng 20 nhóm: ORM, DB, auth, state, UI kit, test…) |
| Làm trùng | Bạn và Alice cùng tạo file `auth` mới, ở hai chỗ khác nhau |
| Khác package manager | Bạn commit `yarn.lock`; nhóm dùng pnpm |
| Sửa trùng file | Cả hai cùng sửa `src/index.js` |
| Data model thay đổi | Nhóm đã sửa `prisma/schema.prisma` |
| Bị bỏ lại | Bạn chậm 12 commit / 4 ngày so với `origin/main` |

Agent của bạn là "người kể chuyện": nó đọc output của kip và giải thích lại bằng ngôn ngữ của bạn. Bản thân kip không gọi mô hình AI nào.

## Lệnh

```bash
kip init                    # cài kip cho repo
kip brief                   # tin từ nhóm + cảnh báo lệch hướng
kip check                   # mình có đang đi khác nhóm không? (--strict trả mã lỗi 1 cho CI)
kip decide "Dùng Zod để validate" --why "một schema cho cả client và server" --use zod --avoid yup,joi
kip suggest [--write]       # gợi ý quyết định từ thư viện nhóm đang dùng
kip sync                    # cập nhật lại hướng dẫn cho agent sau khi sửa decisions.md
kip summary [--notify]      # tóm tắt một nhánh/PR bằng lời thường
kip demo                    # demo 30 giây trong thư mục tạm
```

## PR và nhóm chat (GitHub Action)

Cho cả những bạn không code (hoặc không pull) nắm được mọi PR bằng lời thường, kèm cảnh báo lệch hướng, ngay trong PR và trên Discord/Slack. Xem file mẫu [examples/kip-workflow.yml](examples/kip-workflow.yml). Mỗi PR chỉ có một comment tóm tắt, tự cập nhật sau mỗi lần push.

## Hỏi đáp

**Code của mình có bị gửi đi đâu không?** Không. kip là CLI chạy trên máy, chỉ đọc git. Webhook (tuỳ chọn) chỉ gửi đoạn tóm tắt tới URL do bạn chọn.

**Có cần API key không?** Không. Agent bạn đang dùng sẽ giải thích output của kip.

**Có bị spam không?** kip im lặng khi không có tín hiệu cụ thể. Mọi kiểm tra đều tất định: cùng đầu vào thì luôn ra cùng kết quả.

**Chỉ dành cho sinh viên?** kip bắt đầu từ một đồ án nhóm, nhưng team nào mà mỗi người code với một agent khác nhau cũng gặp đúng vấn đề này.

## Đóng góp

Rất hoan nghênh issue và PR, nhất là thêm nhóm thư viện, thêm agent và bản dịch. Xem [CONTRIBUTING.md](CONTRIBUTING.md).
