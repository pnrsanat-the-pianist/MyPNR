import csv
import io

data = """Tarih	Alt Kategori	Kategori	Dönem	Taksit
2025-11-18	Derya Çalişir	Bale	Eylül 2025	
2025-09-05	Market Alışverişi	Değişken Giderler	Eylül 2025	
2025-09-05	Market Alışverişi	Değişken Giderler	Eylül 2025	
2025-09-08	Market Alışverişi	Değişken Giderler	Eylül 2025	
2025-09-08		Enstrüman Deneme	Eylül 2025	
2025-09-09	Bariş Tunç	Pi̇yano	Eylül 2025	
2025-09-09	SERMAYE	Hesaplar Arası	Eylül 2025	
2025-09-09	Ecri̇n Şahi̇n Maaş	Maaşlar	Eylül 2025	
2025-09-09	Market Alışverişi	Değişken Giderler	Eylül 2025	
2025-09-09	Can Güler	Pi̇yano	Eylül 2025	
2025-09-12	Seli̇n Savaci Maaş	Maaşlar	Eylül 2025	
2025-09-13	Doğa Sevgi̇ Aydoğmuş	Bale	Eylül 2025	
2025-09-13	Duru Meryem Aydoğmuş	Bale	Eylül 2025	
2025-09-14	Li̇ya Tunca	Pi̇yano	Eylül 2025	
2025-09-14	İpek Okçu	Pi̇yano	Eylül 2025	
2025-09-15	Pinar Kurtulan Maaş	Maaşlar	Eylül 2025	
2025-09-15	SERMAYE	Hesaplar Arası	Eylül 2025	
2025-09-20		Enstrüman Deneme	Eylül 2025	
2025-09-21	Defne Boran	Bale	Eylül 2025	
2025-09-21	Defne Boran	Hi̇phop	Eylül 2025	
2025-09-21	Market Alışverişi	Değişken Giderler	Eylül 2025	
2025-09-21	Fi̇li̇z Ergün Maaş	Değişken Giderler	Eylül 2025	
2025-09-22	Deni̇z Şi̇şman	Pi̇yano	Eylül 2025	
2025-09-24	Market Alışverişi	Değişken Giderler	Eylül 2025	
2025-09-27	Market Alışverişi	Maaşlar	Eylül 2025	
2025-09-27	Market Alışverişi	Değişken Giderler	Eylül 2025	
2025-09-29	Esra Atalay	Ukulele	Eylül 2025	
2025-09-30	Pinar Kurtulan Maaş	Maaşlar	Eylül 2025	
2025-09-30	İnci̇naz Alap	Pi̇yano	Eylül 2025	
2025-09-30	Fi̇li̇z Ergün Maaş	Maaşlar	Eylül 2025	
2025-10-01	Seli̇n Savaci Maaş	Maaşlar	Ekim 2025	
2025-09-13	Doğa Sevgi̇ Aydoğmuş	Bale	Ekim 2025	
2025-09-13	Duru Meryem Aydoğmuş	Bale	Ekim 2025	
2025-10-01	SERMAYE	Hesaplar Arası	Ekim 2025	
2025-10-04		Enstrüman Deneme	Ekim 2025	
2025-10-04	Meli̇ke Eli̇f Bayrakli	Bale	Ekim 2025	
2025-10-04	Uzay Aydin	Pi̇yano	Ekim 2025	
2025-10-04	Diğer	Değişken Giderler	Ekim 2025	
2025-10-04	SERMAYE	Hesaplar Arası	Ekim 2025	
2025-10-04	Pinar Tahi̇roğlu Maaş	Maaşlar	Ekim 2025	
2025-10-05	Defne Boran	Bale	Ekim 2025	
2025-10-05	Defne Boran	Hi̇phop	Ekim 2025	
2025-10-06	Lübeyna Esma Ki̇ri̇şçi̇	Gi̇tar	Ekim 2025	
2025-10-06	Fi̇li̇z Ergün Maaş	Maaşlar	Ekim 2025	
2025-10-06	Market Alışverişi	Değişken Giderler	Ekim 2025	
2025-10-06	SERMAYE	Hesaplar Arası	Ekim 2025	
2025-10-09	Market Alışverişi	Değişken Giderler	Ekim 2025	
2025-10-09	Market Alışverişi	Değişken Giderler	Ekim 2025	
2025-10-10	Ela Gözükeleş	Pi̇yano	Ekim 2025	
2025-10-11	İdi̇l Aydin	Keman	Ekim 2025	
2025-10-11	Defne Keski̇n	Bale	Ekim 2025	
2025-10-11	Market Alışverişi	Değişken Giderler	Ekim 2025	
2025-10-11		Atölye	Ekim 2025	
2025-10-11	Fi̇li̇z Ergün Maaş	Maaşlar	Ekim 2025	
2025-10-11	Market Alışverişi	Değişken Giderler	Ekim 2025	
2025-10-12	Defne Keski̇n	Bale	Ekim 2025	
2025-10-12	Meli̇ke Eli̇f Bayrakli	Bale	Ekim 2025	
2025-10-13	Pinar Kurtulan Maaş	Maaşlar	Ekim 2025	
2025-10-16	SERMAYE	Hesaplar Arası	Ekim 2025	
2025-10-16	Erkan Boz Maaş	Maaşlar	Ekim 2025	
2025-10-16	Seli̇n Savaci Maaş	Maaşlar	Ekim 2025	
2025-10-16	Diğer	Değişken Giderler	Ekim 2025	
2025-10-16	Diğer	Değişken Giderler	Ekim 2025	
2025-10-19	Fi̇li̇z Ergün Maaş	Maaşlar	Ekim 2025	
2025-10-19	Defne Boran	Bale	Ekim 2025	
2025-10-19	Fi̇li̇z Ergün Maaş	Maaşlar	Ekim 2025	
2025-10-19		Diğer	Ekim 2025	
2025-10-24	Diğer	Değişken Giderler	Ekim 2025	
2025-10-25	Fi̇li̇z Ergün	Gi̇tar	Ekim 2025	
2025-10-25	Fi̇li̇z Ergün Maaş	Maaşlar	Ekim 2025	
2025-10-25	Market Alışverişi	Değişken Giderler	Ekim 2025	
2025-10-29	Mehmet Altuğ Güzelce	Gi̇tar	Ekim 2025	
2025-10-29	Pinar Kurtulan Maaş	Maaşlar	Ekim 2025	
2025-11-02	Seli̇n Savaci Maaş	Maaşlar	Ekim 2025	
2025-11-04	Seli̇n Savaci Maaş	Maaşlar	Ekim 2025	
2025-11-09	Seli̇n Savaci Maaş	Maaşlar	Kasım 2025	
2025-09-13	Doğa Sevgi̇ Aydoğmuş	Bale	Kasım 2025	
2025-09-13	Duru Meryem Aydoğmuş	Bale	Kasım 2025	
2025-11-01	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-02	Defne Boran	Bale	Kasım 2025	
2025-11-02	Defne Boran	Hi̇phop	Kasım 2025	
2025-11-02		Atölye	Kasım 2025	
2025-11-02	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-02	Fi̇li̇z Ergün Maaş	Maaşlar	Kasım 2025	
2025-11-02	Fi̇li̇z Ergün Maaş	Maaşlar	Kasım 2025	
2025-11-02	Handan Arik Maaş	Maaşlar	Kasım 2025	
2025-11-03	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-04		Enstrüman Deneme	Kasım 2025	
2025-11-05	Diğer	Değişken Giderler	Kasım 2025	
2025-11-05	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-05	Diğer	Değişken Giderler	Kasım 2025	
2025-11-05	Diğer	Değişken Giderler	Kasım 2025	
2025-11-08	Fi̇li̇z Ergün Maaş	Maaşlar	Kasım 2025	
2025-11-08	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-09	Beli̇z Korkmaz	Bale	Kasım 2025	
2025-11-09	Diğer	Değişken Giderler	Kasım 2025	
2025-11-09	Diğer	Değişken Giderler	Kasım 2025	
2025-11-09	Diğer	Değişken Giderler	Kasım 2025	
2025-11-09	Bariş Tunç	Pi̇yano	Kasım 2025	
2025-11-09	Seli̇n Savaci Maaş	Maaşlar	Kasım 2025	
2025-11-10	Efe Atalay	Bateri̇	Kasım 2025	
2025-11-16	Mi̇lena Ataer	Bale	Kasım 2025	
2025-11-16	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-16	Fi̇li̇z Ergün Maaş	Maaşlar	Kasım 2025	
2025-11-16		Diğer	Kasım 2025	
2025-11-16	Pinar Kurtulan Maaş	Maaşlar	Kasım 2025	
2025-11-17	Mert Bayoğlu	Bateri̇	Kasım 2025	
2025-11-17	Reyhan Toy Maaş	Maaşlar	Kasım 2025	
2025-11-17	Pinar Kurtulan Maaş	Maaşlar	Kasım 2025	
2025-11-18	Derya Çalişir	Bale	Kasım 2025	
2025-11-18	Erkan Boz Maaş	Maaşlar	Kasım 2025	
2025-11-20	Sermaye	Hesaplar Arası	Kasım 2025	
2025-11-20	Pinar Tahi̇roğlu Maaş	Maaşlar	Kasım 2025	
2025-11-20	Diğer	Değişken Giderler	Kasım 2025	
2025-11-22	Meli̇ke Eli̇f Bayrakli	Bale	Kasım 2025	
2025-11-22	İpek Okçu	Pi̇yano	Kasım 2025	
2025-11-25	Pinar Kurtulan Maaş	Maaşlar	Kasım 2025	
2025-11-26	Fi̇li̇z Ergün Maaş	Maaşlar	Kasım 2025	
2025-11-26	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-26	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-26	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-27	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-27	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-29		Kıyafet Gideri	Kasım 2025	
2025-11-29	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-11-29	Market Alışverişi	Değişken Giderler	Kasım 2025	
2025-12-02	Seli̇n Savaci Maaş	Maaşlar	Kasım 2025	
20225-11-18	Di̇de Nazeni̇n Çapan Maaş	Maaşlar	Aralık 2025	
2025-11-18	Derya Çalişir	Bale	Aralık 2025	
2025-12-02	Can Güler	Pi̇yano	Aralık 2025	
2025-12-02	Fi̇li̇z Ergün Maaş	Maaşlar	Aralık 2025	
2025-12-02	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-06	Meli̇ke Eli̇f Bayrakli	Bale	Aralık 2025	
2025-12-06	Mi̇lena Ataer	Bale	Aralık 2025	
2025-12-06	Fi̇li̇z Ergün Maaş	Maaşlar	Aralık 2025	
2025-12-06	Uzay Aydin	Pi̇yano	Aralık 2025	
2025-12-07	Diğer	Değişken Giderler	Aralık 2025	
2025-12-07	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-09	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-09	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-09	Deni̇z Şi̇şman	Pi̇yano	Aralık 2025	
2025-12-11	Pinar Tahi̇roğlu Maaş	Maaşlar	Aralık 2025	
2025-12-11	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-13	Uzay Aydin	Pi̇yano	Aralık 2025	
2025-12-13	Ahsen Nur Çelebi̇	Keman	Aralık 2025	
2025-12-13		Atölye	Aralık 2025	
2025-12-13	Di̇de Nazeni̇n Çapa Maaş	Maaşlar	Aralık 2025	
2025-12-13	Reyhan Toy Maaş	Maaşlar	Aralık 2025	
2025-12-13	Damla Aras Maaş	Maaşlar	Aralık 2025	
2025-12-13	Erkan Boz Maaş	Maaşlar	Aralık 2025	
2025-12-15	Sarp Çehreli̇ Maaş	Maaşlar	Aralık 2025	
2025-12-15	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-15	Pinar Kurtulan Maaş	Maaşlar	Aralık 2025	
2025-12-15	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-15	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-15	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-15	Fi̇li̇z Ergün Maaş	Maaşlar	Aralık 2025	
2025-12-15	Oksana Batalova Uzun Maaş	Maaşlar	Aralık 2025	
2025-12-15	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-16	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-16	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-18	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-18	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-18	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-19	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-19	Peruzat Alço	MEB	Aralık 2025	
2025-12-19	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-19	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-20	Ahsen Nur Çelebi̇	Bale	Aralık 2025	
2025-12-21	Ahsen Nur Çelebi̇	Bale	Ocak 2026	
2025-12-20	Ahsen Nur Çelebi̇	Bale	Şubat 20206	
2025-12-20	Ahsen Nur Çelebi̇	Bale	Mart 2026	
2025-12-20	Ahsen Nur Çelebi̇	Bale	Aralık 2025	
2025-12-20	Defne Boran	Bale	Aralık 2025	
2025-12-20	Dora Ece Erdi̇nç	Pi̇yano	Aralık 2025	
2025-12-20	Fi̇li̇z Ergün Maaş	Maaşlar	Aralık 2025	
2025-12-20	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-20	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-20	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-20	Seli̇n Savaci Maaş	Maaşlar	Aralık 2025	
2025-12-20	Fi̇li̇z Ergün Maaş	Maaşlar	Aralık 2025	
2025-12-20	Market Alışverişi	Değişken Giderler	Aralık 2025	
20225-12-23	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-23	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-23	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-23	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-28	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-28	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-28	Fi̇li̇z Ergün Maaş	Maaşlar	Aralık 2025	
2025-12-28	Fi̇li̇z Ergün Maaş	Maaşlar	Aralık 2025	
2025-12-28	Handan Arik Maaş	Maaşlar	Aralık 2025	
2025-12-28	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-28	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-28	Pinar Kurtulan Maaş	Maaşlar	Aralık 2025	
2025-12-28	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-28	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-28	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-28		Kıyafet Gideri	Aralık 2025	
2025-12-28	Sermaye	Hesaplar Arası	Aralık 2025	
2025-12-28	Market Alışverişi	Değişken Giderler	Aralık 2025	
2025-12-28	Seli̇n Savaci Maaş	Maaşlar	Aralık 2025	
2025-12-28	Diğer	Değişken Giderler	Ocak 2026	
2026-01-03	İnci̇naz Alap	Pi̇yano	Ocak 2026	
2026-01-03	Derya Çalişir	Bale	Ocak 2026	
2026-01-03	Defne Boran	Bale	Ocak 2026	
2026-01-03	Seli̇n Savaci Maaş	Maaşlar	Ocak 2026	
2026-01-03	Sermaye	Hesaplar Arası	Ocak 2026	
2026-01-03	Market Alışverişi	Değişken Giderler	Ocak 2026	
2025-01-04	Meli̇ke Eli̇f Bayrakli	Bale	Ocak 2026	
2025-01-04	Li̇ya Tunca	Pi̇yano	Ocak 2026	
2026-01-05	Sermaye	Hesaplar Arası	Ocak 2026	
2026-01-05	Market Alışverişi	Değişken Giderler	Ocak 2026	
2026-01-05	Sermaye	Hesaplar Arası	Ocak 2026	
2026-01-05	Market Alışverişi	Değişken Giderler	Ocak 2026	
2026-01-05	Sermaye	Hesaplar Arası	Ocak 2026	
2026-01-05	Market Alışverişi	Değişken Giderler	Ocak 2026	
2026-01-05	Sermaye	Hesaplar Arası	Ocak 2026	
2026-01-05	Market Alışverişi	Değişken Giderler	Ocak 2026	
2026-01-06		Kıyafet Gideri	Ocak 2026	
2026-01-06	Market Alışverişi	Değişken Giderler	Ocak 2026	
2026-01-07	Pera Erkaya	Pi̇yano	Ocak 2026	
8 January 26 	Ahsen Nur Çelebi̇	Keman	Ocak 2026	
11 January 26 	Mi̇lena Ataer	Bale	Ocak 2026	
11 January 26 	Fi̇li̇z Ergün Maaş	Maaşlar	Ocak 2026	
11 January 26 	Market Alışverişi	Değişken Giderler	Ocak 2026	
15 January 26 	Erkan Boz Maaş	Maaşlar	Ocak 2026	
15 January 26 	Pinar Kurtulan Maaş	Maaşlar	Ocak 2026	
15 January 26 	Seli̇n Savaci Maaş	Maaşlar	Ocak 2026	
18 January 26 	Ni̇l Erdoğan	Bale	Şubat 20206	
18 January 26 	Ni̇l Erdoğan	Bale	Mart 2026	
18 January 26 	Ni̇l Erdoğan	Bale	Ocak 2026	
18 January 26 	Mi̇lena Ataer	Bale	Ocak 2026	
18 January 26 	Beli̇z Korkmaz	Bale	Ocak 2026	
18 January 26 	Fi̇li̇z Ergün Maaş	Maaşlar	Ocak 2026	
24 January 26 		Enstrüman Deneme	Ocak 2026	
24 January 26 	Market Alışverişi	Değişken Giderler	Ocak 2026	
24 January 26 	Market Alışverişi	Değişken Giderler	Ocak 2026	
24 January 26 	Market Alışverişi	Değişken Giderler	Ocak 2026	
24 January 26 	Diğer	Değişken Giderler	Ocak 2026	
25 January 26 	Fi̇li̇z Ergün Maaş	Maaşlar	Ocak 2026	
25 January 26 	Pinar Kurtulan Maaş	Maaşlar	Ocak 2026	
25 January 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
2 February 26 	Ömer Boz Kurt	Bateri̇	Şubat 20206	
2 February 26 	Seli̇n Savaci Maaş	Maaşlar	Şubat 20206	
2 February 26 	Fi̇li̇z Ergün Maaş	Maaşlar	Şubat 20206	
2 February 26 	Pinar Kurtulan Maaş	Maaşlar	Şubat 20206	
2 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
2 February 26 	Mert Bayoğlu	Bateri̇	Şubat 20206	
3 February 26 	Sermaye	Hesaplar Arası	Şubat 20206	
3 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
3 February 26 	Sermaye	Hesaplar Arası	Şubat 20206	
3 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
3 February 26 	Sermaye	Hesaplar Arası	Şubat 20206	
3 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
3 February 26 	Sermaye	Hesaplar Arası	Şubat 20206	
3 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
3 February 26 		Kıyafet Gideri	Şubat 20206	
3 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
3 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
3 February 26 	Diğer	Değişken Giderler	Şubat 20206	
10 February 26 	Diğer	Değişken Giderler	Şubat 20206	
10 February 26 	Defne Boran	Bale	Şubat 20206	
10 February 26 	Fi̇li̇z Ergün Maaş	Maaşlar	Şubat 20206	
10 February 26 	Defne Boran	Bale	Şubat 20206	
10 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
10 February 26 	Kasadan - Denizbanka	Hesaplar Arası	Şubat 20206	
10 February 26 	Seli̇n Savaci Maaş	Maaşlar	Şubat 20206	
16 February 26 	Sermaye	Hesaplar Arası	Şubat 20206	
16 February 26 	Reyhan Toy Maaş	Maaşlar	Şubat 20206	
16 February 26 	Damla Aras Maaş	Maaşlar	Şubat 20206	
16 February 26 	Di̇de Nazeni̇n Çapa Maaş	Maaşlar	Şubat 20206	
16 February 26 	Pinar Kurtulan Maaş	Maaşlar	Şubat 20206	
16 February 26 	Pinar Tahi̇roğlu Maaş	Maaşlar	Şubat 20206	
16 February 26 	Sarp Çehreli̇ Maaş	Maaşlar	Şubat 20206	
16 February 26 	Erkan Boz Maaş	Maaşlar	Şubat 20206	
16 February 26 	Fi̇li̇z Ergün Maaş	Maaşlar	Şubat 20206	
16 February 26 	Market Alışverişi	Değişken Giderler	Şubat 20206	
16 February 26 	Ömer Boz Kurt	Bateri̇	Şubat 20206	
16 February 26 	Diğer	Değişken Giderler	Şubat 20206	"""

output_file = "database/cash_book_export.csv"

# Function to parse individual lines which might have mixed tab/space separation
def parse_line(line):
    # Try splitting by tab first
    parts = [p.strip() for p in line.split('\t')]
    if len(parts) < 2:
        # Fallback to multiple spaces if tabs aren't present
        import re
        parts = [p.strip() for p in re.split(r' {2,}', line)]
    return parts

lines = data.strip().split('\n')
header = parse_line(lines[0])

with open(output_file, mode='w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    for line in lines[1:]:
        row = parse_line(line)
        # Ensure row has matching length to header, pad with empty if needed
        while len(row) < len(header):
            row.append("")
        writer.writerow(row)

print(f"CSV created: {output_file}")
