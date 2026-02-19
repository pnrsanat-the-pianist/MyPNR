const fs = require('fs');
const path = require('path');

const data = `9 Eyl 2025	Kurum	Atölye	40	0532 256 93 27	YETİŞKİN ATÖLYELERİ 	 YETİŞKİN ATÖLYELERİ SUNUYOR. HAZIRLANINCA HABER VERİLECEK.
17 Eyl 2025	Kurum	İş Birliği		0216 362 33 71	NEŞELİ AYAKLAR ÇOCUK YUVASI	 BALE TANITIM ATÖLYESİ İÇİN EKİM AYINDA ARANACAK. 11.12 YARIN ÖĞLEDEN SONRA ARANACAK. 22 12  ZEYNEP HANIM  0534 323 18 61  PROGRAMI GÖNDERECEĞİM. 
17 Eyl 2025	Kurum	İş Birliği		0535 747 58 80	KADIKÖY ÖZEL SUADİYE ANAOKULU	 FULYA HANIMEKİM 2. YARI TEKRAR ARANACAK.BALE TANITIM ATÖLYESİ İÇİN
18 Eyl 2025	Öğrenci	Atölye		0537 256 10 46	BEHİYE SÖNMEZ	 YETİŞKİN ATÖLYESİ İSTİYOR.
1 Eki 2025		Hip Hop	7	0536 339 65 67	RUHİYE HANIM	BAHAR GÜNDÜZ BİLGİLENDİRME YAPILDI. 13.10 
7 Eki 2025		Konservatuar Hazırlık	13	0552 412 58 44	ZEHRA HANIM	LAYLA GÜZEL SANATLARA HAZIRLIK PİYANO İSTİYOR. PINAR HANIM ÇALIŞMA YAPACAK.
11 Eki 2025		Modern Dans	4	0532 542 52 65	ZEYNEP MUTLU	LİNA  YAŞI ÇOK KÜÇÜK. 20.10 BALE YE DAVET ETTİM. CEVAP BEKLİYORUM. 27.10 DENEMEYE GELDİ. DÖNÜŞ BEKLİYORUZ.  11.11 HİPHOP DERSİNE KAYIT OLACAKTI BU CUMARTESİ PROGRAM KAPANDI. 
16 Eki 2025	Öğretmen	Bateri		0531 994 91 10	TÜMAY HOCA	BATERİ ÖĞRETMENİ CV ATACAK. 20.10 CV'Sİ YOKMUŞ. İSTANBUL TEKNİK ÜNİVERSİTESİ  KONSERVATUVAR SON SINIF ÖĞRENCİSİ. AKARETLERDE BİR SANAT MERKEZİNDE DERS VERİYORMUŞ. 22.12  27 ARALIK CMT SAAT 12.00
31 Eki 2025		Hip Hop	6	0507 485 26 08	DİDEM HANIM	DİLA 2 YIL BALE GEÇMİŞİ VAR. 
10 Kas 2025	Öğrenci	Hip Hop		0544 387 74 75	ZUHAL HANIM	 
10 Kas 2025	Kurum	İş Birliği		0530 582 01 70	EMİN BEY	 TACİGİLLER TAKUTA ATÖLYESİ
10 Kas 2025	Kurum	İş Birliği		0555 077 03 96	ŞEYDA ATMACA	 ABAJUR TASARIM ATÖLYESİ KIDS LİGHT WOK SHOP
10 Kas 2025	Kurum	İş Birliği		0538 045 18 19	İLKMURAT AYGUN	 SAAT BOYAMA LUMİNO
10 Kas 2025	Kurum	İş Birliği		0539 273 30 83	CODE AND JOY	 KODLAMA ATÖLYESİ
26 Kas 2025	Öğretmen	Piyano		0534 763 83 78	ALTUN BURCU ÇANKAYA	ŞAN VE PİYANO KONSERVATUVAR ŞAN BÖLÜMÜ İTÜ MEZUNU
28 Kas 2025	Öğretmen	Bale		0539 841 10 60	İPEK HOCA	BALE 9 ARALIK PERŞEMBE 17.00 22.12 SALI VE PERŞEMBE GÜNÜ İÇİN DÜŞÜNÜLEBİR. 
3 Oca 2026	Öğretmen	Bale		0530 481 18 23	AYŞEGÜL SÖKMEN	 BALE ÖĞRETMENİ.
4 Oca 2026			27	0534 574 44 61		VERIMOR 8.1 ULAŞILAMIYOR. TEMEL SEVİYEDEN BAŞLAYACAK. KENDİSİ DÖNÜŞ YAPACAK
6 Oca 2026	Öğrenci	Gitar	7	0507 484 47 14	GİZEM HANIM	 KASIM AYI HAFTASI UYGUN DEĞİLDİ. UYGUN OLDUĞU TAKDİRDE DÖNÜŞ SAĞLAYACAĞIM DEDİ. PROGRAMINIZ ŞU AN UYGUNSA DENEME DERSİ YAPABİLİRİZ DİYE MESAJ ATTIM. ARAMADIM. BEN SİZİ ARAYACAĞIM DEDİĞİ İÇİN.
17 Oca 2026	Öğrenci	Bale	3	0554 888 66 99	NİLÜFER HANIM	 19 OCAK PAZAR 10.00 DENEMEYE ÇAĞIRILDI. HABER BEKLENİYOR. 12.2 GELMEDİ. 
17 Oca 2026	Öğrenci	Ukulele	24	0533 129 08 99	ESMA ALTUN	 24.1 31 OCAK İÇİN DÖNÜŞ YAPACAK. 12.2 DÖNÜŞ YAPMADI. TEKRAR İLETİŞİME GEÇİLDİ. 
20 Oca 2026		Bale	4	0533 332 27 61	ASLI HANIM	ADA GÜNEY 8 ŞUBAT 11.00 12.2 GELDİ. DÖNÜŞ BEKLEYORUZ. 
24 Oca 2026	Öğrenci	Keman	8	0554 774 79 79	TANER BEY	 14 ŞUBAT 14.00
29 Oca 2026		Bateri	15	0533 555 00 28		VERIMOR 4-5 DERSLİK DÜŞÜNÜYORMUŞ. SIKIŞTIRILMIŞ PROGRAM İSTİYOR. 10 DERS İSTEMİYOR. KENDİSİ ÇOCUĞU İLE GÖRÜŞÜP DÖNÜŞ YAPACAKMIŞ..ÜCRETİMİZ ÇOK YÜKSEMİŞ. 12.2 BEKLETİYORUM. 
29 Oca 2026		Bale	2	0534 057 84 78	AYFER HANIM 	VERIMOR PAZAR GÜNÜ İSTİYOR. DENEMEYE ÇAĞRILACAK. 11.2 14 ŞUBAT 10.00 ÇAĞIRILDI. 
29 Oca 2026		Bale	3	0538 950 57 68	BEYZA HANIM 	VERIMOR ÇOCUK ANNE YE BAĞLI. EŞİ İLE KONUŞACAK. HAFTADA 1 OLABİLİR. O DÖNÜŞ YAPACAK. 12.2 O DÖNÜŞ YAPACAĞI :) İÇİN ARAMIYORUM. 
29 Oca 2026				0536 394 40 41		VERIMOR 11.2 AÇMADI. 12.2 AÇMADI.
29 Oca 2026		Piyano	8	0532 348 40 26	NURAY YILDIRIM 	VERIMOR VOLKAN SARVİN YILDIRIM  12.02 13 ŞUBAT 19.00 TNŞ DERSİ
30 Oca 2026		Piyano	28	0534 378 91 38	ÖYKÜ HANIM	VERIMOR TEMELSİZ. DENEME İÇİN ARANACAK. 6 ŞUBAT CUMA 20.00 12.2 MESAİDEN ÖTÜRÜ  GELEMEDİ.  TEKRAR ÇAĞIRILDI. 
2 Şub 2026		Bateri	4	0535 016 08 12	SÜMEYRA DEMİR 	VERIMOR MERT OĞLU İÇİN DENEME AYARLANACAK. 12.2 15 ŞUBAT PAZAR 13.00
3 Şub 2026		Doğum Günü		0533 340 04 41		ERDAL BEY  BİLGİLENDİRME ATILDI. 12.2 CADDEBOSTAN DA İŞLETMESİ VAR. 
3 Şub 2026	Öğrenci	Doğum Günü		0533 735 11 39		 BİLGİLENDİRME ATILDI.12.2 MEŞGUL.
4 Şub 2026			8	0541 858 46 59	SERAP HANIM	VERIMOR HİP HOP, BALE, PİYANO BİZ YÖNLENDİRECEĞİZ. 11.2 AÇMADI MESAJ ATILDI. 
5 Şub 2026		Bale	6	0534 224 74 82	ÇİĞDEM ÖZAY	SEZEN DİDEM ÖZAY 10 ŞUBAT 18.00 12.2 KATILIM SAĞLADI. GÜZEL GEÇTİ.
7 Şub 2026	Öğrenci	Bale		0536 830 26 28	MERVE ERDENİZ 	 12.2 YARIN ARANACAK. MÜSAİT DEĞİLMİŞ.
9 Şub 2026	Öğrenci	Keman		0534 223 89 18	SÜMEYRA HANIM	 TEMELSİZ. 12.2 AÇMADI. BU HAFTA OLUŞTURMAYALIM. HAFTASYA HABERLEŞELİM DEDİ.
10 Şub 2026		Yetişkin Bale	34	0505 532 75 93	ZEYNEP HANIM	VERIMOR DENEME İÇİN ARANACAK. 11.2 12.02 PERŞEMBE 19.00 ÇAĞIRILDI.  12.2 BAŞKA GÖRÜŞME YAPIYOR. 19 ŞUBAT PERŞEMBE
10 Şub 2026		Bale	5	0532 636 47 61	NESLİHAN ÇOBANGİL	ÇEKİLİŞ ZEYNEP ÇOBANGİL 2 DENEME HAKKI SUNULACAK. 11.2 BALE DENEME 17 ve 19 ŞUBAT BALE DERSLERİNE KATILIM SAĞLAYACAK. 
12 Şub 2026	Öğrenci	Konservatuar Hazırlık		0532 365 65 47	EBRU PARK 	 BOSTANCI MAH. ARKADAŞI 12.2 BAŞKASIYLA GÖRÜŞÜYOR. 
12 Şub 2026		Gitar	19	0533 365 00 35	KAYHAN BEY 	CAN  12.02 14 ŞUBAT 13.00
12 Şub 2026	Öğretmen			0505 049 14 77	SEREN HANIM	 İSTANBUL MEDENİYET ÜNİVERSİTESİ 3. SINIF ÖĞRENCİSİ `;

