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

### 2. İnsan Resurları ✅ (HR)
- Əməkdaş cədvəli (filtrlər, axtarış, export)
- Əməkdaş detallı görünüşü (4 tab: Şəxsi, Əlaqə, Müqavilə, Əmək haqqı)
- CRUD əməliyyatları
- Şəxsi məlumatlar: doğum tarixi, cins, ş.v., FİN, təhsil, ailə vəziyyəti
- Müqavilə: şöbə, vəzifə, tarixlər, məzuniyyət günləri
- Əmək haqqı: gross/net

### 3. Maliyyə ✅ (Finance)
- İcmal kartları (gəlir, ödənilib, borc, mənfəət)
- Gəlirlər siyahısı və əlavə et
- Xərclər siyahısı (kateqoriyalı) və əlavə et
- Tab-lar: İcmal, Gəlirlər, Xərclər

### 4. Satış (Gözləmədə)
- Coming Soon səhifəsi

### 5. Görüşlər ✅ (Meetings)
- Timeline görünüşü (tarixə görə qruplanmış)
- Görüş əlavə et (əməkdaş, tarix, saat, növ, şirkət, məkan, nəticə)
- Görüş növləri: Satış görüşü, Daxili iclas, Müştəri görüşü, Partnyor görüşü, Təqdimat
- Silmə funksiyası

### 6. Tapşırıqlar ✅ (Tasks)
- Kanban board görünüşü (Gözləyir, İcrada, Tamamlandı, Ləğv edildi)
- Tapşırıq əlavə et (ad, şöbə, icraçı, prioritet, tarixlər)
- Status dəyişdirmə (dropdown ilə)
- Prioritet göstəricisi (rənglərlə)
- Filtrlər (status, prioritet)

### 7. Mesajlar (Gözləmədə)
- Coming Soon səhifəsi

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
- [x] Maliyyə (gəlir/xərc, icmal kartları)
- [x] Görüşlər (timeline görünüşü)
- [x] Tapşırıqlar (Kanban board)
- [x] Mobil menyu düzəlişi

## Backlog

### P0 - Kritik
- [ ] Satış modulu (pipeline, mənbələr)
- [ ] Mesajlar modulu (daxili kommunikasiya)

### P1 - Yüksək
- [ ] Excel import funksiyası
- [ ] PDF hesabatlar
- [ ] Bildirişlər sistemi

### P2 - Orta
- [ ] Davamiyyət modulu
- [ ] Barter əməliyyatları
- [ ] Ətraflı hesabatlar

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
