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
                            
                            # Asegurar que la fila tenga al menos 5 elementos
                            row_list = list(row) + [''] * max(0, 5 - len(row))

                            if len(row_list) >= 5:
                                # Si la primera columna tiene un aspecto (A. , B. , etc)
                                aspecto_val = str(row_list[0]).strip() if row_list[0] else ''
                                obs_val = str(row_list[1]).strip() if row_list[1] else ''

                                # Si los nombres de columnas vienen invertidos en el PDF (Aspecto en col 2)
                                if re.match(r'^[A-Z]\.', obs_val) and not re.match(r'^[A-Z]\.', aspecto_val):
                                    aspecto_val, obs_val = obs_val, aspecto_val

                                co_val = str(row_list[2]).strip() if row_list[2] else ''
                                nc_val = str(row_list[3]).strip() if row_list[3] else ''
                                na_val = str(row_list[4]).strip() if row_list[4] else ''

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
                                    extra_text = []
                                    if aspecto_val: extra_text.append(aspecto_val)
                                    if obs_val: extra_text.append(obs_val)
                                    
                                    combined_extra = "\n".join(extra_text).strip()
                                    
                                    if current_aspecto and combined_extra:
                                        if current_aspecto['Observaciones o Medio de verificación']:
                                            current_aspecto['Observaciones o Medio de verificación'] += '\n' + combined_extra
                                        else:
                                            current_aspecto['Observaciones o Medio de verificación'] = combined_extra
                                            
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
