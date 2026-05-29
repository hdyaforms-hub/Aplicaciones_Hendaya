import sys
import os
import re
import json
import pdfplumber

def extract_data_from_pdf(pdf_path):
    data = {
        'Licitación': '',
        'Folio': '',
        'Fecha Supervisión': '',
        'RBD': '',
        'Región': '',
        'Comuna': '',
        'Servicio': '',
        'Hora Inicio': '',
        'Hora': '',
        'OBSERVACIONES A LOS INCUMPLIMIENTOS': ''
    }
    detalles = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return data, detalles
                
            first_page_text = pdf.pages[0].extract_text()
            
            # Extract header with regex
            licitacion_match = re.search(r'Licitaci[oó]n\s*(\d+)', first_page_text, re.IGNORECASE)
            if licitacion_match:
                data['Licitación'] = licitacion_match.group(1)
                
            folio_match = re.search(r'FOLIO\s*(\d+)', first_page_text, re.IGNORECASE)
            if folio_match:
                data['Folio'] = folio_match.group(1)
                
            fecha_match = re.search(r'Fecha\s*Supervis[^\s_]*\s+([_\d]+)\s*/\s*([_\d]+)\s*/\s*([_\d]+)', first_page_text, re.IGNORECASE)
            if fecha_match:
                d = fecha_match.group(1).replace('_', '')
                m = fecha_match.group(2).replace('_', '')
                y = fecha_match.group(3).replace('_', '')
                data['Fecha Supervisión'] = f"{d}/{m}/{y}"

            hora_inicio_match = re.search(r'Hora\s*inicio:\s*([\d:]+)', first_page_text, re.IGNORECASE)
            if hora_inicio_match:
                data['Hora Inicio'] = hora_inicio_match.group(1)

            hora_match = re.search(r'Hora inicio:[\s\d:]+Hora\s*([\d:]+)', first_page_text, re.IGNORECASE)
            if hora_match:
                data['Hora'] = hora_match.group(1)

            tables_p1 = pdf.pages[0].extract_tables()
            if tables_p1:
                # Find the table that contains R.B.D.
                for table in tables_p1:
                    for r_idx, row in enumerate(table):
                        for c_idx, cell in enumerate(row):
                            cell_str = str(cell)
                            if 'R.B.D.' in cell_str:
                                # Next row has values
                                if r_idx + 1 < len(table):
                                    rbd_val = str(table[r_idx + 1][c_idx]).strip()
                                    # Parse to int if possible
                                    try:
                                        data['RBD'] = int(re.sub(r'[^\d]', '', rbd_val))
                                    except ValueError:
                                        data['RBD'] = None
                                    if c_idx + 2 < len(table[r_idx+1]):
                                        data['Región'] = str(table[r_idx + 1][c_idx + 2]).strip().replace('\n', ' ')
                                    if c_idx + 4 < len(table[r_idx+1]):
                                        data['Comuna'] = str(table[r_idx + 1][c_idx + 4]).strip()
                            if cell_str.strip() == 'Servicio' and c_idx + 1 < len(row):
                                data['Servicio'] = str(row[c_idx+1]).strip()

            # Extraer Aspectos
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) == 0: continue
                    
                    is_aspectos_table = False
                    # Check if table has headers for Elementos Esenciales
                    for row in table[:3]:
                        if any(cell and 'Control Elementos Esenciales' in str(cell) for cell in row):
                            is_aspectos_table = True
                            break
                        if any(cell and 'Aspectos' in str(cell) for cell in row) and any(cell and 'CO' in str(cell) for cell in row):
                            is_aspectos_table = True
                            break
                    
                    if is_aspectos_table:
                        # Find the row index where 'Aspectos' is
                        start_row = 0
                        for i, row in enumerate(table):
                            if row and len(row) >= 5 and (row[2] == 'CO' or row[2] == 'NC'):
                                start_row = i + 1
                                break
                            if row and len(row) >= 5 and 'Aspectos' in str(row[0]) and 'CO' in str(row[2]):
                                start_row = i + 1
                                break

                        current_aspecto = None
                        for row in table[start_row:]:
                            if not any(row): continue
                            if len(row) >= 5:
                                # Si la primera columna tiene un aspecto (A. , B. , etc)
                                aspecto_val = str(row[0]).strip() if row[0] else ''
                                obs_val = str(row[1]).strip() if row[1] else ''
                                co_val = str(row[2]).strip() if row[2] else ''
                                nc_val = str(row[3]).strip() if row[3] else ''
                                na_val = str(row[4]).strip() if row[4] else ''

                                if re.match(r'^[A-Z]\.', aspecto_val):
                                    # New Aspecto
                                    current_aspecto = {
                                        'Aspecto': aspecto_val,
                                        'Observaciones o Medio de verificación': obs_val,
                                        'CO': 'X' if 'X' in co_val else '',
                                        'NC': 'X' if 'X' in nc_val else '',
                                        'NA': 'X' if 'X' in na_val else ''
                                    }
                                    detalles.append(current_aspecto)
                                else:
                                    # Continuation of Observaciones
                                    if current_aspecto and obs_val:
                                        if current_aspecto['Observaciones o Medio de verificación']:
                                            current_aspecto['Observaciones o Medio de verificación'] += '\n' + obs_val
                                        else:
                                            current_aspecto['Observaciones o Medio de verificación'] = obs_val
                                    # Sometimes Aspecto is empty but CO, NC, NA are marked here (like the table structure shows)
                                    if current_aspecto:
                                        if 'X' in co_val: current_aspecto['CO'] = 'X'
                                        if 'X' in nc_val: current_aspecto['NC'] = 'X'
                                        if 'X' in na_val: current_aspecto['NA'] = 'X'
                                        
            # Extraer Observaciones
            full_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
            obs_match = re.search(r'OBSERVACIONES A LOS INCUMPLIMIENTOS:(.*?)(NOMBRE y RUT|JUNAEB se reserva|$)', full_text, re.DOTALL | re.IGNORECASE)
            if obs_match:
                data['OBSERVACIONES A LOS INCUMPLIMIENTOS'] = obs_match.group(1).strip()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
        
    return data, detalles

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No pdf path provided"}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)
        
    data, detalles = extract_data_from_pdf(pdf_path)
    print(json.dumps({"cabecera": data, "detalles": detalles}))
