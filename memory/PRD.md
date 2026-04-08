# Marsol Group İdarəetmə Sistemi - PRD

## Orijinal Problem Bəyanatı
Marsol Group üçün MMS (Management System) hazırlamaq. PDF texniki tapşırığına əsasən tam ERP sistemi.

## Tarix
- **2024-01**: MVP Dashboard, Şirkətlər, HR, Görüşlər, Tapşırıqlar hazırlandı
- **2025-02-A**: Tənzimləmələr səhifəsi (Paketlər, Layihələr, Xüsusi Sahələr, İstifadəçi İdarəetmə)
- **2025-02-B**: Sektorlar tənzimləmələrə əlavə, Paket qiyməti avtomatik borc, Təmsilçilər sistem istifadəçiləri
- **2025-02-C**: Maliyyə modulu yenidən yazıldı (şirkətlər bazalı, filtrlər, qeydlər, ödəniş redaktə)
- **2025-02-D**: Faza 5 tamamlandı: Satış (Kanban), Mesajlar, Bildirişlər, RBAC, Xüsusi sahə inteqrasiyası
- **2025-02-E**: Öhdəliklər modulu
- **2026-04-08A**: Şirkətlər modulu 15 nöqtəli yenidən yazma, Settings-ə Alt Sektorlar/Vəzifələr/Fəaliyyətlər tabları, backend bug fix
- **2026-04-08B**: Müqaviləyə uyğun ödəniş sistemi, Referans mənbəsi genişləndirilməsi (Şirkət/Şəxs/Media/Digər), Əlaqədar şəxs vəzifəsi Select, Region Select + Regionlar tab

## Əsas Modullar

### 1. Şirkət Məlumatları ✅ (YENİLƏNDİ)
- Cədvəl, filtrlər, axtarış, Excel export
- 6 tab: Şirkət, Sahibkar, Əlaqədar şəxs, Müqavilə, Ödəniş, Əlavə sahələr
- Çoxlu sahibkar, çoxlu müqavilə, fayl yükləmə (logo, bank, müqavilə skanı)
- VÖEN, region (Select), işçi sayı, alt sektor (asılı dropdown)
- Referans mənbəsi: Şirkət→şirkət seçimi+nümayəndə, Şəxs→ad/soyad/vəzifə, Media/Digər→qeyd
- Əlaqədar şəxs vəzifəsi Select (tənzimləmələrdən)
- Müqaviləyə uyğun ödəniş (hər müqavilə üçün ayrı ödəniş + ümumi yekun kartı)

### 2. İnsan Resurları ✅
### 3. Maliyyə ✅
### 4. Satış ✅ (Kanban)
### 5. Görüşlər ✅
### 6. Tapşırıqlar ✅
### 7. Mesajlar ✅
### 8. Bildirişlər ✅
### 9. Tənzimləmələr ✅ (YENİLƏNDİ)
- 9 tab: Paketlər, Layihələr, Sektorlar, Alt Sektorlar, Vəzifələr, Fəaliyyətlər, Regionlar, Xüsusi sahələr, İstifadəçilər
### 10. Öhdəliklər ✅

## Texniki Struktur
- Backend: FastAPI + PyMongo (async) + JWT
- Frontend: React 18 + Tailwind + Shadcn UI
- Database: MongoDB
- Fayl yükləmə: /api/upload, /app/backend/uploads/

## API Endpoints
- /api/auth/* — Autentifikasiya
- /api/dashboard/stats — İdarə paneli
- /api/companies, /api/companies/{id} — Şirkətlər (dict-based)
- /api/options/all — Dropdown seçimlər (sectors, sub_sectors, positions, activities, regions, education_levels, reference_sources, packages, etc.)
- /api/options/companies — Şirkət seçimləri (referans üçün)
- /api/settings/* — Paketlər, Layihələr, Sektorlar, Alt Sektorlar, Vəzifələr, Fəaliyyətlər, Regionlar, Xüsusi sahələr, İstifadəçilər
- /api/upload — Fayl yükləmə
- /api/finance/*, /api/sales/*, /api/messages/*, /api/notifications, /api/tasks, /api/meetings, /api/obligations

## Backlog

### P0 — Kritik
- [x] Şirkətlər modulu 15 nöqtəli yenidən yazma (TAMAMLANDI)
- [x] Settings-ə Alt Sektorlar, Vəzifələr, Fəaliyyətlər tabları (TAMAMLANDI)
- [x] Müqaviləyə uyğun ödəniş sistemi (TAMAMLANDI)
- [x] Referans mənbəsi genişləndirilməsi (TAMAMLANDI)
- [x] Region Select + Regionlar tab (TAMAMLANDI)
- [x] Əlaqədar şəxs vəzifəsi Select (TAMAMLANDI)
- [ ] RBAC enforcement

### P1 — Yüksək
- [ ] Davamiyyət modulu (gəliş/gediş, icazə, xəstəlik)
- [ ] Barter əməliyyatları
- [ ] Excel import funksiyası

### P2 — Orta
- [ ] PDF hesabatlar
- [ ] Ətraflı hesabatlar/dashboard
- [ ] Təşkilatçılıq modulu
- [ ] Fayllar, Qeydlər modulları
