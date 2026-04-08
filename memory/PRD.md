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
- **2026-04-08**: Şirkətlər modulu 15 nöqtəli yenidən yazma (çoxlu sahibkar, çoxlu müqavilə, fayl yükləmə, VOEN, alt sektorlar, fəaliyyətlər). Settings-ə 3 yeni tab (Alt Sektorlar, Vəzifələr, Fəaliyyətlər). Backend /api/options/all bug-u düzəldildi.

## Əsas Modullar

### 1. Şirkət Məlumatları ✅ (YENİLƏNDİ)
- Cədvəl, filtrlər, axtarış, Excel export
- Detallı görünüş (5 tab: Şirkət, Sahibkar, Əlaqədar şəxs, Müqavilə, Ödəniş + Əlavə sahələr tab)
- Çoxlu sahibkar (ad, soyad, ata adı, vəzifə, telefon, email, doğum tarixi, vətəndaşlıq, təhsil, ixtisas, universitet, sosial media, övladlar, fəaliyyətlər)
- Çoxlu müqavilə (layihə, paket, başlama/bitmə tarixi, qoşulma tarixi, məbləğ, müqavilə skanı)
- Fayl yükləmə (logo, bank rekvizitləri, müqavilə skanı)
- VÖEN, region, işçi sayı, hüquqi adı, veb sayt, referans mənbəsi
- Alt sektor (sektora asılı dropdown)
- CRUD əməliyyatları, paket seçimdə avtomatik borc hesablama

### 2. İnsan Resurları ✅
- Əməkdaş cədvəli, detallı görünüş (4 tab)

### 3. Maliyyə ✅
- Gəlirlər = Bütün şirkətlər avtomatik
- Qeyd sistemi, Ödəniş redaktə modalı, Filtrlər, Xərclər CRUD

### 4. Satış ✅
- Kanban board (6 mərhələ), Lead CRUD

### 5. Görüşlər ✅
### 6. Tapşırıqlar ✅
### 7. Mesajlar ✅
### 8. Bildirişlər ✅
### 9. Tənzimləmələr ✅ (YENİLƏNDİ)
- 8 tab: Paketlər, Layihələr, Sektorlar, Alt Sektorlar, Vəzifələr, Fəaliyyətlər, Xüsusi sahələr, İstifadəçilər

### 10. Öhdəliklər ✅

## Texniki Struktur
- Backend: FastAPI + PyMongo (async) + JWT
- Frontend: React 18 + Tailwind + Shadcn UI
- Database: MongoDB
- Fayl yükləmə: /api/upload endpoint, /app/backend/uploads/ qovluğu

## API Endpoints
- /api/auth/* — Autentifikasiya
- /api/dashboard/stats — İdarə paneli statistikalar
- /api/companies, /api/companies/{id} — Şirkətlər (dict-based, bütün sahələr dəstəklənir)
- /api/companies/{id}/finance — Şirkət maliyyə qeydi
- /api/employees — Əməkdaşlar
- /api/finance/expenses — Xərclər
- /api/sales/leads, /api/sales/stats — Satış
- /api/messages/*, /api/notifications — Mesajlar, Bildirişlər
- /api/tasks, /api/meetings — Tapşırıqlar, Görüşlər
- /api/options/all — Dropdown seçimlər (sectors, sub_sectors, positions, activities, education_levels, packages, etc.)
- /api/options/companies — Şirkət seçimləri
- /api/settings/* — Paketlər, Layihələr, Sektorlar, Alt Sektorlar, Vəzifələr, Fəaliyyətlər, Xüsusi sahələr, İstifadəçilər
- /api/upload — Fayl yükləmə
- /api/obligations — Öhdəliklər

## Backlog

### P0 — Kritik
- [x] Şirkətlər modulu 15 nöqtəli yenidən yazma (TAMAMLANDI)
- [x] Settings-ə Alt Sektorlar, Vəzifələr, Fəaliyyətlər tabları (TAMAMLANDI)
- [ ] RBAC enforcement (admin-only write endpoints for settings/users)

### P1 — Yüksək
- [ ] Davamiyyət modulu (gəliş/gediş, icazə, xəstəlik)
- [ ] Barter əməliyyatları
- [ ] Excel import funksiyası

### P2 — Orta
- [ ] PDF hesabatlar
- [ ] Ətraflı hesabatlar/dashboard
- [ ] Təşkilatçılıq modulu
- [ ] Fayllar, Qeydlər modulları
