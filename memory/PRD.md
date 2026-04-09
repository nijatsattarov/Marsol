# Marsol Group İdarəetmə Sistemi - PRD

## Orijinal Problem Bəyanatı
Marsol Group üçün MMS (Management System) hazırlamaq. PDF texniki tapşırığına əsasən tam ERP sistemi.

## Əsas Modullar

### 1. Şirkət Məlumatları ✅
- 6 tab forma: Şirkət, Sahibkar, Əlaqədar şəxs, Müqavilə, Ödəniş, Əlavə
- Çoxlu sahibkar, çoxlu müqavilə, fayl yükləmə
- Müqaviləyə uyğun ödəniş (hər müqavilə ayrı ödəniş + ümumi yekun)
- Referans mənbəsi: Şirkət/Şəxs/Media/Digər + şərti inputlar
- Region Select, Əlaqədar şəxs vəzifəsi Select, Alt sektor asılı dropdown

### 2. İnsan Resurları ✅ (YENİLƏNDİ - 2026-04-09)
- 6 tab forma: Şəxsi, Təhsil, Əlaqə, Müqavilə, Əmək haqqı, Sənədlər
- 6 tab detail view: eyni tablar InfoCard komponentləri ilə
- Əməkdaş ID avtomatik (E001, E002...)
- Profil şəkli (3x4) fayl yükləmə, avatar kimi göstərilir
- Ad və Soyad ayrı inputlar (geriyə uyğunluq: full_name avtomatik hesablanır)
- Təhsil müəssisəsi, İxtisas, Qəbul tarixi, Bitirdiyi tarix
- Uşaqların sayı +/- düymələr + hər uşağın doğum tarixi
- Şəxsi Email + Korporativ Email (ayrı)
- Məhkumluq skanı, Sağlamlıq arayışı, Sənədlər skanı (çoxlu fayl)
- Qeydiyyat ünvanı

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
- Fayl yükləmə: /api/upload, /app/backend/uploads/

## API Endpoints
- /api/auth/*, /api/dashboard/stats
- /api/companies, /api/companies/{id} — dict-based
- /api/employees, /api/employees/{id} — dict-based, auto employee_code
- /api/options/all — sectors, sub_sectors, positions, activities, regions, education_levels, reference_sources, packages
- /api/settings/* — 9 CRUD collection
- /api/upload — fayl yükləmə
- /api/finance/*, /api/sales/*, /api/messages/*, /api/notifications, /api/tasks, /api/meetings, /api/obligations

## Backlog

### P1
- [ ] Davamiyyət modulu (gəliş/gediş, icazə, xəstəlik)
- [ ] Barter əməliyyatları
- [ ] Excel import funksiyası

### P2
- [ ] PDF hesabatlar
- [ ] RBAC enforcement
- [ ] Təşkilatçılıq, Fayllar, Qeydlər modulları
