# Marsol MMS — Product Requirements Document

## Original Problem Statement
Marsol Group üçün B2B Networking şirkəti (500+ üzv) üçün hərtərəfli ERP sistemi: Şirkətlər, HR, Satış, Marketinq, Layihələr, Təşkilatçılıq, Maliyyə, Hesabatlar, Görüşlər, İclas, Tapşırıqlar, Mesajlar, Fayllar, Qeydlər. Tələblər: RBAC, multi-tenancy (Müəssisə izolyasiyası), açıq üzvlük formaları, davamiyyət, barter, AI analiz, vendor management, file storage, PWA + Push, Müqavilə Redaktoru.

## Tech Stack
- Frontend: React 18, Tailwind, Shadcn UI, Axios, Recharts
- Backend: FastAPI, Motor (MongoDB), JWT
- Integrations: Cloudinary, Resend, OpenAI (gpt-4o-mini), Firebase Cloud Messaging, python-docx

## Recently Completed (2026-02)
- Müqavilə Redaktoru forması sadələşdirildi: Sərgi adı / Başlama / Bitmə tarixi sahələri silindi. Bunun yerinə: **"Bu il müqavilə bağlanma tarixi"** ("Bakı şəhəri" sətrində istifadə olunur) və **"Stend №"** sahələri əlavə olundu.
- Müqavilə Redaktoru DOCX-də xidmət cədvəlindən sonra avtomatik **6 sütunlu qiymət cədvəli** (Stend №, Xidmətin adı, Ölçü vahidi, Qiymət, ƏDV, Yekun məbləğ) yaranır və formdakı dəyərlərlə dolur.
- Köhnə müqavilədən **tarix avtomatik çıxarılır** (parse-docx regex). Köhnə müqavilə yükləndikdə "Əsas müqavilə tarixi" sahəsi avtomatik dolur.
- Müqavilə Redaktoru — şablon-əsaslı generasiya: bütün şrift/maddə/cədvəl şablondan götürülür; yalnız placeholder-lər doldurulur
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
