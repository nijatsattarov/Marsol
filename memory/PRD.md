# Marsol Group İdarəetmə Sistemi - PRD

## Orijinal Problem Bəyanatı
Marsol Group üçün MMS (Management System) hazırlamaq. PDF texniki tapşırığına əsasən tam ERP sistemi.

## Əsas Modullar

### 1. Şirkət Məlumatları ✅
- 6 tab forma: Şirkət, Sahibkar, Əlaqədar şəxs, Müqavilə, Ödəniş, Əlavə
- Çoxlu sahibkar, çoxlu müqavilə, fayl yükləmə
- Müqaviləyə uyğun ödəniş + ümumi yekun
- Referans mənbəsi: Şirkət/Şəxs/Media/Digər + şərti inputlar
- Region Select, Əlaqədar şəxs vəzifəsi Select, Alt sektor asılı dropdown

### 2. İnsan Resurları ✅ (YENİLƏNDİ - 2026-04-09)
- 6 tab forma: Şəxsi, Təhsil, Əlaqə, Müqavilə, Əmək haqqı, Sənədlər
- **Şəxsi**: Profil şəkli (3x4), Ad/Soyad ayrı, Uşaq sayı +/- düymə + doğum tarixləri
- **Təhsil**: Çoxlu təhsil (+/- ilə artırma/azaltma) — hər biri: səviyyə, müəssisə, ixtisas, qəbul/bitmə tarixi
- **Müqavilə (genişləndirildi)**: Müqavilənin bağlanma tarixi, İşə başlama tarixi, Bitmə tarixi + Müddətsiz, Sınaq müddəti, Xatırlatma (1 ay qalmış), Vəzifə dəyişikliyi (Bəli/Xeyr), Əməyin ödənilməsi (Vaxtamuzd/İşəmuzd), 3 fayl yükləmə (Vəzifə təlimatları, Əmək müqaviləsi, Vəzifə dəyişikliyi)
- **Əmək haqqı**: Gross, Net, Əlavə, Mükafatlar
- **Sənədlər**: Məhkumluq skanı, Sağlamlıq arayışı, Sertifikatlar (çoxlu), Digər sənədlər (çoxlu)

### 3. Maliyyə ✅
### 4. Satış ✅ (Kanban)
### 5. Görüşlər ✅
### 6. Tapşırıqlar ✅
### 7. Mesajlar ✅
### 8. Bildirişlər ✅
### 9. Tənzimləmələr ✅
- 9 tab: Paketlər, Layihələr, Sektorlar, Alt Sektorlar, Vəzifələr, Fəaliyyətlər, Regionlar, Xüsusi sahələr, İstifadəçilər
### 10. Öhdəliklər ✅

## Texniki Struktur
- Backend: FastAPI + PyMongo (async) + JWT
- Frontend: React 18 + Tailwind + Shadcn UI
- Database: MongoDB
- Fayl yükləmə: /api/upload

## Backlog

### P1
- [ ] Davamiyyət modulu (gəliş/gediş, icazə, xəstəlik)
- [ ] Barter əməliyyatları
- [ ] Excel import funksiyası

### P2
- [ ] PDF hesabatlar
- [ ] RBAC enforcement
- [ ] Təşkilatçılıq, Fayllar, Qeydlər modulları
