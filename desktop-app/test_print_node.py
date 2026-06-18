import os
import re

def test_epg():
    xml_path = "epg_test.xml"
    with open(xml_path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    pieces = text.split('</channel>')
    for piece in pieces:
        if 'directvgouy/adultswim' in piece:
            print("--- RAW NODE directvgouy/adultswim ---")
            print(piece[:500]) # Print first 500 chars of the piece
            break

test_epg()
