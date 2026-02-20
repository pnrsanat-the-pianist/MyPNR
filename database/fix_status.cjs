const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\kaanc\\AG_2026MyPNR\\2026MyPNR\\database\\students_import_2026.csv';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const fixedLines = lines.map((line, i) => {
    if (i === 0 || !line.trim()) return line;
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length > 3) {
        let status = parts[3].toLowerCase().replace(/"/g, '').trim();
        if (status === 'passive') {
            parts[3] = '"inactive"';
        } else if (status === 'active') {
            parts[3] = '"active"';
        }
    }
    return parts.join(',');
});

fs.writeFileSync(filePath, fixedLines.join('\n'), 'utf8');
console.log('Fixed CSV status values: passive -> inactive');
