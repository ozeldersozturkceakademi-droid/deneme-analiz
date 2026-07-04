# PROJE DURUMU — Deneme Analiz ve Raporlama Modülü

**Son güncelleme:** 03.07.2026
**Kurum:** Özel Öztürkçe Akademi Kişisel Gelişim Kursu
**Hedef adres:** deneme.ozturkceakademi.com (panel.ozturkceakademi.com'dan bağımsız, ayrı bir site)

## Proje Amacı
Öğrenci deneme sonuçlarını saklayan, otomatik analiz eden, önceki denemeyle karşılaştıran,
veliye sade sunan ve tek sayfalık kurumsal PDF rapor üreten bağımsız bir modül.

## Şu Ana Kadar Tamamlananlar

### 1. Tasarım Sistemi (netleşti)
- Renk paleti: lacivert (#0a1a37 / #0f2657), mavi (#2b5fc7), buz beyazı (#eef3fb)
- Yazı tipleri: Manrope (başlıklar/rakamlar), Inter (gövde metin)
- Logo: kurumun "CA" monogramlı dairesel logosu (tüm sayfalara gömülü — base64)
- Mobile-first, kart tabanlı, sade/premium görünüm

### 2. Prototip Dosyaları (statik, örnek veriyle — henüz Supabase'e bağlı değil)
- `index.html` — Kök yönlendirme sayfası, giris.html'e otomatik yönlendirir
- `giris.html` — Veli / Öğretmen / Admin rol seçimli giriş ekranı (rol bazlı yönlendirme JS'te hazır)
- `detay-sayfasi.html` — Veli detay ekranı: hero net, ders analiz tablosu, puan/sıralama,
  son 10 deneme çizgi grafiği (Chart.js), öğretmen yorumu, **PDF Oluştur** butonu (html2canvas + jsPDF)
- `veli-paneli.html` — Ana veli ekranı: karşılama bandı, özet kart, deneme kartları listesi
  (net + değişim rozeti yeşil/kırmızı/nötr)
- `ogretmen-paneli.html` — 2 sekme: Sonuç Gir (manuel D-Y-B, canlı net + aşım uyarısı) /
  Öğrenci Ara (isim/no ile arama, geçmiş deneme kartları). Deneme oluşturma veya dosya
  aktarma yetkisi YOK — bunlar sadece admin'de.
- `admin-paneli.html` — 3 sekme: Deneme Oluştur / Manuel Giriş (D-Y-B, canlı net hesaplama,
  soru sayısı aşım uyarısı) / Dosyadan Aktar (PapaParse + SheetJS ile gerçek CSV/TXT/XLSX okuma,
  sütun eşleştirme ekranı, canlı veri önizleme tablosu, localStorage ile profil hafızası simülasyonu)
  + "Optik Okuma" sekmesi `optik-okuma.html`'e yönlendiriyor
- `optik-okuma.html` — Fotoğraftan cevap okuma modülü (bkz. aşağıdaki ayrı bölüm)
- `ornek-optik-cikti.csv`, `ornek-optik-cikti-2.txt` — admin panelindeki "Dosyadan Aktar"ı test
  etmek için iki farklı formatta (farklı sütun adı/ayraç) örnek dosya

### 3. Veritabanı Şeması (henüz gerçek Supabase projesinde çalıştırılmadı)
`supabase-sema.sql` dosyasında 8 tablo:
- `ogrenciler`, `denemeler`, `dersler`, `deneme_sonuclari`, `ders_sonuclari`, `okuyucu_profilleri`,
  `cevap_anahtarlari`, `ogrenci_cevaplari` (son ikisi ham cevap altyapısı — ilk sürümde kullanılmıyor)
- Net hesabı generated column: `net = dogru - (yanlis/3)` — otomatik, elle güncellenmiyor
- Önceki denemeyle karşılaştırma ayrı tabloda tutulmuyor, sorgu anında hesaplanıyor
- `okuyucu_profilleri.sutun_eslestirme` (jsonb) — optik okuyucu formatlarının hafızası

### 4. Supabase Bağlantı İskeleti
`supabase-baglanti.js` — URL/key girilince çalışmaya hazır fonksiyonlar:
`ogrenciGetir`, `ogrenciAra`, `denemeOlustur`, `denemeleriListele`, `ogrenciSonuclariGetir`,
`denemeSonucDetayGetir`, `sonDenemelerGrafik`, `sonucKaydet`, `profilKaydet`, `profilBul`

### 5. Oturum Yönetimi (Auth Guard — client-side, gerçek doğrulama henüz yok)
- `giris.html`: giriş yapılınca `sessionStorage`'a `deneme_kullanici_adi` ve `deneme_kullanici_rol`
  (veli/ogretmen/admin) yazılır, ilgili panele yönlendirilir
- Her panel açılışta bu session'ı kontrol eder; yoksa veya rol uyuşmuyorsa `giris.html`'e atar
  (SinUs'taki IIFE guard yaklaşımının aynısı)
- Her panelde **Çıkış Yap** butonu var — session'ı temizleyip girişe döner
- `detay-sayfasi.html`'deki geri oku, hangi rolle girildiyse doğru panele dönecek şekilde ayarlı
- Veli panelindeki deneme kartları artık gerçekten `detay-sayfasi.html`'e yönlendiriyor
- **Not:** Şu an herhangi bir kullanıcı adı/şifre ile giriş yapılabiliyor (gerçek doğrulama yok).
  Panelleri test ederken direkt dosyayı açmak yerine önce `giris.html`'den girmek gerekiyor.

### 6. Optik Okuma Modülü (yeni — 04.07.2026 eklendi)
`optik-okuma.html` — admin panelinden "Optik Okuma" sekmesiyle erişiliyor. Akış:
1. Deneme seç (mevcut listeden veya "+ Yeni Deneme Ekle"), ders seç (Türkçe/Matematik/Fen/
   Sosyal/İngilizce/Din), soru sayısı gir, cevap anahtarını yaz (örn. "ABCDABCD...", uzunluk
   soru sayısıyla anlık doğrulanıyor)
2. Öğrenci seç
3. Optik form fotoğrafını yükle
4. **Kalibrasyon:** öğretmen cevap kutucuk bloğunun 4 köşesine sırayla tıklar (Sol Üst → Sağ
   Üst → Sağ Alt → Sol Alt). Bu, spesifikasyondaki "sabit optik şablon" mantığının pratik
   karşılığı — coğrafi olarak bilinen bir fiziksel şablon koordinatımız olmadığı için elle
   kalibre ediliyor.
5. **Oku** butonu: her soru/şık hücresinin konumu bilinear interpolasyonla hesaplanıyor, o
   bölgenin piksel koyuluğu ölçülüyor. En koyu şık cevap kabul ediliyor; hiçbiri yeterince koyu
   değilse "Boş"; iki şık birbirine yakın koyulukta ise "çift işaretli" + düşük güven skoru.
6. Sonuç tablosu: **Soru | Okunan Cevap | Güven % | Manuel Düzeltme** (dropdown). Düşük güvenli
   veya çift işaretli satırlar sarı vurgulu. Dropdown'dan düzeltme yapılırsa güven otomatik %100'e
   çekiliyor.
7. D/Y/B/Net özet barı canlı güncelleniyor, "Sonucu Kaydet" ile kaydediliyor (şu an prototip alert).

**Teknik mimari kararı:** Orijinal öneri Python/OpenCV tabanlı ayrı bir backend servisiydi.
Bunun yerine tamamen **tarayıcı içi Canvas/JS** ile çözüldü — GitHub Pages + Supabase statik
mimarisini bozmuyor, ayrı sunucu/hosting/deploy gerektirmiyor. Perspektif düzeltme gerçek
homografi yerine 4-nokta bilinear örnekleme ile yapılıyor; düz/önden çekilmiş fotoğraflarda iyi
çalışır, çok eğik fotoğraflarda hassasiyet düşebilir (ileride gerekirse geliştirilecek nokta).

**Şemaya tam uyumlu:** Bu modülün ürettiği veri (`ogrenci_cevaplari`, `cevap_anahtarlari`)
bir önceki oturumda eklediğimiz "ham cevap verisi" tablolarına birebir oturuyor —
`hamCevaplariKaydet` ve `cevapAnahtariKaydet` fonksiyonları bunun için zaten hazırdı.

## Bekleyen İşler (sırayla)
1. **Supabase projesi kurulumu** — Fok'un supabase.com'da yeni proje açması, URL + anon key paylaşması
2. `supabase-sema.sql`'i SQL Editor'de çalıştırma
3. `supabase-baglanti.js`'e URL/key girme, dört HTML dosyasındaki sabit örnek veriyi gerçek
   Supabase sorgularıyla değiştirme
4. Gerçek auth: `kullanicilar` tablosu + şifre doğrulama (giriş ekranının UI'ı hazır, arka planı yok)
5. GitHub repo oluşturma (SinUs'taki gibi ayrı repo, GitHub Pages)
6. Domain bağlama: deneme.ozturkceakademi.com için DNS CNAME kaydı + GitHub Pages custom domain
7. panel.ozturkceakademi.com'a "Deneme Sonuçları" butonu ekleme (mevcut panel reposunda)

**Not:** Buradan sonrası Supabase projesi olmadan verimli ilerlemiyor — bir sonraki oturumda
önce Supabase kurulumunu (madde 1-3) bitirmek en doğrusu olur.

### Optik Okuma — Gelecek Geliştirmeler (V1 kapsamı DIŞINDA, sadece not)
1. Cevap anahtarını fotoğraftan okuma
2. Farklı yayınevi optik şablonları (her biri ayrı kalibrasyon profili olarak saklanabilir)
3. Toplu öğrenci optiği yükleme (tek seferde çoklu fotoğraf)
4. Sınıf/kurum bazlı deneme analizi
5. Konu/kazanım analizi (`cevap_anahtarlari.kazanim` alanı buna hazır)
6. Veli panelinde deneme gelişim grafiği (zaten `detay-sayfasi.html`'de var, optik veriyle
   otomatik beslenecek)
7. PDF/Excel sonuç çıktısı (PDF zaten var, Excel eklenebilir)
8. Hatalı okuma uyarısı ve düşük güven skoru sistemi (temel hali zaten var — sarı satır uyarısı)

## Önemli Kararlar / Notlar
- **Ham cevap verisi (kritik mimari prensip):** Sadece Doğru/Yanlış/Net değil, mümkün olduğunda
  öğrencinin her soruya verdiği ham cevap da saklanır — `ogrenci_cevaplari` tablosu (deneme_sonuc_id,
  ders_id, soru_no, verilen_cevap). `cevap_anahtarlari` tablosu da her denemenin doğru cevap +
  gelecekte kazanım etiketini tutmak için hazır. İLK SÜRÜMDE hiçbir analiz ekranı veya PDF bu
  tabloları okumaz — sadece varsa veri buraya yazılır ki ileride soru bazlı analiz, kazanım analizi
  ve AI destekli değerlendirme eklenebilsin. Manuel D/Y/B girişinde bu veri doğal olarak YOK (öğretmen
  tek tek şık girmiyor); optik okuyucu dosyasında öğrenci cevapları varsa veya ileride fotoğraftan
  okuma eklenince buraya yazılacak. `supabase-baglanti.js`'te `hamCevaplariKaydet` ve
  `cevapAnahtariKaydet` fonksiyonları hazır, veri yoksa sessizce hiçbir şey yapmıyorlar.
- **Veri giriş yönteminden bağımsızlık (kritik mimari prensip):** Sonuç ister manuel girilsin,
  ister TXT/CSV/Excel'den aktarılsın, ister ileride fotoğraftan okunsun — hepsi aynı
  `deneme_sonuclari` / `ders_sonuclari` tablolarına yazılır, aynı analiz ekranlarını ve aynı PDF
  şablonunu kullanır. `giris_yontemi` alanı (`manuel`/`dosya`/`fotograf`) sadece kaynağı not eder,
  akışı değiştirmez. `supabase-baglanti.js`'teki `sonucKaydet` tek ortak fonksiyondur; hem manuel
  giriş hem `sonucKaydetToplu` (dosyadan aktarma) bunu çağırır. İleride fotoğraf okuma eklenince de
  aynı fonksiyon kullanılacak, sadece veriyi hazırlayan katman değişecek.
- Bu modül SinUs'tan tamamen ayrı bir proje — farklı kurum, farklı repo, farklı Supabase projesi olacak
- Aşama 1 dosyalardan biri değil; SinUs mimarisiyle karıştırılmamalı
- Dosya okuma esnekliği: TXT/CSV/XLSX destekleniyor, PDF okuma ilk sürümde YOK (spesifikasyon gereği)
- Sütun eşleştirme bir kez yapılınca profil olarak saklanıyor, aynı optik okuyucu için tekrar sorulmuyor
- Ders listesi ilk sürümde sabit: Türkçe, İnkılap Tarihi, Din Kültürü, İngilizce, Matematik, Fen Bilimleri
- Rol ayrımı netleşti: Veli → sadece görüntüleme; Öğretmen → sonuç girişi + öğrenci arama/takip;
  Admin → hepsi + deneme oluşturma + toplu dosya aktarımı + (ileride) kurum yönetimi
