// Field configurations for each organization sub-module
// Field types: text, textarea, number, select, multiselect, boolean, url, phone, digits,
//   photoupload (multi-image upload to Cloudinary), sociallinks (per-platform URL pairs),
//   managedselect (options loaded from /api/settings/manageable-lists by `list_key`)

const ratingLine = { key: 'overall_rating', label: 'Ümumi qiymətləndirmə (1-5)', type: 'number', min: 0, max: 5, step: 0.1, group: 'Rating' };

export const VENUE_CONFIG = {
  module: 'venues',
  title: 'Məkanlar',
  subtitle: 'Otellər, restoranlar, konfrans zalları',
  primary_name_field: 'name',
  fields: [
    { key: 'name', label: 'Məkan adı', type: 'text', required: true, group: 'Əsas' },
    { key: 'category', label: 'Kateqoriya', type: 'select', options: ['Restoran', 'Otel', 'Konfrans zalı', 'Açıq məkan', 'Bağ evi', 'Klub', 'Digər'], group: 'Əsas' },
    { key: 'city', label: 'Şəhər / Rayon', type: 'managedselect', list_key: 'cities', group: 'Əsas' },
    { key: 'address', label: 'Ünvan', type: 'text', group: 'Əsas' },
    { key: 'location_link', label: 'Google Maps linki', type: 'url', group: 'Əsas' },
    { key: 'contacts', label: 'Əlaqədar şəxslər', type: 'contacts', group: 'Əlaqə' },
    { key: 'social_links', label: 'Sosial media linkləri', type: 'sociallinks', group: 'Əlaqə' },
    { key: 'min_capacity', label: 'Min qonaq sayı', type: 'number', group: 'Tutum' },
    { key: 'max_capacity', label: 'Maks qonaq sayı', type: 'number', group: 'Tutum' },
    { key: 'hall_count', label: 'Zal sayı', type: 'number', group: 'Tutum' },
    { key: 'parking_capacity', label: 'Parking tutumu', type: 'number', group: 'Tutum' },
    { key: 'has_stage', label: 'Səhnə', type: 'boolean', group: 'Texniki' },
    { key: 'has_projector', label: 'Proyektor / LED ekran', type: 'boolean', group: 'Texniki' },
    { key: 'has_sound_system', label: 'Səs sistemi', type: 'boolean', group: 'Texniki' },
    { key: 'table_layouts', label: 'Düzülüş növləri', type: 'managedmultiselect', list_key: 'layout_types', group: 'Texniki' },
    { key: 'has_vip_room', label: 'VIP otaq', type: 'boolean', group: 'Texniki' },
    { key: 'venue_type', label: 'Məkan tipi', type: 'select', options: ['Qapalı', 'Açıq', 'Hər ikisi'], group: 'Texniki' },
    { key: 'food_included', label: 'Yemək daxildirmi', type: 'boolean', group: 'Catering' },
    { key: 'catering_mandatory', label: 'Öz catering-i məcburidirmi', type: 'boolean', group: 'Catering' },
    { key: 'time_limit', label: 'Müddət limiti (saat)', type: 'text', group: 'Şərtlər' },
    { key: 'service_fee', label: 'Xidmət haqqı (%)', type: 'number', group: 'Şərtlər' },
    { key: 'price_min', label: 'Qiymət (min, AZN)', type: 'number', group: 'Şərtlər' },
    { key: 'price_max', label: 'Qiymət (maks, AZN)', type: 'number', group: 'Şərtlər' },
    { key: 'discount_available', label: 'Endirim imkanı', type: 'text', group: 'Şərtlər' },
    { key: 'photos', label: 'Şəkillər', type: 'photoupload', group: 'Media' },
    { key: 'virtual_tour', label: 'Video / virtual tur linki', type: 'url', group: 'Media' },
    { key: 'notes', label: 'Qeyd', type: 'textarea', group: 'Digər' },
  ]
};

export const CATERING_CONFIG = {
  module: 'catering',
  title: 'Catering',
  subtitle: 'Restoranlar və catering xidmətləri',
  primary_name_field: 'name',
  fields: [
    { key: 'name', label: 'Restoran / catering adı', type: 'text', required: true, group: 'Əsas' },
    { key: 'service_types', label: 'Xidmət növü', type: 'multiselect', options: ['Breakfast', 'Coffee break', 'Lunch', 'Dinner', 'Banket', 'Standing buffet'], group: 'Əsas' },
    { key: 'menu_packages', label: 'Menyu paketləri', type: 'textarea', group: 'Əsas' },
    { key: 'price_per_person', label: '1 nəfərlik qiymət (AZN)', type: 'number', group: 'Qiymət' },
    { key: 'min_order', label: 'Minimum sifariş sayı', type: 'number', group: 'Qiymət' },
    { key: 'discount_terms', label: 'Endirim şərtləri', type: 'text', group: 'Qiymət' },
    { key: 'vegetarian_diet', label: 'Vegetarian / diet menyu var', type: 'boolean', group: 'Menyu' },
    { key: 'service_staff_included', label: 'Servis heyəti daxildir', type: 'boolean', group: 'Menyu' },
    { key: 'delivery_available', label: 'Çatdırılma var', type: 'boolean', group: 'Menyu' },
    { key: 'contacts', label: 'Əlaqədar şəxslər', type: 'contacts', group: 'Əlaqə' },
    { key: 'tasting_done', label: 'Dadım testi edilib', type: 'boolean', group: 'Qiymətləndirmə' },
    { key: 'used_previously', label: 'Əvvəlki tədbirlərdə istifadə olunub', type: 'boolean', group: 'Qiymətləndirmə' },
    { key: 'photos', label: 'Təqdimat şəkilləri', type: 'photoupload', group: 'Media' },
    { key: 'notes', label: 'Qeyd', type: 'textarea', group: 'Digər' },
  ]
};

