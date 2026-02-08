import csv
import re
from datetime import datetime

months = {
    'Oca': '01', 'Şub': '02', 'Mar': '03', 'Nis': '04', 'May': '05', 'Haz': '06',
    'Tem': '07', 'Ağu': '08', 'Eyl': '09', 'Eki': '10', 'Kas': '11', 'Ara': '12',
    'Temmuz': '07', 'Ağustos': '08', 'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12',
    'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04', 'Mayıs': '05', 'Haziran': '06'
}

def parse_date(date_str):
    if not date_str or not isinstance(date_str, str) or date_str.strip() == '':
        return None
    
    date_str = date_str.strip()
    
    # Try YYYY-MM-DD or DD.MM.YYYY
    if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
        return date_str
    if re.match(r'\d{2}\.\d{2}\.\d{4}', date_str):
        parts = date_str.split('.')
        return f"{parts[2]}-{parts[1]}-{parts[0]}"

    # Try "5 Ara 24" or "30 Ağu 24"
    match = re.search(r'(\d+)\s+([^\s\d]+)\s+(\d+)', date_str)
    if match:
        day = match.group(1).zfill(2)
        month_name = match.group(2).capitalize()
        year = match.group(3)
        
        # Adjust year
        if len(year) == 2:
            year = "20" + year
            
        month = months.get(month_name[:3], months.get(month_name, '01'))
        return f"{year}-{month}-{day}"
    
    return date_str

def process():
    input_file = r'c:\Users\kaanc\AG_2026MyPNR\2026MyPNR\database\raw_sheet_data.txt'
    output_file = r'c:\Users\kaanc\AG_2026MyPNR\2026MyPNR\database\crm_ogrenci_import.csv'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    headers = lines[0].strip().split('\t')
    data_rows = lines[1:]
    
    csv_rows = []
    
    for row_text in data_rows:
        if not row_text.strip():
            continue
            
        cols = row_text.strip().split('\t')
        if len(cols) < 2:
            continue
            
        full_name_raw = cols[0]
        branch_status_raw = cols[1] if len(cols) > 1 else ""
        start_date_raw = cols[2] if len(cols) > 2 else ""
        dob_raw = cols[3] if len(cols) > 3 else ""
        tc_no = cols[4] if len(cols) > 4 else ""
        address = cols[5] if len(cols) > 5 else ""
        health = cols[6] if len(cols) > 6 else ""
        social = cols[7] if len(cols) > 7 else ""
        p1_name = cols[8] if len(cols) > 8 else ""
        p1_rel = cols[9] if len(cols) > 9 else ""
        p1_phone = cols[10] if len(cols) > 10 else ""
        p1_tc = cols[11] if len(cols) > 11 else ""
        p1_email = cols[12] if len(cols) > 12 else ""
        p1_job = cols[13] if len(cols) > 13 else ""
        p2_name = cols[14] if len(cols) > 14 else ""
        p2_rel = cols[15] if len(cols) > 15 else ""
        p2_phone = cols[16] if len(cols) > 16 else ""
        p2_tc = cols[17] if len(cols) > 17 else ""
        p2_email = cols[18] if len(cols) > 18 else ""
        p2_job = cols[19] if len(cols) > 19 else ""
        teacher = cols[20] if len(cols) > 20 else ""
        
        # Skip dummy rows
        if "DENEME" in full_name_raw or "ESKİ ÖĞRENCİ" in full_name_raw:
            continue

        # Extract sub-branch from name
        sub_branch = ""
        name_clean = full_name_raw
        match = re.search(r'\((.*?)\)', full_name_raw)
        if match:
            sub_branch = match.group(1).title()
            name_clean = re.sub(r'\(.*?\)', '', full_name_raw).strip()
            
        # Branch mapping
        main_branch = "Enstrüman"
        if "Bale" in branch_status_raw or "Dans" in branch_status_raw:
            main_branch = "Bale/Dans"
            if not sub_branch:
                sub_branch = "Bale"
        
        # Status
        status = 'inactive' if "İptal" in branch_status_raw else 'active'
        
        # Notes
        notes_parts = []
        if health and health.lower() != 'yok.':
            notes_parts.append(f"Sağlık: {health}")
        if social:
            notes_parts.append(f"Sosyal Medya: {social}")
        if teacher:
            notes_parts.append(f"Öğretmen: {teacher}")
        if p1_rel:
            notes_parts.append(f"Veli 1 Yakınlık: {p1_rel}, Meslek: {p1_job}")
        if p2_rel:
            notes_parts.append(f"Veli 2 Yakınlık: {p2_rel}, Meslek: {p2_job}")
            
        notes = " | ".join(notes_parts)
        
        csv_rows.append({
            'full_name': name_clean,
            'tc_no': tc_no.strip(),
            'dob': parse_date(dob_raw),
            'main_branch': main_branch,
            'sub_branch': sub_branch,
            'status': status,
            'start_date': parse_date(start_date_raw),
            'end_date': None,
            'parent1_name': p1_name,
            'parent1_tc': p1_tc.strip(),
            'parent1_phone': p1_phone.strip(),
            'parent1_email': p1_email.strip(),
            'parent2_name': p2_name,
            'parent2_tc': p2_tc.strip(),
            'parent2_phone': p2_phone.strip(),
            'parent2_email': p2_email.strip(),
            'address': address,
            'notes': notes
        })
        
    fieldnames = [
        'full_name', 'tc_no', 'dob', 'main_branch', 'sub_branch', 'status', 
        'start_date', 'end_date', 'parent1_name', 'parent1_tc', 'parent1_phone', 
        'parent1_email', 'parent2_name', 'parent2_tc', 'parent2_phone', 
        'parent2_email', 'address', 'notes'
    ]
    
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)

if __name__ == "__main__":
    process()
