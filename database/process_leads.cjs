const fs = require('fs');
const path = require('path');

const data = `9 Eyl 2025		Atölye	40	0532 256 93 27		YETİŞKİN ATÖLYELERİ SUNUYOR. HAZIRLANINCA HABER VERİLECEK.
17 Eyl 2025		İş Birliği		0216 362 33 71	NEŞELİ AYAKLAR ÇOCUK YUVASI	BALE TANITIM ATÖLYESİ İÇİN EKİM AYINDA ARANACAK. 11.12 YARIN ÖĞLEDEN SONRA ARANACAK. 22 12  ZEYNEP HANIM  0534 323 18 61  PROGRAMI GÖNDERECEĞİM. 
17 Eyl 2025		İş Birliği		0535 747 58 80	KADIKÖY ÖZEL SUADİYE ANAOKULU	FULYA HANIMEKİM 2. YARI TEKRAR ARANACAK.BALE TANITIM ATÖLYESİ İÇİN
18 Eyl 2025		Atölye		0537 256 10 46	BEHİYE SÖNMEZ	YETİŞKİN ATÖLYESİ İSTİYOR.
1 Eki 2025	BAHAR GÜNDÜZ	Hip Hop	7	0536 339 65 67	RUHİYE HANIM	BİLGİLENDİRME YAPILDI. 13.10 
7 Eki 2025	LAYLA	Konservatuar Hazırlık	13	0552 412 58 44	ZEHRA HANIM	GÜZEL SANATLARA HAZIRLIK PİYANO İSTİYOR. PINAR HANIM ÇALIŞMA YAPACAK.
11 Eki 2025	LİNA 	Modern Dans	4	0532 542 52 65	ZEYNEP MUTLU	YAŞI ÇOK KÜÇÜK. 20.10 BALE YE DAVET ETTİM. CEVAP BEKLİYORUM. 27.10 DENEMEYE GELDİ. DÖNÜŞ BEKLİYORUZ.  11.11 HİPHOP DERSİNE KAYIT OLACAKTI BU CUMARTESİ PROGRAM KAPANDI. 
31 Eki 2025	DİLA	Hip Hop	6	0507 485 26 08	DİDEM HANIM	2 YIL BALE GEÇMİŞİ VAR. 
10 Kas 2025		Hip Hop		0544 387 74 75	ZUHAL HANIM	
10 Kas 2025		İş Birliği		0530 582 01 70	EMİN BEY	TACİGİLLER TAKUTA ATÖLYESİ
10 Kas 2025		İş Birliği		0555 077 03 96	ŞEYDA ATMACA	ABAJUR TASARIM ATÖLYESİ KIDS LİGHT WOK SHOP
10 Kas 2025		İş Birliği		0538 045 18 19	İLKMURAT AYGUN	SAAT BOYAMA LUMİNO
10 Kas 2025		İş Birliği		0539 273 30 83	CODE AND JOY	KODLAMA ATÖLYESİ
2 Ara 2025		Gitar	16	0533 556 74 42	AYŞEGÜL HANIM	OCAK AYI GİTAR DERSİ İSTİYOR. 8.1 YEĞENİ İÇİN ARAMIŞ AİLESİNE DÖNÜŞ YAPACAKMIŞ.
22 Ara 2025	VERİMOR			0538 011 78 75		AÇAMADIM. 10.1 AÇMADI. 
27 Ara 2026		Keman		0542 816 11 48	CEREN YAŞAR	10 OCAK 14.00 10.1 GELDİ. BAŞLAMAK İSTİYOR.
4 Oca 2026	VERIMOR		27	0534 574 44 61		8.1 ULAŞILAMIYOR. TEMEL SEVİYEDEN BAŞLAYACAK. KENDİSİ DÖNÜŞ YAPACAK
7 Oca 2026	VERIMOR	Piyano		0532 220 64 01		08.01 MÜSAİT DEĞİLMİŞ. BİLGİLERİ İLETTİM. 
6 Oca 2026		Gitar	7	0507 484 47 14	GİZEM HANIM	KASIM AYI HAFTASI UYGUN DEĞİLDİ. UYGUN OLDUĞU TAKDİRDE DÖNÜŞ SAĞLAYACAĞIM DEDİ. PROGRAMINIZ ŞU AN UYGUNSA DENEME DERSİ YAPABİLİRİZ DİYE MESAJ ATTIM. ARAMADIM. BEN SİZİ ARAYACAĞIM DEDİĞİ İÇİN.
11 Oca 2026		Gitar	5	0543 618 56 84	MEHTAP HANIM	17 OCAK 11.00 İÇİN DÖNÜŞ YAPACAK.
11 Oca 2026		Piyano		0535 388 42 94		AÇMADI. 
14 Oca 2026	FATMA ECE VE MUSTAFA EMİR SARIÇALI	Piyano	6	0533 425 76 76	ELİF HANIM	16 Ocak Cuma 19.00
16 Oca 2026	NEVA ÖZTÜRK	Bale	3	0505 030 98 13	BUSE HANIM	BU HAFTASONU MÜSAİT DEĞİLLER. 24 OCAK CMT 10.00 ÇAĞIRILDI. DÖNÜŞ BEKLENİYOR.  7.2 GELMEDİ. DÖNÜŞTE YAPMADI. 
17 Oca 2026		Bale	3	0554 888 66 99	NİLÜFER HANIM	19 OCAK PAZAR 10.00 DENEMEYE ÇAĞIRILDI. HABER BEKLENİYOR. 
19 Oca 2026		Bateri		0530 356 72 61	ASLI HANIM	19 OCAK PAZARTESİ 17.00 İÇİN DÖNÜŞ YAPACAK. 
20 Oca 2026	ADA GÜNEY	Bale	4	0533 332 27 61	ASLI HANIM	8 ŞUBAT 11.00 
21 Oca 2026		Bateri	5	0555 307 16 84	GÜLTEN HANIM	25 OCAK İKİZLER GELİYOR. BİRİ BATERİ BİRİ PİYANO
23 Oca 2026		Piyano	5	0536 451 22 76	ELİF HANIM	24.1 ARANDI. AÇMADI.
24 Oca 2026		Bale	4	0546 679 67 00	HÜSEYİN BEY 	AÇMADI. 3 ŞUBAT SALI 18.00 
17 Oca 2026		Ukulele	24	0533 129 08 99	ESMA ALTUN	24.1 31 OCAK İÇİN DÖNÜŞ YAPACAK.
24 Oca 2026		Keman	8	0554 774 79 79	TANER BEY	14 ŞUBAT 14.00
29 Oca 2026	VERIMOR	Bateri	15	0533 555 00 28		4-5 DERSLİK DÜŞÜNÜYORMUŞ. SIKIŞTIRILMIŞ PROGRAM İSTİYOR. 10 DERS İSTEMİYOR. KENDİSİ ÇOCUĞU İLE GÖRÜŞÜP DÖNÜŞ YAPACAKMIŞ..ÜCRETİMİZ ÇOK YÜKSEMİŞ.
29 Oca 2026	VERIMOR	Bale	2	0534 057 84 78	AYFER HANIM 	PAZAR GÜNÜ İSTİYOR. DENEMEYE ÇAĞRILACAK. 11.2 14 ŞUBAT 10.00 ÇAĞIRILDI. 
29 Oca 2026	VERIMOR	Bale	3	0538 950 57 68	BEYZA HANIM 	ÇOCUK ANNE YE BAĞLI. EŞİ İLE KONUŞACAK. HAFTADA 1 OLABİLİR. O DÖNÜŞ YAPACAK
3 Şub 2026		Doğum Günü		0533 340 04 41		BİLGİLENDİRME ATILDI.
3 Şub 2026		Doğum Günü		0533 735 11 39		BİLGİLENDİRME ATILDI.
2 Şub 2026	VERIMOR	Bateri	4	0535 016 08 12	SÜMEYRA DEMİR 	MERT OĞLU İÇİN DENEME AYARLANACAK. 11.2 PAZARTESİ 15.00 ÖNERİLECEK. 
29 Oca 2026	VERIMOR			0536 394 40 41		11.2 AÇMADI. 
30 Oca 2026	VERIMOR	Piyano	28	0534 378 91 38	ÖYKÜ HANIM	TEMELSİZ. DENEME İÇİN ARANACAK. 6 ŞUBAT CUMA 20.00 
29 Oca 2026	VERIMOR	Piyano	8	0532 348 40 26	NURAY YILDIRIM 
4 Şub 2026	ZEYNEP UMAY	Bale	6	0501 741 08 10	ONUR BEY	5 ŞUBAT 18.00
5 Şub 2026	SEZEN DİDEM ÖZAY	Bale	6	0534 224 74 82	ÇİĞDEM ÖZAY	10 ŞUBAT 18.00 12.2 KATILIM SAĞLADI. GÜZEL GEÇTİ.
4 Şub 2026	VERIMOR		8	0541 858 46 59	SERAP HANIM	HİP HOP, BALE, PİYANO BİZ YÖNLENDİRECEĞİZ. 11.2 AÇMADI MESAJ ATILDI. 
10 Şub 2026	VERIMOR	Yetişkin Bale	34	0505 532 75 93	ZEYNEP HANIM	DENEME İÇİN ARANACAK. 11.2 12.02 PERŞEMBE 19.00 ÇAĞIRILDI.  12.2 BAŞKA GÖRÜŞME YAPIYOR. 
10 Şub 2026	ÇEKİLİŞ ZEYNEP ÇOBANGİL	Bale	5	0532 636 47 61	NESLİHAN ÇOBANGİL	2 DENEME HAKKI SUNULACAK. 11.2 BALE DENEME 17 ve 19 ŞUBAT BALE DERSLERİNE KATILIM SAĞLAYACAK.`;

