const fs = require('fs');
const path = require('path');

const months = {
    'Oca': '01', 'Şub': '02', 'Mar': '03', 'Nis': '04', 'May': '05', 'Haz': '06',
    'Tem': '07', 'Ağu': '08', 'Eyl': '09', 'Eki': '10', 'Kas': '11', 'Ara': '12',
    'Temmuz': '07', 'Ağustos': '08', 'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12',
    'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04', 'Mayıs': '05', 'Haziran': '06'
};

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;

    // Temizlik: Noktaları ve boşlukları normalize et
    dateStr = dateStr.trim().replace(/\s+/g, ' ');

    // YYYY-MM-DD zaten doğru format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // DD.MM.YYYY (Noktalı formatı yakala: 29.9.2025, 01.01.2026 vb.)
    let dotMatch = dateStr.match(/(\d{1,2})\s*[\.\s\/]\s*(\d{1,2})\s*[\.\s\/]\s*(\d{4})/);
    if (dotMatch) {
        const day = dotMatch[1].padStart(2, '0');
        const month = dotMatch[2].padStart(2, '0');
        const year = dotMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Metin tabanlı aylar: "26 Kasım 25" veya "5 Ara 24"
    const textMatch = dateStr.match(/(\d{1,2})\s+([^\s\d\.]+)\s+(\d{2,4})/);
    if (textMatch) {
        const day = textMatch[1].padStart(2, '0');
        const monthNameRaw = textMatch[2].charAt(0).toUpperCase() + textMatch[2].slice(1).toLowerCase();
        let year = textMatch[3];

        if (year.length === 2) {
            const yearNum = parseInt(year);
            year = (yearNum <= 30) ? "20" + year : "19" + year;
        }

        const monthIdx = months[monthNameRaw.substring(0, 3)] || months[monthNameRaw] || '01';
        return `${year}-${monthIdx}-${day}`;
    }

    return null;
}

function process() {
    const inputFile = path.join('c:', 'Users', 'kaanc', 'AG_2026MyPNR', '2026MyPNR', 'database', 'raw_sheet_data.txt');
    const outputFile = path.join('c:', 'Users', 'kaanc', 'AG_2026MyPNR', '2026MyPNR', 'database', 'crm_ogrenci_import.csv');

    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n');

    const csvRows = [];

    // Sütun başlıklarını bir kez yazalım
    const header = 'full_name,tc_no,dob,main_branch,sub_branch,status,start_date,end_date,parent1_name,parent1_tc,parent1_phone,parent1_email,parent2_name,parent2_tc,parent2_phone,parent2_email,address,notes';

    for (let i = 1; i < lines.length; i++) {
        const rowText = lines[i];
        if (!rowText.trim()) continue;

        const cols = rowText.split('\t').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 5) continue; // Çok kısa satırları (çöp satırlar) atla

        const fullNameRaw = cols[0];

        // Gereksiz/Hatalı satırları filtrele
        if (!fullNameRaw ||
            fullNameRaw.includes("AD SOYAD") ||
            fullNameRaw.includes("DENEME") ||
            fullNameRaw.includes("ESKİ ÖĞRENCİ") ||
            fullNameRaw.includes("Yakınlık") ||
            fullNameRaw.length < 3) continue;

        const branchStatusRaw = cols[1] || "";
        const startDateRaw = cols[2] || "";
        const dobRaw = cols[3] || "";
        const tcNo = (cols[4] || "").replace(/\s/g, '');
        const address = cols[5] || "";
        const health = cols[6] || "";
        const social = cols[7] || "";
        const p1Name = cols[8] || "";
        const p1Rel = cols[9] || "";
        const p1Phone = cols[10] || "";
        const p1Tc = (cols[11] || "").replace(/\s/g, '');
        const p1Email = cols[12] || "";
        const p1Job = cols[13] || "";
        const p2Name = cols[14] || "";
        const p2Rel = cols[15] || "";
        const p2Phone = cols[16] || "";
        const p2Tc = (cols[17] || "").replace(/\s/g, '');
        const p2Email = cols[18] || "";
        const p2Job = cols[19] || "";
        const teacher = cols[20] || "";

        let subBranch = "";
        let nameClean = fullNameRaw;
        const subMatch = fullNameRaw.match(/\((.*?)\)/);
        if (subMatch) {
            subBranch = subMatch[1].trim();
            nameClean = fullNameRaw.replace(/\(.*\)/, '').trim();
        }

        let mainBranch = "Enstrüman";
        if (branchStatusRaw.toLowerCase().includes("bale") || branchStatusRaw.toLowerCase().includes("dans")) {
            mainBranch = "Bale / Dans";
            if (!subBranch) subBranch = "Bale";
        }

        const status = branchStatusRaw.toLowerCase().includes("iptal") ? 'inactive' : 'active';

        const notesArr = [];
        if (health && health.toLowerCase() !== 'yok.') notesArr.push(`Sağlık: ${health}`);
        if (social) notesArr.push(`Sosyal: ${social}`);
        if (teacher) notesArr.push(`Hoca: ${teacher}`);
        if (p1Rel) notesArr.push(`V1: ${p1Rel}(${p1Job})`);
        if (p2Rel) notesArr.push(`V2: ${p2Rel}(${p2Job})`);

        const notes = notesArr.join(' | ').replace(/"/g, '""');

        const csvLine = [
            `"${nameClean}"`,
            `"${tcNo}"`,
            `"${parseDate(dobRaw) || ''}"`,
            `"${mainBranch}"`,
            `"${subBranch}"`,
            `"${status}"`,
            `"${parseDate(startDateRaw) || ''}"`,
            `""`, // end_date
            `"${p1Name}"`,
            `"${p1Tc}"`,
            `"${p1Phone}"`,
            `"${p1Email}"`,
            `"${p2Name}"`,
            `"${p2Tc}"`,
            `"${p2Phone}"`,
            `"${p2Email}"`,
            `"${address.replace(/"/g, '""')}"`,
            `"${notes}"`
        ].join(',');

        csvRows.push(csvLine);
    }

    fs.writeFileSync(outputFile, header + '\n' + csvRows.join('\n'), 'utf-8');
    console.log(`CSV created successfully with ${csvRows.length} records!`);
}

process();
