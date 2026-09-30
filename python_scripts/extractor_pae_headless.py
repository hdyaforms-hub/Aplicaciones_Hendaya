import sys
import os
import re
import json
import pdfplumber

def extract_data_from_pdf(pdf_path):
    data = {
        'Licitacion': '',
        'Folio': '',
        'Res_Sanitaria_N': '',
        'Nombre_Num_establecimiento': '',
        'RBD': '',
        'Region': '',
        'Comuna': '',
        'Fecha_Supervision': '',
        'Porcentaje_cumplimiento_final': '',
        'Observaciones': ''
    }
    aspectos = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return data, aspectos
                
            first_page_text = pdf.pages[0].extract_text()
            
            # Extracción por Regex primero
            licitacion_match = re.search(r'Licitaci[oó]n\s*(\d+)', first_page_text, re.IGNORECASE)
            if licitacion_match:
                data['Licitacion'] = licitacion_match.group(1)
                
            folio_match = re.search(r'FOLIO\s*(\d+)', first_page_text, re.IGNORECASE)
            if folio_match:
                data['Folio'] = folio_match.group(1)
                
            fecha_match = re.search(r'Fecha\s*Supervis[^\s:]*:\s*([_\d]+)\s*/\s*([_\d]+)\s*/\s*([_\d]+)', first_page_text, re.IGNORECASE)
            if fecha_match:
                d = fecha_match.group(1).replace('_', '')
                m = fecha_match.group(2).replace('_', '')
                y = fecha_match.group(3).replace('_', '')
                data['Fecha_Supervision'] = f"{y}-{m}-{d}" # Format YYYY-MM-DD for easier parsing in Node

            # Extracción por Tablas para el resto de info general
            tables_p1 = pdf.pages[0].extract_tables()
            if tables_p1:
                header_table = tables_p1[0]
                
                def find_in_table(table, keyword, direction='right'):
                    for r_idx, row in enumerate(table):
                        for c_idx, cell in enumerate(row):
                            if cell and keyword.lower() in str(cell).lower():
                                if direction == 'right':
                                    for i in range(c_idx + 1, len(row)):
                                        if row[i] and str(row[i]).strip() != '':
                                            return str(row[i]).strip()
                                elif direction == 'down':
                                    for i in range(r_idx + 1, len(table)):
                                        if table[i][c_idx] and str(table[i][c_idx]).strip() != '':
                                            return str(table[i][c_idx]).strip()
                    return ''

                if not data['Licitacion']:
                    data['Licitacion'] = find_in_table(header_table, 'Licitaci')
                if not data['Folio']:
                    data['Folio'] = find_in_table(header_table, 'FOLIO')
                if not data['Fecha_Supervision']:
                    raw_date = find_in_table(header_table, 'Fecha Supervis')
                    if raw_date:
                        # try to format it if it looks like dd/mm/yyyy
                        match = re.search(r'(\d{2})/(\d{2})/(\d{4})', raw_date)
                        if match:
                            data['Fecha_Supervision'] = f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
                        else:
                            data['Fecha_Supervision'] = raw_date

                data['Res_Sanitaria_N'] = find_in_table(header_table, 'Res Sanitaria')
                data['Nombre_Num_establecimiento'] = find_in_table(header_table, 'Nombre y N', direction='down')
                data['RBD'] = find_in_table(header_table, 'R.B.D.', direction='down')
                data['Region'] = find_in_table(header_table, 'Region', direction='down')
                data['Comuna'] = find_in_table(header_table, 'Comuna', direction='down')
                
                # Porcentaje
                pct_str = find_in_table(header_table, 'Porcentaje de cumplimiento final', direction='right')
                if pct_str:
                    # extract number
                    match_num = re.search(r'([\d.,]+)', pct_str)
                    if match_num:
                        val = match_num.group(1).replace(',', '.')
                        try:
                            data['Porcentaje_cumplimiento_final'] = float(val)
                        except:
                            data['Porcentaje_cumplimiento_final'] = None

            # Extraer Aspectos Estandar PAE a través de todas las páginas
            in_aspectos_table = False
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) == 0: continue
                    
                    is_aspectos_table = False
                    start_row = 0
                    
                    # Si comienza la tabla
                    if table[0] and table[0][0] and ('Aspectos Estandar PAE' in str(table[0][0]) or 'Aspectos SGC PAE' in str(table[0][0])):
                        is_aspectos_table = True
                        start_row = 2
                    # Si es continuación de tabla en otra hoja (tiene 6 o más columnas)
                    elif len(table[0]) >= 6 and in_aspectos_table:
                        is_aspectos_table = True
                        start_row = 0
                        
                    if is_aspectos_table:
                        in_aspectos_table = True
                        for row in table[start_row:]:
                            if not any(row): continue
                            if len(row) >= 6:
                                if row[0] and '1.A. INFRAESTRUCTURA' in str(row[0]):
                                    continue # Omitir fila de cabecera si se repite
                                    
                                aspectos.append({
                                    'Infraestructura': str(row[0]).strip() if row[0] else '',
                                    'Calificacion': str(row[1]).strip() if row[1] else '',
                                    'Descripcion': str(row[2]).strip() if row[2] else '',
                                    'Comprometiendo_Inocuidad': str(row[3]).strip() if row[3] else '',
                                    'Tipo_NC': str(row[4]).strip() if row[4] else '',
                                    'Otros_Comentarios': str(row[5]).strip() if row[5] else ''
                                })
                                
            # Extraer Observaciones
            full_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
            obs_match = re.search(r'OBSERVACIONES A LOS INCUMPLIMIENTOS:(.*?)(NOMBRE y RUT|Steffany|JUNAEB se reserva|$)', full_text, re.DOTALL)
            if obs_match:
                data['Observaciones'] = obs_match.group(1).strip()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
        
    return data, aspectos

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No pdf path provided"}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)
        
    data, aspectos = extract_data_from_pdf(pdf_path)
    print(json.dumps({"cabecera": data, "detalles": aspectos}))
