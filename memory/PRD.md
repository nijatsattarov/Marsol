# Marsol Group İdarəetmə Sistemi (MMS) — PRD

## Haqqında
Marsol Group — 500+ üzvü olan B2B netvörkinq şirkətidir. Sahibkarları görüşlərdə bir araya gətirir.

## Paketlər & Kvotalar (Dinamik — Tənzimləmələrdən idarə olunur)
| Paket | Dəvət sayı (illik) |
|-------|-------------------|
| Premium | 12 |
| Business | 15 |
| Business+ | 25 |
| Sponsor | 40 |

## Texnoloji Stek
- **Frontend**: React 18, Tailwind CSS, Shadcn UI, Axios, Recharts, SheetJS (xlsx)
- **Backend**: FastAPI, PyMongo (Motor), JWT Auth, Custom RBAC
- **Database**: MongoDB
- **Deploy**: Netlify (frontend) + Render (backend)

## Hazır Modullar
| # | Modul | Status |
|---|-------|--------|
| 1 | İdarə Paneli (fəaliyyət/dəvət statistikası) | ✅ |
| 2 | Şirkət Məlumatları (XLSX export) | ✅ |
| 3 | İnsan Resursları (7 tab) | ✅ |
| 4 | Davamiyyət (günlük/aylıq + məzuniyyət sorğuları + auto-attendance) | ✅ Iter 22 |
| 5 | Satış: Şirkət Bazası (pipeline) | ✅ |
| 6 | Satış: Üzvlər (read-only, müqavilə xəbərdarlıqları) | ✅ |
| 7 | Satış: Öhdəliklər (kvota dashboard + XLSX export) | ✅ |
| 8 | Satış: Öhdəlik Tarixçəsi | ✅ |
| 9 | Satış: Dəvətlər (qonaq izləmə, Lead-ə çevirmə) | ✅ Iter 21 |
| 10 | Satış: Siyahılar (Excel import/export, Lead-ə çevirmə) | ✅ Iter 21 |
| 11 | Layihələr / Tədbirlər (Sərgi, Forum, İftar, Tur və s.) | ✅ Iter 21 |
| 12 | Maliyyə | ✅ |
| 13 | Barter Əməliyyatları (auto-code, stats, net balance) | ✅ Iter 22 |
| 14 | Görüşlər (xatırlatma, filtr, bildiriş) | ✅ |
| 15 | İclas (Gündəm→Tapşırıq→Məsul sinxron, Task T-XXX, Excel export) | ✅ |
| 16 | Tapşırıqlar (T-XXX, related_object_type, filter) | ✅ |
| 17 | **Fəaliyyətlər (Təşkilatçılıq)** — Dashboard + 7 vendor alt-modul (Məkanlar, Catering, Dekor/texniki, Musiqiçilər, Foto/Video, Nəqliyyat, Materiallar) + Reytinq (tarixçə + aqreqasiya + tövsiyə statusu) | ✅ Iter 24 |
| 18 | Mesajlar | ✅ |
| 19 | Tənzimləmələr (Roles, paketdə dəvət sayı, forum fields) | ✅ |
| 20 | Bildirişlər | ✅ |
| 21 | RBAC (dynamic roles, check_permission, PermissionContext) | ✅ |
| 22 | Public Form (/form/:token — dinamik dropdown + upload) | ✅ |
| 23 | **Hesabatlar: AI Data Analyst** (Azərbaycan dilində prompt, GPT/Claude-driven MongoDB aggregation, cədvəl, Excel export, Siyahıya 1-kliklə əlavə) | ✅ Iter 23 |

### Placeholder Modullar (ComingSoon)
Marketinq, Hesabatlar, Fayllar, Qeydlər

## Əsas Data Modelləri
- `users`, `roles` — RBAC
- `companies`, `sales_leads`
- `employees`, `attendance`, `leave_requests`
- `project_events`, `event_invitations`, `contact_lists`, `contacts`
- `barters`
- `invitations` (köhnə: Obligations sistemi üçün)
- `meetings`, `tasks`, `assemblies`, `events`
- `incomes`, `expenses`

