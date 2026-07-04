-- =====================================================
-- DENEME ANALİZ VE RAPORLAMA MODÜLÜ — SUPABASE ŞEMASI (V1)
-- =====================================================
-- MİMARİ PRENSİP: Sistem veri giriş yönteminden bağımsızdır.
-- Sonuç ister manuel girilsin, ister TXT/CSV/Excel'den aktarılsın, ister ileride
-- fotoğraftan okunsun — hepsi aynı deneme_sonuclari/ders_sonuclari tablolarına yazılır
-- ve aynı analiz ekranları + aynı PDF rapor şablonu ile sunulur. giris_yontemi alanı
-- sadece kaynağı not eder, veri yapısını veya akışı DEĞİŞTİRMEZ.
-- =====================================================

-- 1) ÖĞRENCİLER
create table ogrenciler (
  id uuid primary key default gen_random_uuid(),
  ad_soyad text not null,
  sinif text,
  okul text,
  veli_adi text,
  veli_telefon text,
  ogrenci_no text,
  panel_ogrenci_id uuid, -- ileride ana panel db'siyle eşleştirme için
  olusturma_tarihi timestamptz default now()
);

-- 2) DENEMELER (deneme tanımı — herkese ortak sınav bilgisi)
create table denemeler (
  id uuid primary key default gen_random_uuid(),
  deneme_adi text not null,       -- "ÖZDEBİR LGS-4"
  yayin text,                     -- "ÖZDEBİR"
  deneme_tarihi date not null,
  aciklama text,
  olusturma_tarihi timestamptz default now()
);

-- 3) DERSLER (sabit ders listesi — LGS/YKS gibi sınav tiplerine göre genişletilebilir)
create table dersler (
  id uuid primary key default gen_random_uuid(),
  ders_adi text not null,          -- "Türkçe", "Matematik"...
  soru_sayisi int not null,        -- o dersteki toplam soru sayısı
  sira int                         -- rapor/tablo sıralaması için
);

-- 4) DENEME SONUÇLARI (öğrenci + deneme bazlı genel sonuç)
create table deneme_sonuclari (
  id uuid primary key default gen_random_uuid(),
  ogrenci_id uuid references ogrenciler(id) on delete cascade,
  deneme_id uuid references denemeler(id) on delete cascade,
  toplam_net numeric(6,2),
  toplam_dogru int,
  toplam_yanlis int,
  toplam_bos int,
  puan numeric(7,2),
  genel_sira int,
  kurum_sirasi int,
  sube_sirasi int,
  ogretmen_yorumu text,
  giris_yontemi text check (giris_yontemi in ('manuel','dosya','fotograf')), -- veri kaynağından bağımsız aynı tabloya yazılır
  olusturma_tarihi timestamptz default now(),
  unique (ogrenci_id, deneme_id)
);

-- 5) DERS BAZLI SONUÇLAR (her deneme sonucu için ders ders detay)
create table ders_sonuclari (
  id uuid primary key default gen_random_uuid(),
  deneme_sonuc_id uuid references deneme_sonuclari(id) on delete cascade,
  ders_id uuid references dersler(id),
  dogru int not null default 0,
  yanlis int not null default 0,
  bos int not null default 0,
  net numeric(6,2) generated always as (dogru - (yanlis::numeric / 3)) stored
);

-- 6) OPTİK OKUYUCU SÜTUN EŞLEŞTİRME HAFIZASI
-- Bir optik okuyucu formatı bir kez eşleştirilince tekrar sorulmaz.
create table okuyucu_profilleri (
  id uuid primary key default gen_random_uuid(),
  profil_adi text not null,          -- örn: "Sinan Kuzucu Optik", "ÜçDörtBeş Optik"
  dosya_tipi text check (dosya_tipi in ('txt','csv','xlsx')),
  sutun_eslestirme jsonb not null,   -- {"TRD":"turkce_dogru","TRY":"turkce_yanlis", ...}
  olusturma_tarihi timestamptz default now()
);

-- =====================================================
-- 7) HAM CEVAP VERİSİ (gelecekteki soru/kazanım bazlı analiz ve AI değerlendirme için)
-- =====================================================
-- İLK SÜRÜMDE KULLANILMAZ — analiz ekranları ve PDF rapor bu tabloları hiç okumaz.
-- Sadece veri buraya "mümkün olduğunda" yazılır, ki ileride kazanım/soru bazlı
-- analiz ve yapay zekâ destekli değerlendirme eklenebilsin.
--
-- Manuel D/Y/B girişinde bu veri YOKTUR (öğretmen tek tek şık girmiyor).
-- Optik okuyucu dosyasında öğrencinin işaretlediği şıklar varsa, veya ileride
-- fotoğraftan okuma eklenince, satırlar buraya yazılır.

-- Bir denemenin cevap anahtarı (doğru şık + gelecekte kazanım etiketi) — bir kez, deneme bazlı girilir
create table cevap_anahtarlari (
  id uuid primary key default gen_random_uuid(),
  deneme_id uuid references denemeler(id) on delete cascade,
  ders_id uuid references dersler(id),
  soru_no int not null,
  dogru_cevap text,          -- "A","B","C","D","E" gibi
  kazanim text,               -- gelecekte kazanım/konu etiketi (opsiyonel, boş bırakılabilir)
  unique (deneme_id, ders_id, soru_no)
);

-- Öğrencinin her soruya verdiği ham cevap
create table ogrenci_cevaplari (
  id uuid primary key default gen_random_uuid(),
  deneme_sonuc_id uuid references deneme_sonuclari(id) on delete cascade,
  ders_id uuid references dersler(id),
  soru_no int not null,
  verilen_cevap text,         -- öğrencinin işaretlediği şık, boşsa null/"" (boş bırakılmış)
  dogru_mu boolean,           -- import anında cevap_anahtarlari ile karşılaştırılıp yazılır (opsiyonel)
  olusturma_tarihi timestamptz default now(),
  unique (deneme_sonuc_id, ders_id, soru_no)
);

create index idx_ogrenci_cevap_sonuc on ogrenci_cevaplari(deneme_sonuc_id);
create index idx_cevap_anahtar_deneme on cevap_anahtarlari(deneme_id);

-- =====================================================
-- İNDEKSLER (binlerce öğrenci / on binlerce sonuç için performans)
-- =====================================================
create index idx_deneme_sonuc_ogrenci on deneme_sonuclari(ogrenci_id);
create index idx_deneme_sonuc_deneme on deneme_sonuclari(deneme_id);
create index idx_ders_sonuc_deneme_sonuc on ders_sonuclari(deneme_sonuc_id);
create index idx_denemeler_tarih on denemeler(deneme_tarihi desc);

-- =====================================================
-- ÖRNEK: Bir öğrencinin son 10 denemesinin toplam netini çekme
-- =====================================================
-- select d.deneme_adi, d.deneme_tarihi, ds.toplam_net
-- from deneme_sonuclari ds
-- join denemeler d on d.id = ds.deneme_id
-- where ds.ogrenci_id = '<ogrenci_uuid>'
-- order by d.deneme_tarihi desc
-- limit 10;