export const DECOR_CONFIG = {
  module: 'decor',
  title: 'Dekor və texniki təchizat',
  subtitle: 'Səs, işıq, dekor, banner, çadır və s.',
  primary_name_field: 'name',
  fields: [
    { key: 'name', label: 'Təchizatçı adı', type: 'text', required: true, group: 'Əsas' },
    { key: 'service_category', label: 'Xidmət kateqoriyası', type: 'select', options: ['Dekorasiya', 'Səs sistemi', 'İşıqlandırma', 'LED ekran', 'Səhnə qurulması', 'Banner / roll-up', 'Çap işləri', 'Masa-kürsü kirayəsi', 'Çadır / açıq hava', 'Komplet'], group: 'Əsas' },
    { key: 'offered_items', label: 'Təklif etdiyi avadanlıq / xidmət', type: 'textarea', group: 'Əsas' },
    { key: 'price', label: 'Qiymət (AZN)', type: 'number', group: 'Qiymət' },
    { key: 'rate_type', label: 'Tarif növü', type: 'select', options: ['Günlük', 'Saatlıq', 'Fiks', 'Sifarişə görə'], group: 'Qiymət' },
    { key: 'installation_included', label: 'Quraşdırma daxildir', type: 'boolean', group: 'Şərtlər' },
    { key: 'delivery_included', label: 'Daşınma daxildir', type: 'boolean', group: 'Şərtlər' },
    { key: 'contacts', label: 'Əlaqədar şəxslər', type: 'contacts', group: 'Əlaqə' },
    { key: 'quality_note', label: 'İş keyfiyyəti qeydi', type: 'textarea', group: 'Qiymətləndirmə' },
    { key: 'timely_delivery', label: 'Vaxtında təhvil performansı', type: 'select', options: ['Əla', 'Yaxşı', 'Orta', 'Zəif'], group: 'Qiymətləndirmə' },
    { key: 'photos', label: 'Nümunə işlər (şəkillər)', type: 'photoupload', group: 'Media' },
    { key: 'notes', label: 'Qeyd', type: 'textarea', group: 'Digər' },
  ]
};

export const MUSICIANS_CONFIG = {
  module: 'musicians',
  title: 'Musiqiçilər və şou komandaları',
  subtitle: 'DJ, aparıcı, canlı musiqi, rəqs qrupu',
  primary_name_field: 'name',
  fields: [
    { key: 'name', label: 'Ad / komanda adı', type: 'text', required: true, group: 'Əsas' },
    { key: 'category', label: 'Kateqoriya', type: 'select', options: ['DJ', 'Aparıcı', 'Canlı musiqi', 'Skripkaçı', 'Saksofonçu', 'Rəqs qrupu', 'Animasiya komandası', 'Digər'], group: 'Əsas' },
    { key: 'team_size', label: 'Tərkib sayı', type: 'number', group: 'Əsas' },
    { key: 'event_types', label: 'Uyğun tədbir tipləri', type: 'multiselect', options: ['Korporativ', 'Toy', 'Biznes səhər yeməyi', 'Açılış', 'Panel', 'Networking', 'Konfrans', 'İftar'], group: 'Əsas' },
    { key: 'repertoire', label: 'Repertuar / proqram tipi', type: 'textarea', group: 'Proqram' },
    { key: 'hour_limit', label: 'Saat limiti', type: 'text', group: 'Proqram' },
    { key: 'price', label: 'Qiymət (AZN)', type: 'number', group: 'Qiymət' },
    { key: 'technical_requirements', label: 'Texniki tələblər', type: 'textarea', group: 'Texniki' },
    { key: 'has_own_equipment', label: 'Öz avadanlığı var', type: 'boolean', group: 'Texniki' },
    { key: 'video_link', label: 'Video link', type: 'url', group: 'Media' },
    { key: 'photos', label: 'Foto / şəkillər', type: 'photoupload', group: 'Media' },
    { key: 'contacts', label: 'Əlaqədar şəxslər', type: 'contacts', group: 'Əlaqə' },
    { key: 'discipline_score', label: 'Dəqiqlik / intizam balı (1-5)', type: 'number', min: 0, max: 5, step: 0.1, group: 'Qiymətləndirmə' },
    { key: 'notes', label: 'Qeyd', type: 'textarea', group: 'Digər' },
  ]
};

