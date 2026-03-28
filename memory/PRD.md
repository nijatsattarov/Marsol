# Marsol Group İdarəetmə Sistemi - PRD

## Orijinal Problem Bəyanatı
Marsol Group üçün MMS (Management System) hazırlamaq. PDF texniki tapşırığına əsasən tam ERP sistemi.

## Tarix
- **2024-01-XX**: MVP Dashboard hazırlandı
- **2024-01-XX**: Üzvlər modulu hazırlandı
- **2024-01-XX**: Sistem yenidən strukturlaşdırıldı (PDF texniki tapşırığına görə)
- **2025-02-XX**: Tənzimləmələr səhifəsi əlavə edildi (Paketlər, Layihələr, Xüsusi Sahələr, İstifadəçi İdarəetmə)

## İstifadəçi Personaları
- **Admin**: Sistem administratoru - bütün funksionallıqlara tam giriş
- **Menecer**: Bölmə meneceri - əsas funksionallıqlara giriş
- **İstifadəçi**: Standart istifadəçi - məhdud giriş
- **Baxıcı**: Yalnız baxış icazəsi

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

### 2. İnsan Resurları ✅ (HR)
- Əməkdaş cədvəli (filtrlər, axtarış, export)
- Əməkdaş detallı görünüşü (4 tab: Şəxsi, Əlaqə, Müqavilə, Əmək haqqı)
- CRUD əməliyyatları

### 3. Maliyyə ✅ (Finance)
- İcmal kartları (gəlir, ödənilib, borc, mənfəət)
- Gəlirlər siyahısı və əlavə et (dinamik şirkət/paket/layihə dropdown-ları)
- Xərclər siyahısı (kateqoriyalı) və əlavə et
- Edit/Delete funksionallığı
- Şirkət seçiləndə paket avto-seçim

### 4. Satış (Gözləmədə)
- Coming Soon səhifəsi

### 5. Görüşlər ✅ (Meetings)
- Timeline görünüşü (tarixə görə qruplanmış)
- Görüş əlavə et

### 6. Tapşırıqlar ✅ (Tasks)
- Kanban board görünüşü
- Tapşırıq CRUD

### 7. Mesajlar (Gözləmədə)
- Coming Soon səhifəsi

### 8. Tənzimləmələr ✅ (Settings) - YENİ
- **Paketlər**: Üzvlük paketləri CRUD (ad, təsvir, qiymət)
- **Layihələr**: Layihə CRUD (ad, təsvir)
- **Xüsusi Sahələr**: Modullara xüsusi sahə əlavəsi (modul, sahə adı, tip, seçimlər, məcburilik)
- **İstifadəçi İdarəetmə**: İstifadəçi CRUD + rol təyini (Admin, Menecer, İstifadəçi, Baxıcı)

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

### Faza 3 - Əlavə Modullar ✅
- [x] İnsan Resurları (əməkdaş CRUD, detallı görünüş, əmək haqqı)
- [x] Maliyyə (gəlir/xərc, icmal kartları, dinamik dropdown-lar, edit/delete)
- [x] Görüşlər (timeline görünüşü)
- [x] Tapşırıqlar (Kanban board)
- [x] Mobil menyu düzəlişi

### Faza 4 - Tənzimləmələr ✅
- [x] Paketlər idarəetmə (CRUD)
- [x] Layihələr idarəetmə (CRUD)
- [x] Xüsusi sahələr (modul bazında sahə əlavəsi)
- [x] İstifadəçi idarəetmə (rol sistemi: Admin, Menecer, İstifadəçi, Baxıcı)

## Backlog

### P0 - Kritik
- [ ] Rol bazlı giriş nəzarəti (RBAC) - frontend/backend səviyyəsində
- [ ] Satış modulu (pipeline, mənbələr)
- [ ] Mesajlar modulu (daxili kommunikasiya)

### P1 - Yüksək
- [ ] Excel import funksiyası
- [ ] PDF hesabatlar
- [ ] Bildirişlər sistemi
- [ ] Xüsusi sahələrin modulların formlarında göstərilməsi

### P2 - Orta
- [ ] Davamiyyət modulu
- [ ] Barter əməliyyatları
- [ ] Ətraflı hesabatlar
- [ ] Öhdəliklər, Təşkilatçılıq, Fayllar, Qeydlər modulları

## Texniki Struktur

### Backend API Endpoints:
- /api/auth/* - Autentifikasiya
- /api/dashboard/stats - Dashboard statistikalar
- /api/companies - Şirkət CRUD
- /api/employees - Əməkdaş CRUD
- /api/finance/* - Maliyyə (incomes, expenses, summary)
- /api/tasks - Tapşırıqlar
- /api/meetings - Görüşlər
- /api/options/all - Dropdown seçimləri
- /api/options/companies - Şirkət dropdown
- /api/settings/packages - Paketlər CRUD
- /api/settings/projects - Layihələr CRUD
- /api/settings/custom-fields - Xüsusi sahələr CRUD
- /api/settings/users - İstifadəçi CRUD

### Frontend Struktur:
- /dashboard - İdarə Paneli
- /companies - Şirkət Məlumatları
- /hr - İnsan Resurları
- /finance - Maliyyə
- /sales - Satış
- /meetings - Görüşlər
- /tasks - Tapşırıqlar
- /messages - Mesajlar
- /settings - Tənzimləmələr (YENİ)

## Növbəti Addımlar
1. Rol bazlı giriş nəzarəti (RBAC) tətbiqi
2. Xüsusi sahələrin formlarla inteqrasiyası
3. Satış modulu hazırlanması
