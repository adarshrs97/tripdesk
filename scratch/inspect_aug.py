import zipfile, os
import xml.etree.ElementTree as ET

wb_path = os.path.join("reference", "Log book VTL Aug 2027.xlsx")
wb = zipfile.ZipFile(wb_path)

shared_strings = []
if "xl/sharedStrings.xml" in wb.namelist():
    sst_root = ET.fromstring(wb.read("xl/sharedStrings.xml"))
    for si in sst_root.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
        texts = [t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
        shared_strings.append("".join(texts))

root = ET.fromstring(wb.read("xl/worksheets/sheet2.xml"))
rows = root.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row")
print("=== AUG 2026 SHEET ROWS ===")
for r in rows:
    r_num = r.attrib.get("r", "")
    cells = {}
    for c in r.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
        ref = c.attrib.get("r", "")
        t = c.attrib.get("t", "")
        v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
        val = v.text if v is not None else ""
        if t == "s" and val.isdigit():
            val = shared_strings[int(val)]
        cells[ref] = val
    # print non-empty
    if cells:
        line = " | ".join(f"{k}:{v}" for k, v in sorted(cells.items()))
        print(f"Row {r_num:2s}: {line}")