export const PHOTOVIDEO_CONFIG = {
  module: 'photovideo',
  title: 'Foto / Video',
  subtitle: 'Foto, video, drone, montaj, canlı yayım',
  primary_name_field: 'name',
  fields: [
    { key: 'name', label: 'Şirkət / freelancer adı', type: 'text', required: true, group: 'Əsas' },
    { key: 'service_types', label: 'Xidmət növü', type: 'multiselect', options: ['Foto', 'Video', 'Montaj', 'Drone', 'Reels çəkilişi', 'Canlı yayım'], group: 'Əsas' },
    { key: 'packages', label: 'Paket növləri', type: 'textarea', group: 'Paketlər' },
    { key: 'price', label: 'Qiymət (AZN)', type: 'number', group: 'Paketlər' },
    { key: 'delivery_days', label: 'Çatdırılma müddəti (gün)', type: 'number', group: 'Paketlər' },
    { key: 'portfolio_link', label: 'Portfolio linki', type: 'url', group: 'Media' },
    { key: 'additional_services', label: 'Əlavə xidmətlər', type: 'textarea', group: 'Paketlər' },
    { key: 'contacts', label: 'Əlaqədar şəxslər', type: 'contacts', group: 'Əlaqə' },
    { key: 'email', label: 'Email', type: 'text', group: 'Əlaqə' },
    { key: 'notes', label: 'Qeyd', type: 'textarea', group: 'Digər' },
  ]
};

export const TRANSPORT_CONFIG = {
  module: 'transport',
  title: 'Nəqliyyat və logistika',
  subtitle: 'Avtobus, minivan, VIP transfer, yük daşıma',
  primary_name_field: 'name',
  fields: [
    { key: 'name', label: 'Təchizatçı adı', type: 'text', required: true, group: 'Əsas' },
    { key: 'service_type', label: 'Xidmət növü', type: 'select', options: ['Avtobus', 'Minivan', 'VIP transfer', 'Yük maşını', 'Minibus', 'Taksi', 'Digər'], group: 'Əsas' },
    { key: 'capacity', label: 'Tutum (nəfər/ton)', type: 'text', group: 'Əsas' },
    { key: 'price', label: 'Qiymət (AZN)', type: 'number', group: 'Qiymət' },
    { key: 'rate_type', label: 'Tarif növü', type: 'select', options: ['Saatlıq', 'Günlük', 'Marşrut üzrə', 'Sifarişə görə'], group: 'Qiymət' },
    { key: 'driver_included', label: 'Sürücü daxildir', type: 'boolean', group: 'Şərtlər' },
    { key: 'regions', label: 'Xidmət bölgələri', type: 'text', group: 'Şərtlər' },
    { key: 'contacts', label: 'Əlaqədar şəxslər', type: 'contacts', group: 'Əlaqə' },
    { key: 'photos', label: 'Nəqliyyat şəkilləri', type: 'photoupload', group: 'Media' },
    { key: 'notes', label: 'Qeyd', type: 'textarea', group: 'Digər' },
  ]
};

export const MATERIALS_CONFIG = {
  module: 'materials',
  title: 'Tədbir materialları',
  subtitle: 'Badge, banner, roll-up, sertifikat, hədiyyə və s.',
  primary_name_field: 'name',
  fields: [
    { key: 'name', label: 'Material adı', type: 'text', required: true, group: 'Əsas' },
    { key: 'category', label: 'Kateqoriya', type: 'select', options: ['Badge', 'Banner', 'Roll-up', 'Masa nömrəsi', 'Sertifikat', 'Hədiyyə paketi', 'Qeydiyyat masası', 'Çap işi', 'Digər'], group: 'Əsas' },
    { key: 'supplier', label: 'Tədarükçü', type: 'text', group: 'Əsas' },
    { key: 'price', label: 'Qiymət (ədəd, AZN)', type: 'number', group: 'Qiymət' },
    { key: 'min_order', label: 'Minimum sifariş', type: 'number', group: 'Qiymət' },
    { key: 'production_days', label: 'Hazırlanma müddəti (gün)', type: 'number', group: 'Şərtlər' },
    { key: 'design_required', label: 'Dizayn tələbi', type: 'boolean', group: 'Şərtlər' },
    { key: 'phone', label: 'Telefon', type: 'phone', group: 'Əlaqə' },
    { key: 'samples', label: 'Nümunə şəkilləri', type: 'photoupload', group: 'Media' },
    { key: 'notes', label: 'Qeyd', type: 'textarea', group: 'Digər' },
  ]
};

export const ORG_CONFIGS = {
  venues: VENUE_CONFIG,
  catering: CATERING_CONFIG,
  decor: DECOR_CONFIG,
  musicians: MUSICIANS_CONFIG,
  photovideo: PHOTOVIDEO_CONFIG,
  transport: TRANSPORT_CONFIG,
  materials: MATERIALS_CONFIG,
};
