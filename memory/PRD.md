# Marsol MMS — Product Requirements Document

## Original Problem Statement
Marsol Group üçün B2B Networking şirkəti (500+ üzv) üçün hərtərəfli ERP sistemi: Şirkətlər, HR, Satış, Marketinq, Layihələr, Təşkilatçılıq, Maliyyə, Hesabatlar, Görüşlər, İclas, Tapşırıqlar, Mesajlar, Fayllar, Qeydlər. Tələblər: RBAC, multi-tenancy (Müəssisə izolyasiyası), açıq üzvlük formaları, davamiyyət, barter, AI analiz, vendor management, file storage, PWA + Push, Müqavilə Redaktoru.

## Tech Stack
- Frontend: React 18, Tailwind, Shadcn UI, Axios, Recharts
- Backend: FastAPI, Motor (MongoDB), JWT
- Integrations: Cloudinary, Resend, OpenAI (gpt-4o-mini), Firebase Cloud Messaging, python-docx

## Recently Completed (2026-02)
- **2026-02-14 Bug fixes**: (1) Meetings PDF export (list + single) yenidən yazıldı — `overflow:linebreak`, kiçik font (7pt), sərt columnStyles, `tableWidth:'wrap'`; single-meeting PDF-də "Qeyd" artıq sərbəst mətn deyil, avtomatik səhifələnən cədvəl sətri kimi görünür. (2) Təkliflər → "Bazadan seç" modal-a `autoFocus` axtarış çubuğu əlavə olundu (brand/legal/sahibkar/telefon üzrə filter, boş nəticə mesajı, dialog bağlananda təmizlənmə). (3) Tapşırıqlar → Arxiv filtrlərində "İcraçı" və "Yaradıcı" artıq Shadcn Select dropdown (arxivdəki unikal dəyərlərdən dolur, "Bütün..." reset seçimi ilə). Testing agent iteration_65 keçdi.
- **2026-02-14 Assembly (İclas) düzəlişləri**: (a) İclas yaradılarkən iştirakçı / Məsul / İcraçı dropdown-larında ad ikiqat görünmə xətası düzəldildi — `employeeNames` artıq YALNIZ Aktiv sistem istifadəçilərindən doldurulur (HR əməkdaşları qarışdırılmır). (b) İclas PDF export-unda cədvəl sütunları A4 portrait boyunu keçirdi (194mm > 182mm) — bütün task cədvəlləri (agenda + general) və header cədvəli 182mm-ə uyğunlaşdırıldı (58/40/40/22/22 və 40/142); `overflow:linebreak`, `tableWidth:wrap`, `showHead:everyPage`, `rowPageBreak:auto` əlavə olundu. Testing agent iteration_66 & iteration_67 pdfplumber ilə pixel-dəqiq təsdiqlədi.
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
