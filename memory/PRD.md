# Marsol MMS — Product Requirements Document

## Original Problem Statement
Marsol Group üçün B2B Networking şirkəti (500+ üzv) üçün hərtərəfli ERP sistemi: Şirkətlər, HR, Satış, Marketinq, Layihələr, Təşkilatçılıq, Maliyyə, Hesabatlar, Görüşlər, İclas, Tapşırıqlar, Mesajlar, Fayllar, Qeydlər. Tələblər: RBAC, multi-tenancy (Müəssisə izolyasiyası), açıq üzvlük formaları, davamiyyət, barter, AI analiz, vendor management, file storage, PWA + Push, Müqavilə Redaktoru.

## Tech Stack
- Frontend: React 18, Tailwind, Shadcn UI, Axios, Recharts
- Backend: FastAPI, Motor (MongoDB), JWT
- Integrations: Cloudinary, Resend, OpenAI (gpt-4o-mini), Firebase Cloud Messaging, python-docx

## Recently Completed (2026-02)
- Müqavilə Redaktoru: **Xidmətlər bölümü artıq statikdir** — Marsol-un 13 standart sərgi xidməti DOCX-də 1 sütunlu Table Grid kimi düzgün cədvəl şəklində render olunur. UI-də dinamik input-lar silindi, yalnız oxunan preview qaldı.
- Müqavilə Redaktoru üçün ayrıca **`contracts` modul icazəsi** (backend API-də də artıq `check_permission("contracts", ...)`; Settings → Rollar modalında ayrı sətr; admin və mövcud Mühasib rolu üçün avtomatik write backfill)
- Finance > Müqavilə Redaktoru: DOCX parse, VÖEN/Şirkət avtomatik çıxarış, Əlavə Müqavilə (Addendum) DOCX generasiya, ƏDV avtomatik hesablanma
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