const months = {
    'Ağu': '08', 'Eyl': '09', 'Eki': '10', 'Kas': '11', 'Ara': '12', 'Oca': '01', 'Şub': '02'
};

function parseDate(dateStr) {
    const parts = dateStr.trim().split(' ');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = months[parts[1]] || '01';
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    return "2026-02-12";
}

const rows = [];
const lines = data.split('\n');

lines.forEach((line, index) => {
    if (!line.trim()) return;

    // Split by tabs
    const parts = line.split('\t');
    if (parts.length < 6) return;

    let [dateRaw, tipi, branch, ageStr, phone, contactName, noteContent] = parts.map(p => p ? p.trim() : "");

    const type = tipi || "Öğrenci";
    const studentName = contactName || "İsimsiz Aday";

    let age = 0;
    if (ageStr) {
        if (ageStr.toUpperCase().includes("AY")) {
            const matches = ageStr.match(/\d+/);
            if (matches) {
                age = Math.round((parseFloat(matches[0]) / 12) * 10) / 10;
            }
        } else {
            age = parseFloat(ageStr.replace(',', '.')) || 0;
        }
    }

    let source = "Diğer";
    if (noteContent.toUpperCase().includes("VERIMOR")) {
        source = "Verimor";
        noteContent = noteContent.replace(/VERIMOR/gi, "").trim();
    }

    const createdAt = parseDate(dateRaw);

    const notesList = noteContent ? [{
        id: "init_" + index,
        user: "Sistem",
        date: dateRaw,
        content: noteContent
    }] : [];

    rows.push({
        student_name: studentName,
        age: age,
        branch: branch || "Diğer",
        parent_name: contactName || "",
        phone: phone || "",
        source: source,
        status: 'Takip',
        notes: JSON.stringify(notesList),
        created_at: createdAt,
        type: type
    });
});

const header = "student_name,age,branch,parent_name,phone,source,status,notes,created_at,type";
const csvContent = [
    header,
    ...rows.map(r => {
        const escape = (str) => `"${String(str).replace(/"/g, '""')}"`;
        return [
            escape(r.student_name),
            r.age,
            escape(r.branch),
            escape(r.parent_name),
            escape(r.phone),
            escape(r.source),
            escape(r.status),
            escape(r.notes),
            r.created_at,
            escape(r.type)
        ].join(',');
    })
].join('\n');

fs.writeFileSync(path.join(__dirname, 'new_leads_import.csv'), '\ufeff' + csvContent, 'utf8');
console.log(`Successfully processed ${rows.length} leads.`);