## Backlog
### P0 — Tamamlandı
- [x] Görüşlər modulu tam yenidən yazıldı — ✅ Iter 18
- [x] Şirkət Bazası (Satış Pipeline) — ✅
- [x] Assembly sinxron Tasks modulu ilə — ✅
- [x] Public Form dinamik dropdown + upload — ✅
- [x] RBAC + PermissionContext — ✅
- [x] Projects/Invitations/ContactLists modulları — ✅ Iter 21
- [x] Davamiyyət modulu — ✅ Iter 22
- [x] Barter Əməliyyatları — ✅ Iter 22
- [x] **AI Data Analyst (Hesabatlar)** — təbii dil sorğuları, cədvəl, Excel export, Siyahıya əlavə — ✅ Iter 23
- [x] **Fəaliyyətlər modulu tam yenidən qurulub** — 8 alt-modul + reytinq aqreqasiyası — ✅ Iter 24
- [x] **Settings → Layihə növləri** — "Layihə adı" → "Layihə növü", Təsvir sahəsi silindi; Projects modulunda "Növ" dropdown-u Settings-dən dinamik gəlir — ✅ 2026-04-23
- [x] **Rol bazlı Görünüş Miqyası (Scope)** — hər rol üçün per-modul "Hamısı"/"Yalnız özününki" radio; apply_scope + assert_scope_ownership backend-də; /api/sales-members missing-return bug fix; Tasks/Meetings assignee dropdown artıq sistem istifadəçiləri + HR birləşmiş — ✅ Iter 25 (12/12 pytest PASS)
- [x] **Lead → Layihə bağlantısı və Satış axını** — Şirkət Bazası formunda "Satış növü" → "Layihə növü" (Settings-dən dinamik); Lead redaktəsində status=Satıldı/Üzv oldu seçəndə dynamic sahələr (layihə seçimi + Üzvlük:Paket / Sərgi:kv/m+qiymət+stend+zal+avtomatik məbləğ / Tur,Təlim:iştirakçı); Projects modulunda "Satışlar" cədvəli (Sərgi: 11 sütun, Tur/Təlim: sadə, inline edit); Finance modulunda yeni "Layihələr" tab-ı (layihə növü→layihə→satış cədvəli Müqavilə №/E-qaimə/Ödənilib/Borc) — ✅ Iter 26 (8/8 pytest PASS)
- [x] **Layihə detalı səhifə + Finance payment inteqrasiyası** — Layihə kart-ına klik = yeni `/projects/:id` səhifəsi (axtarış, 11-key sütun filtrləri, Excel ixrac, inline edit); Tur/Təlim üçün yeni `total_price` layihə sahəsi, Lead-də avto-doldurma; Yeni endpoint `POST /api/sales-leads/{id}/payment` (payment_history append + paid_amount cəmi + meta yeniləmə); Maliyyə Layihələr tab Gəlirlər stilində yenidən dizayn (axtarış, filtrlər, payment modal: summary banner + Yeni Ödəniş + Maliyyə Meta + Ödəniş Tarixçəsi) — ✅ Iter 27 (10/10 pytest PASS, frontend 100%)
- [x] **Üzvlük dövrü idarəetməsi** — calendar year əsaslı il filtri (Üzvlər, Öhdəliklər, Öhdəlik Tarixçəsi), defolt cari il; `POST /api/members/{id}/renew` (cari müqaviləni `membership_history`-ə arxivlə + yeni dövr); carry_over_quota seçimi (`bonus_quota`); Üzv kartında 'Tarixçə' və '+N il' badge-ləri — ✅ Iter 28 (12/12 pytest PASS, frontend 100%)
- [x] **Öhdəlik Tarixçəsi → Excel Export** — 3 vərəqli xlsx (Dəvət tarixçəsi, Fəaliyyət növləri, Şirkət üzrə icmal) — ✅ 2026-04-24
- [x] **Maliyyədə Ödəniş üsulu + Forum Approval Flow** — payment_method (Köçürmə/Nəğd/Posterminal/CTC) Income, Expense, companies/payment, sales-leads/payment endpointlərində; public form göndərildikdə birbaşa şirkət sahələrini DƏYİŞMİR — `companies.pending_form_data`-ya yazır, notifications-da `form_submission` bildirişi yaradılır; Companies səhifəsində 📩 badge + yan-yana müqayisə cədvəli + Təsdiqlə/Rədd et düymələri — ✅ Iter 30 (14/14 pytest PASS, frontend 100%)

### P1
- [ ] PDF Reports generation (Hesabatlar modulu)
- [ ] Marketinq modulu funksional (kampaniya, email, şablonlar)
- [ ] Fayllar modulu (mərkəzi fayl saxlama)
- [ ] Qeydlər modulu

### P2
- [ ] server.py refaktor: /app/backend/routes/ alt-qovluğuna bölmək
- [ ] Members.jsx böyük komponentin komponentlərə parçalanması
- [ ] Barter → Maliyyə otomatik qeyd bağlantısı
- [ ] Attendance → HR analytics inteqrasiyası

## Deploy Qeydləri
- Frontend: Netlify (_redirects faylı SPA routing üçün əlavə olunub)
- Backend: Render (emergentintegrations kitabxanası requirements.txt-dən çıxarılıb)
- Preview URL-lər həmişə REACT_APP_BACKEND_URL-dən götürülür

## Test Statistikası
- Iter 18-20: Meetings, Assembly, Tasks
- Iter 21: Projects / Event Invitations / Contact Lists — 25/25 backend, full frontend
- Iter 22: Attendance / Leave Requests / Barter — 31/31 backend, full frontend
