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
| 17 | Təşkilatçılıq (event + auto-suggest + WhatsApp + Maps) | ✅ |
| 18 | Mesajlar | ✅ |
| 19 | Tənzimləmələr (Roles, paketdə dəvət sayı, forum fields) | ✅ |
| 20 | Bildirişlər | ✅ |
| 21 | RBAC (dynamic roles, check_permission, PermissionContext) | ✅ |
| 22 | Public Form (/form/:token — dinamik dropdown + upload) | ✅ |

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