const lines = data.split('\n');
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
lines.forEach((line, index) => {
    if (!line.trim() || line.includes('Tarih\tÖĞRENCİ')) return;

    // Split by tabs. The user provided tab-separated data.
    const parts = line.split('\t');
    if (parts.length < 6) return;

    let [dateRaw, studentName, branch, ageStr, phone, parentName, noteContent] = parts.map(p => p ? p.trim() : "");

    let age = 0;
    if (ageStr) {
        age = parseFloat(ageStr.replace(',', '.')) || 0;
    }

    let source = "Diğer";
    const upName = studentName.toUpperCase();
    const upParent = (parentName || "").toUpperCase();
    const upNote = (noteContent || "").toUpperCase();

    if (upName.includes("VERİMOR") || upName.includes("VERIMOR")) {
        source = "Verimor";
        studentName = studentName.replace(/VERİMOR|VERIMOR/gi, "").trim();
    } else if (upName.includes("INSTAGTRAM") || upName.includes("INSTAGRAM")) {
        source = "Instagram";
        studentName = studentName.replace(/INSTAGTRAM|INSTAGRAM/gi, "").trim();
    } else if (upNote.includes("INSTAGRAM")) {
        source = "Instagram";
    }

    // Special handling for rows where student name is missing and "VERIMOR" or source is in studentName
    if (!studentName && source === "Verimor") {
        // Keep it empty, it will be handled by actualStudentName
    }

    const actualStudentName = studentName || parentName || "İsimsiz Aday";
    const createdAt = parseDate(dateRaw);

    const notesList = noteContent ? [{
        id: "init_" + index,
        user: "Sistem",
        date: dateRaw,
        content: noteContent
    }] : [];

    rows.push({
        student_name: actualStudentName,
        age: age,
        branch: branch || "Diğer",
        parent_name: parentName || "",
        phone: phone || "",
        source: source,
        status: 'Takip',
        notes: JSON.stringify(notesList),
        created_at: createdAt
    });
});

const header = "student_name,age,branch,parent_name,phone,source,status,notes,created_at";
const csvContent = [
    header,
    ...rows.map(r => {
        return [
            `"${r.student_name.replace(/"/g, '""')}"`,
            r.age,
            `"${r.branch.replace(/"/g, '""')}"`,
            `"${r.parent_name.replace(/"/g, '""')}"`,
            `"${r.phone.replace(/"/g, '""')}"`,
            `"${r.source}"`,
            `"${r.status}"`,
            `"${r.notes.replace(/"/g, '""')}"`,
            r.created_at
        ].join(',');
    })
].join('\n');

fs.writeFileSync(path.join(__dirname, 'new_leads_import.csv'), '\ufeff' + csvContent, 'utf8');
console.log(`Successfully processed ${rows.length} leads.`);
