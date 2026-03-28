# Marsol Group İdarəetmə Sistemi - PRD

## Orijinal Problem Bəyanatı
Marsol Group üçün MMS (Management System) hazırlamaq. PDF texniki tapşırığına əsasən tam ERP sistemi.

## Tarix
- **2024-01**: MVP Dashboard, Şirkətlər, HR, Görüşlər, Tapşırıqlar hazırlandı
- **2025-02-A**: Tənzimləmələr səhifəsi (Paketlər, Layihələr, Xüsusi Sahələr, İstifadəçi İdarəetmə)
- **2025-02-B**: Sektorlar tənzimləmələrə əlavə, Paket qiyməti avtomatik borc, Təmsilçilər sistem istifadəçiləri
- **2025-02-C**: Maliyyə modulu yenidən yazıldı (şirkətlər bazalı, filtrlər, qeydlər, ödəniş redaktə)
- **2025-02-D**: Faza 5 tamamlandı: Satış (Kanban), Mesajlar, Bildirişlər, RBAC, Xüsusi sahə inteqrasiyası

## Əsas Modullar

### 1. Şirkət Məlumatları ✅
- Cədvəl, filtrlər, axtarış, Excel export
- Detallı görünüş (5 tab + Əlavə sahələr tab)
- CRUD əməliyyatları, paket seçimdə avtomatik borc hesablama

### 2. İnsan Resurları ✅
- Əməkdaş cədvəli, detallı görünüş (4 tab)

### 3. Maliyyə ✅
- Gəlirlər = Bütün şirkətlər avtomatik (Təmsilçi, Müqavilə tarixləri, Qeyd sütunları)
- Qeyd sistemi (mühasib üçün ödəniş qeydləri)
- Ödəniş redaktə modalı, Filtrlər (paket, təmsilçi, layihə, status)
- Xərclər CRUD, İcmal kartları, Cəmi hesablamaları

### 4. Satış ✅ (YENİ)
- Kanban board (6 mərhələ: Yeni Lead → Əlaqə → Təklif → Danışıq → Uğurlu/Uğursuz)
- Lead CRUD (şirkət, əlaqədar, telefon, email, mənbə, prioritet, məbləğ)
- Mərhələ keçidi (bir kliklə növbəti mərhələyə)
- İcmal kartları, Axtarış

### 5. Görüşlər ✅
- Timeline görünüşü, CRUD

### 6. Tapşırıqlar ✅
- Kanban board, CRUD

### 7. Mesajlar ✅ (YENİ)
- Daxili kommunikasiya sistemi
- Söhbət siyahısı, Mesaj göndər/al
- Yeni söhbət başlat (istifadəçi seç)

### 8. Bildirişlər ✅ (YENİ)
- Gecikmiş ödənişlər xəbərdarlığı
- Müqavilə xitamı yaxınlaşan/bitmiş şirkətlər
- Header-da zəng ikonu (sayı ilə dropdown)
- Filtrlər: hamısı, təcili, borc, müqavilə
- Hər dəqiqə avtomatik yenilənmə

### 9. Tənzimləmələr ✅

### 10. Öhdəliklər ✅ (YENİ)
- Cədvəl görünüşü (Öhdəlik, Şirkət, Tip, Məsul, Son tarix, Prioritet, Status)
- CRUD əməliyyatları (modal ilə əlavə/redaktə)
- Sürətli status dəyişdirmə (dropdown: Gözləyir, İcrada, Tamamlandı, Ləğv edildi)
- Vaxtı keçmiş öhdəliklər qırmızı vurğulanır + gün hesabı
- Tiplər: Maliyyə, Xidmət, Çatdırılma, Hüquqi, Tədbir, Təlim, Layihə, Digər
- Filtrlər: Status, Tip, Məsul, Prioritet + Axtarış
- İcmal kartları: Cəmi, Gözləyir, İcrada, Tamamlandı, Vaxtı keçmiş
- Paketlər, Layihələr, Sektorlar, Xüsusi sahələr, İstifadəçi İdarəetmə
- Xüsusi sahələr modullara inteqrasiya olunub (Companies formunda görünür)

## Avtomatik Davranışlar
- Paket seçiləndə → qiymət avtomatik borc
- Ödəniş dəyişdirildikdə → borc avtomatik hesablanır
- Marsol təmsilçiləri → sistem istifadəçilərindən
- Sektorlar → tənzimləmələrdən
- Bildirişlər → hər dəqiqə yenilənir

## Texniki Struktur
- Backend: FastAPI + PyMongo (async) + JWT
- Frontend: React 18 + Tailwind + Shadcn UI
- Database: MongoDB
- RBAC helper mövcud (require_role), endpoint-lərə tətbiq edilməyib hələ

## API Endpoints
- /api/auth/* — Autentifikasiya
- /api/dashboard/stats — İdarə paneli statistikalar
- /api/companies, /api/companies/{id}/finance — Şirkətlər + maliyyə qeydi
- /api/employees — Əməkdaşlar
- /api/finance/expenses — Xərclər
- /api/sales/leads, /api/sales/stats — Satış lead-ləri
- /api/messages/conversations, /api/messages/{id} — Mesajlar
- /api/notifications — Bildirişlər
- /api/tasks, /api/meetings — Tapşırıqlar, Görüşlər
- /api/options/all, /api/options/companies — Dropdown seçimlər
- /api/settings/* — Paketlər, Layihələr, Sektorlar, Xüsusi sahələr, İstifadəçilər

## Backlog

### P0 — Kritik
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
