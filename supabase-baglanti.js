// =====================================================
// SUPABASE BAĞLANTI İSKELETİ — Deneme Analiz Modülü
// =====================================================
// Kullanım: HTML dosyalarına şu satırı ekle (Supabase JS CDN):
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="supabase-baglanti.js"></script>
//
// Supabase projesi oluşunca aşağıdaki iki satırı doldur, gerisi hazır.

const SUPABASE_URL = "BURAYA_PROJECT_URL";       // örn: https://xxxxx.supabase.co
const SUPABASE_KEY = "BURAYA_ANON_KEY";          // Settings → API → anon public

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// =====================================================
// ÖĞRENCİ İŞLEMLERİ
// =====================================================
async function ogrenciGetir(ogrenciId){
  const { data, error } = await sb.from('ogrenciler').select('*').eq('id', ogrenciId).single();
  if(error){ console.error('ogrenciGetir hatası:', error); return null; }
  return data;
}

async function ogrenciAra(aramaMetni){
  const { data, error } = await sb.from('ogrenciler')
    .select('*')
    .ilike('ad_soyad', `%${aramaMetni}%`);
  if(error){ console.error('ogrenciAra hatası:', error); return []; }
  return data;
}

// =====================================================
// DENEME İŞLEMLERİ
// =====================================================
async function denemeOlustur(denemeAdi, yayin, tarih, aciklama){
  const { data, error } = await sb.from('denemeler')
    .insert([{ deneme_adi: denemeAdi, yayin, deneme_tarihi: tarih, aciklama }])
    .select();
  if(error){ console.error('denemeOlustur hatası:', error); return null; }
  return data[0];
}

async function denemeleriListele(){
  const { data, error } = await sb.from('denemeler')
    .select('*')
    .order('deneme_tarihi', { ascending: false });
  if(error){ console.error('denemeleriListele hatası:', error); return []; }
  return data;
}

// =====================================================
// SONUÇ İŞLEMLERİ
// =====================================================

// Bir öğrencinin tüm deneme sonuçlarını (son deneme en üstte) getirir — veli paneli kart listesi için
async function ogrenciSonuclariGetir(ogrenciId){
  const { data, error } = await sb
    .from('deneme_sonuclari')
    .select(`
      id, toplam_net, olusturma_tarihi,
      denemeler ( deneme_adi, yayin, deneme_tarihi )
    `)
    .eq('ogrenci_id', ogrenciId)
    .order('olusturma_tarihi', { ascending: false });
  if(error){ console.error('ogrenciSonuclariGetir hatası:', error); return []; }
  return data;
}

// Tek bir deneme sonucunun tüm detayını (ders bazlı + önceki denemeyle karşılaştırma) getirir — detay sayfası için
async function denemeSonucDetayGetir(denemeSonucId){
  const { data: sonuc, error: e1 } = await sb
    .from('deneme_sonuclari')
    .select(`*, denemeler(*), ogrenciler(*)`)
    .eq('id', denemeSonucId)
    .single();
  if(e1){ console.error('denemeSonucDetayGetir hatası:', e1); return null; }

  const { data: dersSonuclari, error: e2 } = await sb
    .from('ders_sonuclari')
    .select(`*, dersler(ders_adi, sira)`)
    .eq('deneme_sonuc_id', denemeSonucId)
    .order('dersler(sira)');
  if(e2){ console.error('ders_sonuclari hatası:', e2); return null; }

  // önceki deneme ile karşılaştırma
  const { data: oncekiler } = await sb
    .from('deneme_sonuclari')
    .select('toplam_net, denemeler(deneme_tarihi)')
    .eq('ogrenci_id', sonuc.ogrenci_id)
    .lt('denemeler.deneme_tarihi', sonuc.denemeler.deneme_tarihi)
    .order('denemeler(deneme_tarihi)', { ascending: false })
    .limit(1);

  const oncekiNet = oncekiler && oncekiler[0] ? oncekiler[0].toplam_net : null;
  const degisim = oncekiNet !== null ? (sonuc.toplam_net - oncekiNet) : null;

  return { sonuc, dersSonuclari, degisim };
}

// Son N denemenin toplam net grafiği için (çizgi grafik)
async function sonDenemelerGrafik(ogrenciId, adet = 10){
  const { data, error } = await sb
    .from('deneme_sonuclari')
    .select('toplam_net, denemeler(deneme_adi, deneme_tarihi)')
    .eq('ogrenci_id', ogrenciId)
    .order('denemeler(deneme_tarihi)', { ascending: false })
    .limit(adet);
  if(error){ console.error('sonDenemelerGrafik hatası:', error); return []; }
  return data.reverse(); // grafikte eskiden yeniye sıralı olsun
}

