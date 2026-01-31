# Marsol Group İdarəetmə Sistemi - PRD

## Orijinal Problem Bəyanatı
Marsol Group üçün Management System hazırlamaq. Dashboard-da ümumi icmal görüntüsü diaqramlar və şkalalarla.

## Tarix
- **2024-01-XX**: MVP Dashboard hazırlandı

## İstifadəçi Personaları
- **Admin**: Sistem administratoru - bütün funksionallıqlara tam giriş

## Əsas Tələblər (Statik)

### Dashboard İcmalı
- Təşkil olunan tədbirlər (İşgüzar səhər yeməyi, Ofis-istehsalat ziyarəti, Daxili səfər, Sosial fəaliyyət, Xarici səfər, Dövlət qurumu ilə görüş)
- Üzvlər (Premium, Business, Business Plus paketlər)
- Sektorlar (İnşaat, Təhsil, Qida, İKT, Logistika, və s.)
- Ödənişlər icmalı (Ödənilib / Qalıq)
- Maliyyə (Gəlirlər / Xərclər)

### Sol Panel Menyusu
- İdarə Paneli
- Üzvlər
- Görüşlər
- Maliyyə
- Marketing
- İnsan Resurları
- Tapşırıqlar
- Mesajlar

### Dizayn
- Logo: Marsol Group
- Rənglər: Navy #3D4F6F, Lime #9ACD32
- Font: Montserrat

## Həyata Keçirilənlər

### MVP (Faza 1) ✅
- [x] JWT əsaslı autentifikasiya sistemi (Login/Register)
- [x] Dashboard səhifəsi bütün statistikalarla
- [x] Qarışıq diaqramlar (Pie + Bar charts)
- [x] Açılıb-bağlanan Sidebar
- [x] 8 menyu elementi (digərləri "Coming Soon")
- [x] Azərbaycan dili interfeysi
- [x] Responsive dizayn

## Backlog

### P0 - Kritik
- [ ] Üzvlər səhifəsi (CRUD əməliyyatları)
- [ ] Görüşlər səhifəsi (CRUD əməliyyatları)

### P1 - Yüksək Prioritet
- [ ] Maliyyə səhifəsi
- [ ] Real verilənlər bazası inteqrasiyası (mock datadan real dataya)
- [ ] Bildirişlər sistemi
- [ ] Excel/PDF export funksiyası

### P2 - Orta Prioritet
- [ ] Marketing səhifəsi
- [ ] İnsan Resurları səhifəsi
- [ ] Tapşırıqlar səhifəsi
- [ ] Mesajlar səhifəsi

## Növbəti Addımlar
1. Üzvlər modulu hazırlanması
2. Görüşlər modulu hazırlanması
3. Real database-ə keçid (mock datadan)
