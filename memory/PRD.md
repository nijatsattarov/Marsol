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
- [x] **Resend Email Notifications** — `resend` SDK + `email_service.py` (notify, send_email, branded HTML wrap); admin@marsol.az + əlaqədar curator hər zaman alıcıdır; hooks: yeni Görüş, Lead 'Bağlandı', Public form göndərimi; idempotent `POST /api/notifications/dispatch-emails` (notification_email_log koleksiyası); NotificationBell.jsx polling token mövcud olduqda işləyir — ✅ Iter 31 (19/19 pytest PASS, frontend smoke 100%)
- [x] **Sidebar yenidən qurulması + Sistem fəaliyyəti** — Davamiyyət İnsan Resurslarının alt-elementi (İşçilər + Davamiyyət); Barter Maliyyənin alt-elementi (Mühasibat + Barter); Yeni `user_sessions` koleksiyası (login_at, last_active_at, logout_at); Yeni endpointlər: `POST /auth/heartbeat`, `POST /auth/logout`, `GET /attendance/system-sessions`; DashboardLayout 60 saniyədən bir heartbeat göndərir; Sidebar logout-da /auth/logout çağırılır; Davamiyyət-də yeni "Sistem fəaliyyəti" tab — Giriş/Çıxış vaxtları, Aktiv müddət (live), Status, Excel export — ✅ Iter 32 (10/10 pytest PASS, frontend 100%)
- [x] **Maliyyədə Marsol müəssisəsi seçimi** — `marsol_company` sahəsi: ExpenseCreate, IncomeCreate, companies/{id}/finance, sales-leads POST/PUT/payment endpointlərində; Frontend: Finance Xərc/Gəlir/Layihə-Satış ödəniş modal-larında və CompanyDatabase Lead-modalda (status=Satıldı/Üzv oldu) "Marsol müəssisəsi" dropdown (Tənzimləmələr → Müəssisələrdən dinamik); Xərclər cədvəlində Müəssisə sütunu + filter; Maliyyə > İcmal-da "Müəssisəyə görə icmal" cədvəli (Gəlir/Borc/Xərc/Xalis); Excel ixracı yenilənib — ✅ Iter 33 (7/7 pytest PASS, frontend 100%)
- [x] **Görüşlərə Kalendar görünüşü** — Cədvəl ↔ Kalendar toggle (header); aylıq grid (42 gün, B.e başlanğıclı, az-AZ ay/gün adları); günün hücrəsində max 3 görüş (saat + əməkdaş + rəng kodu: Online=mavi/Müştəri=yaşıl/Daxili=amber/Digər=lime); günə klikləyəndə Dialog açılır — saat üzrə sıralanmış görüşlər (əməkdaş, şirkət, məkan, növ, rejim badge-ləri); ay önə/arxaya keçid + "Bu ay" düyməsi; bu gün yaşıl ringlə vurğulanır; həftəsonu qırmızı; karandaş ikonu redaktə modal-ını açır; bütün filterlər (axtar/növ/şöbə/əməkdaş/tarix) kalendar görünüşünə tətbiq olunur — ✅ Iter 34 (frontend 100% — 9/9 acceptance criteria)
- [x] **AI Data Analyst → OpenAI direct SDK** — `requirements.txt`-dən `emergentintegrations` + transitive google/grpc paketləri silindi (Render build conflict həll olundu); `/api/ai/analyze` indi OpenAI Async SDK (`gpt-4o-mini` default, `AI_ANALYST_MODEL` env-də konfiqurasiya olunur, JSON-mode response_format); lokal pod-da fallback olaraq `emergentintegrations` (mövcud olduqda) — ✅ 2026-04-27 (curl smoke: "Neçə şirkət var?" → 15)
- [x] **İclas modal-da kursor itirilməsi bug-u** — `Assembly.jsx`-də `ListField`/`TaskRow`/`DetailTaskRow` parent-in daxilində elan olunmuşdu (hər render-də yeni komponent referansı → input unmount/remount → focus itirdi). 3 komponent module-scope-a köçürüldü, props ötürüldü — ✅ 2026-04-28 (Playwright: 28+ keystroke focus saxlandı)
- [x] **Cloudinary inteqrasiya** — server-side upload (POST /api/uploads, DELETE /api/uploads); Files modulu CRUD (GET/POST/DELETE /api/files) + tam UI (grid, search, upload modal, preview); Legacy /api/upload + /api/public/upload Cloudinary-ə yönləndirildi (Render-də ephemeral disk problemi həll olundu — Companies/HR/Settings/PublicForm uploadları avtomatik Cloudinary-də saxlanılır); folder whitelist (marsol/files|companies|employees|projects); 25MB limit; resource_type avtomatik (image/video/raw); cloud=ddyysroag — ✅ Iter 35 (15/15 backend, 100% frontend)
- [x] **Şirkətlər Excel idxalı** — `POST /api/companies/import-excel` (multipart Excel); 3 sütun: Şirkət adı + Paket + Ödənilib (opsional); `db.packages`-dən paket qiyməti avtomatik təyin olunur, `total_amount`/`paid_amount`/`debt_amount` həm top-level, həm `contracts[0]`-da doldurulur; `display_id=C0xxx` avtomatik təyin olunur; cavab: `{created, updated, skipped, total, errors[]}` — ✅ 2026-04-30 / 2026-05-01
- [x] **Batch dəyişiklik (10 item Iter 36)** — Dashboard-dan maliyyə qrafikləri silindi; HR Excel ixracı düzgün xlsx formatında (15 sütun); Companies ixracı sütun seçici modal (25 sütun, Hamısı/Default/Sıfırla qısayolları); ContactLists-də doğum tarixi sahəsi; PhoneInput komponenti (32 ölkə prefiksi); Companies-də ölkə seçici; Files endir avtomatik download (Cloudinary fl_attachment); Şirkət `display_id` (C0001…) startup backfill + auto-increment; Üzvlər siyahısında card+table-da display_id badge; Custom fields ətraflı baxış-da görünür (Companies/HR `CustomFieldsView` komponenti); Doğum günü bildirişləri (sahibkar/nümayəndə/əməkdaş/kontaktlar — bu gün=high, sabah=medium, illik) — ✅ Iter 36 (8/8 backend, 92%→100% frontend)
- [x] **Batch dəyişiklik (6 item Iter 37/38)** — HR Sənədlər tab `DocumentUploadCard` modul-scope reusable komponentlə təmizləndi (məhkumluq + sağlamlıq yan-yana, sertifikatlar+digər sənədlər); Yeni `ExcelColumnPicker` universal komponenti (`/app/frontend/src/components/ExcelColumnPicker.jsx`) — Companies/Members/HR ixraclarına tətbiq olunub (lokalStorage-da seçim yadda qalır); Members ixracı 20 sütunlu xlsx (CSV-dən köçdü); Birthday bildirişləri `company_name` field + "Role (Şirkət) — tarix" message formatı; Yeni `app_config.notification_settings` koleksiyası + `GET/PUT /api/settings/notification-config` endpoint-ləri (6 açar: membership_warning_days, contract_expiry_days, birthday_advance_days, debt_overdue_high_days, meeting_reminder_high_days, meeting_reminder_medium_days) backward-compat ilə legacy `setting_lists.membership_warning_days`-ə güzgüləyir; Settings səhifəsi yenidən dizayn — sol panel-stil qruplaşdırılmış sidebar nav (Üzvlük/Layihə&Satış/Klassifikasiya/Sistem) — ✅ Iter 37/38 (12/12 backend, 6/6 frontend)
- [x] **Lead → Üzv ID düzəlişi** — Lead "Üzv oldu" → yeni `companies` qeydi indi `_next_company_display_id()` ilə `Cxxxx` formatda gəlir; lead-dən paid_amount/total_amount/package/contract dates düzgün propaqandalaşır (`{**lead, **update_data}`); `POST /api/members` də display_id təyin edir; Companies.jsx `#${i+1}` fallback silindi — ✅ 2026-05-01
- [x] **Paket Xidmətləri (2026 broşür)** — Hər paketdə `services` array (`{id, name, description, value, included, sort_order}`); Yeni endpointlər: `GET/POST /api/settings/packages/{id}/services`, `PUT/DELETE /api/settings/packages/{id}/services/{service_id}`, `POST /api/settings/packages/services/seed` (19 xidmət catalog Premium/Business/Business+ üçün, Sponsor skip); Yeni `PackageServicesManager` komponenti (Settings → Paketlər → "Xidmətlər" düyməsi) inline CRUD + Seed düyməsi; Yeni read-only `PackageServicesView` komponenti — Companies detail (Ödəniş tab) və Members əlavə/redaktə modal-da paketin xidmətləri ✓/✗ + dəyər badge ilə görünür — ✅ Iter 39 (16/16 backend PASS)
- [x] **Şirkət üzrə Xidmət İstifadəsi (full plan)** — Yeni `service_usage` koleksiyası; Endpointlər: `GET/POST /api/companies/{id}/service-usage`, `PUT/DELETE /api/service-usage/{id}`, `GET /api/companies/{id}/service-stats` (quota parsing: '15'→15, '5 dəfə'→5, 'limitsiz'→unlimited=true), `GET /api/dashboard/service-usage-stats?month=YYYY-MM`; `auto_track_service_usage()` helper + `_MEETING_TYPE_TO_SERVICE_KEYWORDS` mapping (B2B/Səhər yeməyi/Dövlət/Konfrans/Region/Onlayn/Akademiya/Sosial), `POST /api/meetings` hook-ında idempotent auto-record yaradılır (related_object_type='meeting'); Frontend: Şirkət detalında yeni "Xidmət istifadəsi" tab (`ServiceUsageTab` komponenti) — hər xidmət üçün limit/istifadə/qalıq progress bar + "Qeyd et" + history toggle + edit/delete; Dashboard-da `ServiceUsageWidget` (top 5 xidmət bu ay + total qeyd + aktiv növ sayı) — ✅ Iter 40 (16/16 backend PASS, frontend smoke ✓)
- [x] **401/403 auto-logout bug fix** — Dashboard-dakı problematik "Yenidən cəhd et" düyməsi silindi (46 saniyəlik retry loop idi); Dashboard-da 401/403 → avtomatik localStorage təmizlənir + `/login`-ə yönləndirir; Global axios interceptor əlavə edildi (`App.js`) — istənilən modulda 401/403 → auto-logout + redirect (skip login endpoint-i, yanlış parol mesajı qorunur); Artıq "yalnız logout/login sonra düzəlir" problemi yoxdur — ✅ Smoke test PASS (bogus token → /companies → avtomatik /login redirect)
- [x] **3-item batch (Password toggle + Universal Lists + HR Müəssisə)** — (1) Settings → İstifadəçilər modal-ında şifrə sahəsinə Eye/EyeOff toggle düyməsi; (2) Yeni Universal "Siyahılar" tab Settings-də (`ManageableListsPanel` komponenti) — 16 idarə olunan siyahı 6 qrupa bölünüb (Şirkət/HR/Tapşırıqlar/Satış/Maliyyə/Tədbirlər); sidebar + chip-style values + Hamısı/Default/Sil əməliyyatları; Backend `MANAGEABLE_LISTS` registry + `GET /api/settings/manageable-lists` endpoint-i + `/api/options/all` artıq dinamik oxuma edir; (3) HR cədvəlində "Əmək haqqı" sütunu "Müəssisə" (marsol_company) ilə əvəz olundu — ✅ Iter 41 (17/17 backend PASS)
- [x] **Lead konversiyası mənbə + Notes modulu** — (1) `POST /api/contacts/{id}/convert-to-lead` artıq `source_contact_list_id`, `source_contact_list_name`, `source_contact_id` saxlayır; lead → company konversiyasında `joined_project=""` (avtomatik "Üzvlük" düşmür, user manuel seçir); company-yə source və source_contact_list propaqandalaşır; Companies detail "Müqavilə" tab-ında Mənbə badge + Siyahı adı görünür; (2) Notes modulu tam quruldu — `notes` koleksiyası, 8 rəngli kartlar (Google Keep style), pin/unpin, etiketlər, axtarış, filter (sancılmış / etiket), shared_with_all, Pinned/Digərləri qruplaşdırma; backend: GET/POST/PUT/DELETE /api/notes + /notes/tags; permission `notes` modulu ilə qorunur (yalnız müəllif redaktə edə bilər, admin bütününü görür) — ✅ Curl PASS (CRUD + tags), frontend smoke ✓ (2 qeyd Sancılmış + Digərləri qruplarında düzgün göründü)
- [x] **Sales Leads — Kurator dropdown + Mənbə Siyahısı (final)** — Lead yaratma/redaktə modal-ında "Kurator" dropdown (data-testid `lead-curator-select`, marsol_representatives-dən); Lead bir Siyahıdan (contact-list) yaradılıbsa modal-da "Siyahı: <ad>" chip görünür (data-testid `source-list-info`); Backend bug fix: `POST /api/sales-leads` artıq payload-dakı `curator`-ı saxlayır (server.py:2054 — `data.get("curator") or current_user.get("name","")`); `POST /api/contacts/{id}/convert-to-lead` `source_contact_list_name`-i `contact_lists.title` sahəsindən düzgün oxuyur (server.py:1981 — `cl.get("title") or cl.get("name","")`); 'Üzv oldu' transition company-yə həm curator həm source_contact_list_name düzgün ötürür — ✅ Iter 43 (7/7 pytest PASS)
- [x] **Sales Leads cədvəlində Mənbə klikabıl link** — "Siyahı: <ad>" tək sətrdə qarşıda görünür (alt sətirdəki dublikat silindi); klik → `/sales/contact-lists?list=<id>` ünvanına yönləndirir; ContactLists.jsx `?list=<id>` query parametrini avtomatik açır — ✅ 2026-05-05 (smoke ✓)
- [x] **Toplu email Mailchimp ilə** — `POST /api/marketing/email/bulk` endpoint-i Resend-dən Mailchimp-ə keçirildi. Axın: (1) seçilmiş alıcıları audience-ə upsert edir (mövcud olmayanlar əlavə olunur), (2) static segment yaradır həmin alıcıları daxil edən, (3) regular kampaniya yaradır segment-ə hədəflənmiş, (4) send_now=true ilə göndərir, yoxdursa Mailchimp-də qaralama olaraq qalır; nəticə: synced_to_audience, segment_member_count, campaign_id, campaign_status; hər alıcı üçün email_logs row (provider='mailchimp'); audience üzvləri qoruyur (audience get-zarar, dub-fall var ekvivalent). Frontend `BulkEmailModal` yenidən yazıldı: Mailchimp audience seçicisi (məcburi), preview text + reply-to + send_now, Mailchimp badge — ✅ 2026-05-06 (curl validation PASS, ping=MARSOL GROUP/us18/MMS)
- [x] **Daxili audiens üçün toplu email** — Mailchimp-ə əlavə olaraq sistem daxili Resend ilə email göndərmə funksiyası. Backend: `POST /api/marketing/email/bulk` (recipient_type: companies/members/contacts/project_leads + ids[]; yaxud explicit recipients[{email, name?}]) — companies-dən contact_email + owner_email ikisini də çıxarır, contacts-dan email çıxarır, sales-leads-dən çıxarır; deduplicate by email; hər email-i `email_logs` koleksiyasında qeyd edir (status sent/failed, error, sent_by); validation: subject + html boş olarsa 400. `GET /api/marketing/email/logs?category=` audit log endpointi. Frontend: yeni `BulkEmailModal` komponenti (subject + HTML məzmun + nəticə paneli + xəta detalları açılır); Companies bulk-bara "Toplu Email" düyməsi (data-testid='bulk-email-btn') Toplu SMS yanında; ContactLists detail səhifəsinə "Toplu SMS" + "Toplu Email" düymələri (siyahı bütün kontaktlarına göndərir) — ✅ 2026-05-06 (curl validation PASS, smoke ✓) [GÜNCƏLLƏNDI: indi Mailchimp ilə]
- [x] **Mərhələ 3 — 3 böyük modul** — (#16) MARKETING modulu Mailchimp inteqrasiyası ilə: yeni `mailchimp_service.py` (httpx async REST klienti, BasicAuth, datacenter avtomatik çıxarılır), 7 endpoint (`/marketing/mailchimp/ping|audiences|campaigns|sync-companies|create-send-campaign|report`), real hesab "MARSOL GROUP" (us18, label MMS), 2 audiens 1485 abunəçi, draft kampaniya yaradılması test edilib; Frontend `Marketing.jsx` — connection status card + audience kartları + kampaniya cədvəli + create modal (HTML editor, send_now çekboks) + sync companies + report modal (open/click/bounce statistikaları); (#15) PARTNYOR DƏYƏRLƏNDIRMƏ modulu — 100-ballıq sistem: ödəniş 40 + tədbir 30 + digər layihə 15 + görüş 10 + əlavə bal 5; tier-lər: Platinum (≥85), Qızıl (≥65), Gümüş (≥40), Standart; endpoint-lər: GET /api/partner-evaluation (top-down), GET /{company_id}, PUT /{company_id}/manual-bonus; `partner_evaluations` koleksiyası; Frontend `/partner-evaluation` — sidebar-da Trophy ikonu, ranklenmiş cədvəl, hər şirkət üçün əlavə bal redaktə modal-ı; (#3) MESSAGE GROUPS — `message_groups` və `group_messages` koleksiyaları, 6 endpoint `/api/message-groups*`, permission: yalnız member oxuya/göndərə bilər, yalnız creator/admin silə bilər; Frontend Messages-də "Yeni qrup" düyməsi + modal — ✅ Iter 47-48 (20/20 pytest PASS). Critical fix: route shadowing /api/messages/groups → /api/message-groups
- [x] **Mərhələ 2 — 4 orta səviyyəli düzəliş** — (#6) İclas modalında PersonTags-a axtarış input-u əlavə edildi və hər task-ın "Tarix seç" sahəsi shadcn Popover + Calendar ilə əvəz edildi (browser-native date input əvəzinə hər mühitdə işləyir); (#8) Yeni `CarryOverPicker` komponenti — modal-da "↶ Köhnə iclasdan köçür" düyməsi, popover-da son 30 keçmiş iclasın gündəmləri (çekboks ilə seçim, "Köçür" düyməsi cari draftə əlavə edir); (#10) ProjectDetail səhifəsinə "Müştəri əlavə et" düyməsi (avtomatik project_id link, status='Satıldı'), sütun adları yeniləndi (Şirkət → Müəssisə, Sahibkar → Ad Soyad, yeni Vəzifə sütunu); (#17) Forum məcburi sahələr — yeni `forum_required_fields` setting list, GET/PUT `/api/forum/fields` `required` field-i qaytarır/qəbul edir, public submit endpoint məcburi sahələr boş olarsa 400 + AZ dilli hata mesajı qaytarır, Settings → Forum-da hər enabled checkbox yanında ★ ikon, PublicForm-da məcburi label-larda qırmızı * — ✅ Iter 46 (6/6 backend pytest PASS, 5/5 frontend smoke ✓)
- [x] **Mərhələ 1 — 7 sürətli düzəliş** — (#4) Tasks status dəyişdikdə optimistic UI ilə kart dərhal yeni Kanban sütununa keçir (refresh-siz, error-da rollback); (#5) İclas (Yeni İclas) modal-ı kənar klik və ESC ilə bağlanmır, yalnız X / Ləğv et / Yarat-Yadda saxla bağlayır, X və Ləğv et confirm("Bağlamaq istədiyinizdən əminsiniz?") sualı ilə qorunur; (#7) "Son tarix" → "İclasın keçirildiyi tarix"; (#9) Maliyyə Gəlir filterlərinə "Müəssisə" dropdown əlavə edildi (filter-marsol-company); (#12) Companies form-da yeni "Təşkilat forması" dropdown (MMC/ASC/QSC/Fərdi sahibkar/Fond/İB/Digər) — yeni `organization_forms` Manageable List, `/api/options/all`-da exposed, Companies detail "Şirkət" tab-ında göstərilir; (#13) Xərc Əlavə et-də "Məsul şəxs" Input-dan Select-ə çevrildi (sistem istifadəçiləri + əməkdaşlar avtomatik birləşir, 30+ seçim); (#18) Fəaliyyətlər (Organization) modulunda hər invitation-ın altında inline qeyd input-u (qatılmama səbəbi və s.) + yeni endpoint `PUT /api/invitations/{id}/notes` — ✅ Iter 45 (5/5 backend pytest PASS, frontend 6/6 smoke ✓)
- [x] **LSIM SMS inteqrasiya** — Yeni `sms_service.py` (LSIM Quick SMS REST API klienti, MD5 hash auth, unicode autodetect, AZ phone normalization 0XX/+994 → 994XXX); 8 yeni endpoint: `GET /api/sms/balance`, `GET/PUT /api/sms/templates/{key}`, `POST /api/sms/send`, `POST /api/sms/bulk`, `GET /api/sms/logs`, `GET /api/sms/logs/stats`, `POST /api/sms/dispatch-daily` (idempotent); Yeni koleksiyalar: `sms_logs` və `sms_templates`; Frontend: Settings → "SMS" tab + Companies-də "Toplu SMS" düyməsi (`BulkSmsModal`) — ✅ Iter 44 (25/25 pytest PASS)

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
