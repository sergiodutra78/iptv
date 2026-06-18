import os
import re

def test_epg():
    log = []
    log.append("--- TEST START ---")
    xml_path = "epg_test.xml"
    if not os.path.exists(xml_path):
        log.append(f"Archivo no encontrado: {xml_path}")
        with open('epg_debug_py.txt', 'w', encoding='utf-8') as f:
            f.write('\n'.join(log))
        return

    log.append(f"Archivo encontrado: {xml_path}")
    try:
        with open(xml_path, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
            log.append(f"Tamaño: {len(text)} caracteres")
    except Exception as e:
        log.append(f"Error leyendo archivo: {e}")
        with open('epg_debug_py.txt', 'w', encoding='utf-8') as f:
            f.write('\n'.join(log))
        return

    # Parsear Canales
    id_to_names = {}
    channel_pieces = text.split('</channel>')
    for piece in channel_pieces:
        match = re.search(r'<channel([^>]+)>', piece)
        if not match:
            continue
        attr_text = match.group(1)
        content = piece[match.end():]
        id_match = re.search(r'id="([^"]*)"', attr_text)
        cid = id_match.group(1) if id_match else ""
        names = re.findall(r'<display-name[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/display-name>', content, re.IGNORECASE)
        id_to_names[cid] = [n.strip() for n in names]

    log.append(f"Canales mapeados: {len(id_to_names)}")

    # Parsear Programas
    pieces = text.split('</programme>')
    count = 0
    channel_ids_with_progs = set()

    for piece in pieces:
        match = re.search(r'<programme([^>]+)>', piece)
        if not match:
            continue
        attr_text = match.group(1)
        channel_match = re.search(r'channel="([^"]+)"', attr_text)
        if channel_match:
            channel_ids_with_progs.add(channel_match.group(1))
            count += 1

    log.append(f"Programas totales: {count}")
    log.append(f"Canales con programas: {len(channel_ids_with_progs)}")

    log.append("\n--- Búsqueda de Adult Swim ---")
    contains_adult = [cid for cid, names in id_to_names.items() if 'adult' in cid.lower() or any('adult' in n.lower() for n in names)]
    
    log.append(f"Canales con 'Adult': {' | '.join([f'{cid} ({id_to_names[cid]})' for cid in contains_adult])}")
    
    for cid in contains_adult:
        has_progs = cid in channel_ids_with_progs
        log.append(f"¿Tiene programas {cid}?: {has_progs}")

    log.append("--- TEST END ---")

    with open('epg_debug_py.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(log))

test_epg()
