# Marsol MMS — Product Requirements Document

## Original Problem Statement
Marsol Group üçün B2B Networking şirkəti (500+ üzv) üçün hərtərəfli ERP sistemi: Şirkətlər, HR, Satış, Marketinq, Layihələr, Təşkilatçılıq, Maliyyə, Hesabatlar, Görüşlər, İclas, Tapşırıqlar, Mesajlar, Fayllar, Qeydlər. Tələblər: RBAC, multi-tenancy (Müəssisə izolyasiyası), açıq üzvlük formaları, davamiyyət, barter, AI analiz, vendor management, file storage, PWA + Push, Müqavilə Redaktoru.

## Tech Stack
- Frontend: React 18, Tailwind, Shadcn UI, Axios, Recharts
- Backend: FastAPI, Motor (MongoDB), JWT
- Integrations: Cloudinary, Resend, OpenAI (gpt-4o-mini), Firebase Cloud Messaging, python-docx

## Recently Completed (2026-02)
- **2026-02-14 Təkliflər (Yeni Lead) UX + Bazadan seç düzəlişi**: (1) DIZAYN — "Bazadan seç" kiçik alt-xətli linkdən Şirkət adı yanında sıxılmışdı; indi Yeni Lead formasının ən üstündə tam-eninə (`w-full`) kəsik-xətli düymə "Mövcud şirkət bazasından seç" (Database ikonu ilə) yerləşdirildi. Edit rejimində göstərilmir. (2) AXTARIŞ nəticəsi seçildikdən sonra formada emerald bir "picked-company-hint" bandı görünür ("X seçildi. Layihə növünü seçib Əlavə et düyməsinə basın."); Şirkət adı manual redaktə olunduqda bu ipucu bandı yox olur. Toast şirkət adını təsdiqləyir. (3) Yeni Lead modalın "Əlavə et" düyməsinə basıldıqda modal bağlanmırdı — root cause: handleSubmit-də `_picked_from_db`/`_picked_company_id` daxili flag-ləri POST body-də getdiyi üçün detay səhv silinirdi. Fix: flags payload-dan çıxarılır, axios səhv detalı toast-a çıxarılır, uğur halında Yeni Lead modal + picker + form eyni anda sıfırlanır. (4) Radix Select `value='Baza'` uyğun `<SelectItem>` olmadığından `''`-ə düşürdü → POST-da source boş qalırdı. SelectContent-ə `Baza` seçimi əvvəlcədən inject edildi (backend lead_sources-də yoxdursa). Testing agent iteration_71 kritik bug tapdı → iteration_72 100% PASS. Root cause — `_sync_assembly_tasks` `assignee` və `responsible_person` sahələrini vergüllə birləşdirilmiş STRİNG kimi saxlayırdı ("Nicat, Elnur"). MongoDB `{assignee: user_name}` yalnız massiv elementləri üzərində element-match edir; string bərabərliyi heç vaxt uyğunlaşmırdı → hər iştirakçı üçün İclas tapşırıqları gizli qalırdı. Həmçinin `created_by` və `marsol_company` sahələri iclasdan tapşırığa ötürülmürdü. Düzəliş: sahələr LIST olaraq saxlanılır, `created_by`/`marsol_company` propaqasiya olunur, notifikasiyalar hər iştirakçıya (yaradan istisna) göndərilir, PUT-da idempotent re-sync (58 legacy sətir migrasiyası ilə düzəldildi). Testing agent iteration_70 pytest 7/7 PASS.

- **2026-02-14 İclas PDF overlap (final)**: Root cause — `doc.text()` ilə çəkilən bölmə başlıqları səhifə sonunda tək qalıb cədvəl növbəti səhifəyə keçirdi; `rowPageBreak:'auto'` uzun sətirləri bölürdü. Düzəliş: `drawTasksBlock`/`drawListBlock` başlığı colSpan=5 sətri ilə cədvələ bağladı; `ensureSpace(50/25)` qalan sahəni yoxlayır; `rowPageBreak:'avoid'`; `showHead:'firstPage'`. Testing agent iteration_69 stress-test PASS.

- **2026-02-14 Bug fixes**: (1) Meetings PDF export (list + single) yenidən yazıldı — `overflow:linebreak`, kiçik font (7pt), sərt columnStyles, `tableWidth:'wrap'`; single-meeting PDF-də "Qeyd" artıq sərbəst mətn deyil, avtomatik səhifələnən cədvəl sətri kimi görünür. (2) Təkliflər → "Bazadan seç" modal-a `autoFocus` axtarış çubuğu əlavə olundu. (3) Tapşırıqlar → Arxiv filtrlərində "İcraçı" və "Yaradıcı" artıq Shadcn Select dropdown.
- **Stend Yerləşim Planı (DOCX)**: 3-cü sənəd növü əlavə olundu. `/app/backend/templates/stand_plan_template.docx` şablonu istifadə olunur. Sistem yalnız Şirkət adı, Sahibkar adı, Stend №, En, Uzunluq və avtomatik hesablanmış sahə (en × uzunluq) sahələrini doldurur. API endpoint: `GET /api/contracts/{id}/stand-plan`. Frontend-də cədvəlin yanında "Plan" düyməsi.
- Forma yenilikləri: **En (m)**, **Uzunluq (m)** və avtomatik hesablanan **Sahə (m²)** sahələri. m² readonly-dir, hər dəyişiklikdə real vaxtda yenilənir.
- Hesab Faktura (XLSX) generasiyası: yalnız müştəri-spesifik xanalar doldurulur
- Müqavilə Redaktoru DOCX: qiymət cədvəli artıq boz başlıqlı, "Məbləğ yazı ilə:" sətri avtomatik əlavə olunur
- Tarix regex genişləndirildi: `DD.MM.YYYY`, `DD/MM/YYYY`, "14 iyul 2025", "«14» iyul 2025-ci il" formatları dəstəklənir. Yalnız real (2015-2099) tarixlər çıxarılır.
- Müqavilə Redaktoru forması sadələşdirildi: Sərgi adı / Başlama / Bitmə sahələri silindi. "Bu il müqavilə bağlanma tarixi" və "Stend №" əlavə olundu.
- HR KPI tab (executor/responsible üzrə tapşırıq statistikası)
- Tasks: multi-assignee, çətinlik, estimated duration, overdue rəng, RBAC (yalnız creator/admin tam redaktə), Auto-Archive (gün sayı Tənzimləmələrdən), bulk delete (admin)
- Multi-tenancy (Müəssisə) data isolation across Tasks/Meetings/Files/Assembly/Notes
- Attendance: bütün aktiv istifadəçilər (0 sessiya olsa belə)
- Package Services, Service Usage tracking, manageable lists, Notes module, Sticky Notification Bell

## Backlog (P1 → P2)
- P1: Üzvlük Sertifikatı modulu (Legal/Brand əsasında, Company Detail "Sertifikat" tab)
- P1: Marketinq modulunun davam etdirilməsi
- P2: Excel import (Members, Sales Leads, HR)
- P2: Bulk Curator təyini Companies modulunda
- P2: `server.py` refaktoru (~9800 sətir → `/app/backend/routes/`)
- P2: Company Detail-də "Qeydlər" tab
- P2: PDF Reports / Export enhancements

## Test Credentials
Bax: `/app/memory/test_credentials.md`

## Known Issues
None.
