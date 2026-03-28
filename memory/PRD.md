# Marsol Group İdarəetmə Sistemi - PRD

## Orijinal Problem Bəyanatı
Marsol Group üçün MMS (Management System) hazırlamaq. PDF texniki tapşırığına əsasən tam ERP sistemi.

## Tarix
- **2024-01-XX**: MVP Dashboard hazırlandı
- **2024-01-XX**: Üzvlər modulu hazırlandı
- **2024-01-XX**: Sistem yenidən strukturlaşdırıldı (PDF texniki tapşırığına görə)

## İstifadəçi Personaları
- **Admin**: Sistem administratoru - bütün funksionallıqlara tam giriş

## Əsas Modullar (PDF-ə görə)

### 1. Şirkət Məlumatları ✅ (Companies)
**Cədvəldə görünən sahələr:**
- Şirkət adı, Sektor, Paket, Sahibkar, Telefon, Kurator, Borc, Status

**Detallı görünüşdə (tablar):**
- Ümumi: Brend/hüquqi ad, sektor, ölçü, qeydiyyat tarixi, ünvan, telefon, veb sayt, bank rekvizitləri
- Sahibkar: Ad, telefon, email, sosial media, digər təsisçilər, uşaq sayı
- Təmsilçi: Ad, telefon, email
- Müqavilə: Layihə, paket, başlama/bitmə tarixi, müqavilə faylı
- Ödəniş: Ümumi məbləğ, ödənilib, borc, gecikmiş gün, son ödəniş tarixi

### 2. İnsan Resurları (Gözləmədə)
- Əməkdaş məlumatları
- Müqavilə məlumatları
- Əmək haqqı
- Davamiyyət

### 3. Maliyyə (Gözləmədə)
- Gəlirlər
- Xərclər (kateqoriyalar ilə)
- Barter
- Mənfəət-Zərər

### 4. Satış (Gözləmədə)
- Satış mənbələri
- Pipeline
- Üzv qoşulma

### 5. Görüşlər (Gözləmədə)
### 6. Tapşırıqlar (Gözləmədə)
### 7. Mesajlar (Gözləmədə)

## Həyata Keçirilənlər

### Faza 1 - MVP ✅
- [x] JWT autentifikasiya
- [x] Dashboard (real statistikalarla)
- [x] Responsiv dizayn
- [x] Montserrat font, Navy + Lime rəng sxemi

### Faza 2 - Şirkət Məlumatları ✅
- [x] Şirkət cədvəli (filtrlər, axtarış, export)
- [x] Şirkət detallı görünüşü (5 tab)
- [x] CRUD əməliyyatları
- [x] Mobil responsiv (kartlar)

## Backlog

### P0 - Kritik
- [ ] İnsan Resurları modulu
- [ ] Maliyyə modulu (Gəlir/Xərc)

### P1 - Yüksək
- [ ] Satış modulu
- [ ] Görüşlər modulu
- [ ] Tapşırıqlar modulu

### P2 - Orta
- [ ] Mesajlar
- [ ] Excel import funksiyası
- [ ] PDF hesabatlar

## Texniki Struktur

### Backend API Endpoints:
- /api/auth/* - Autentifikasiya
- /api/dashboard/stats - Dashboard statistikalar
- /api/companies - Şirkət CRUD
- /api/employees - Əməkdaş CRUD
- /api/finance/* - Maliyyə
- /api/tasks - Tapşırıqlar
- /api/meetings - Görüşlər
- /api/options/all - Dropdown seçimləri

### Frontend Struktur:
- /dashboard - İdarə Paneli
- /companies - Şirkət Məlumatları (cədvəl + detallı görünüş)
- /hr - İnsan Resurları
- /finance - Maliyyə
- /sales - Satış
- /meetings - Görüşlər
- /tasks - Tapşırıqlar
- /messages - Mesajlar

## Növbəti Addımlar
1. Üzvlər modulu hazırlanması
2. Görüşlər modulu hazırlanması
3. Real database-ə keçid (mock datadan)