// TEK ORTAK SONUÇ KAYIT FONKSİYONU
// Manuel giriş, dosyadan toplu aktarma ve ileride fotoğraf okuma — hepsi bu fonksiyonu
// çağırır. Kaynak farkı sadece girisYontemi parametresiyle not edilir, veri yapısı
// ve sonrasındaki analiz/PDF akışı tamamen aynıdır.
async function sonucKaydet(ogrenciId, denemeId, dersSonuclariArray, girisYontemi = 'manuel', ekBilgiler = {}){
  // 1) genel sonuç satırı
  const toplamNet = dersSonuclariArray.reduce((acc, d) => acc + (d.dogru - d.yanlis/3), 0);
  const { data: sonuc, error: e1 } = await sb.from('deneme_sonuclari')
    .insert([{
      ogrenci_id: ogrenciId,
      deneme_id: denemeId,
      toplam_net: toplamNet,
      giris_yontemi: girisYontemi, // 'manuel' | 'dosya' | 'fotograf'
      ...ekBilgiler
    }])
    .select();
  if(e1){ console.error('sonucKaydet hatası:', e1); return null; }

  // 2) ders bazlı satırlar
  const dersRows = dersSonuclariArray.map(d => ({
    deneme_sonuc_id: sonuc[0].id,
    ders_id: d.ders_id,
    dogru: d.dogru,
    yanlis: d.yanlis,
    bos: d.bos
  }));
  const { error: e2 } = await sb.from('ders_sonuclari').insert(dersRows);
  if(e2){ console.error('ders_sonuclari kaydetme hatası:', e2); return null; }

  return sonuc[0];
}

// Dosyadan toplu aktarım (admin panelindeki "Dosyadan Aktar" sekmesi bunu çağıracak)
// satirlar: [{ ogrenci_id, deneme_id, dersSonuclariArray }, ...]
// Manuel girişle AYNI sonucKaydet fonksiyonunu kullanır — tek fark girisYontemi='dosya'.
async function sonucKaydetToplu(satirlar){
  const sonuclar = [];
  for(const satir of satirlar){
    const sonuc = await sonucKaydet(satir.ogrenci_id, satir.deneme_id, satir.dersSonuclariArray, 'dosya');
    sonuclar.push(sonuc);
  }
  return sonuclar;
}

// =====================================================
// HAM CEVAP VERİSİ (opsiyonel — gelecekteki soru/kazanım analizi için)
// =====================================================
// İLK SÜRÜMDE hiçbir analiz ekranı bunu okumaz. Sadece veri varsa (optik okuyucu
// dosyasında öğrencinin işaretlediği şıklar geldiyse) buraya yazılır.
// cevaplarArray: [{ ders_id, soru_no, verilen_cevap }, ...]
async function hamCevaplariKaydet(denemeSonucId, cevaplarArray){
  if(!cevaplarArray || cevaplarArray.length === 0) return null; // veri yoksa hiçbir şey yapma

  const rows = cevaplarArray.map(c => ({
    deneme_sonuc_id: denemeSonucId,
    ders_id: c.ders_id,
    soru_no: c.soru_no,
    verilen_cevap: c.verilen_cevap || null,
  }));
  const { error } = await sb.from('ogrenci_cevaplari').insert(rows);
  if(error){ console.error('hamCevaplariKaydet hatası:', error); return null; }
  return true;
}

// Bir deneme için cevap anahtarını kaydetme (opsiyonel, kazanım analizi altyapısı için)
async function cevapAnahtariKaydet(denemeId, dersId, anahtarArray){
  // anahtarArray: [{ soru_no, dogru_cevap, kazanim }, ...]
  const rows = anahtarArray.map(a => ({
    deneme_id: denemeId, ders_id: dersId,
    soru_no: a.soru_no, dogru_cevap: a.dogru_cevap, kazanim: a.kazanim || null,
  }));
  const { error } = await sb.from('cevap_anahtarlari').insert(rows);
  if(error){ console.error('cevapAnahtariKaydet hatası:', error); return null; }
  return true;
}

// =====================================================
// OKUYUCU PROFİLİ (sütun eşleştirme hafızası)
// =====================================================
async function profilKaydet(profilAdi, dosyaTipi, sutunEslestirme){
  const { data, error } = await sb.from('okuyucu_profilleri')
    .insert([{ profil_adi: profilAdi, dosya_tipi: dosyaTipi, sutun_eslestirme: sutunEslestirme }])
    .select();
  if(error){ console.error('profilKaydet hatası:', error); return null; }
  return data[0];
}

async function profilBul(imzaSutunlari){
  // imzaSutunlari: dosyadaki sütun başlıklarının dizisi
  const { data, error } = await sb.from('okuyucu_profilleri').select('*');
  if(error || !data) return null;
  // basit eşleştirme: aynı sütun kümesine sahip kayıtlı profil var mı
  return data.find(p => {
    const kayitliSutunlar = Object.keys(p.sutun_eslestirme);
    return imzaSutunlari.length === kayitliSutunlar.length &&
      imzaSutunlari.every(s => kayitliSutunlar.includes(s));
  }) || null;
}
